import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';

import type {
  PresenceCounters,
  PresenceDailyPoint,
  PresenceSeriesPoint,
  PresenceStats,
} from '@dotlearn/contracts';

import { dataFile } from '../../common/config/data-paths';
import { readJsonFile, writeJsonFile } from '../../common/storage/json-file-store';

const FILE_NAME = 'presence.json';

// A device counts as "online" while its most recent heartbeat is within this window.
const DEFAULT_TTL_MS = 90_000;
// Hard ceiling on the in-memory recency map so a spammer cannot inflate RAM.
const DEFAULT_MAX_TRACKED = 50_000;
// Online is sampled into the series once per this interval.
const SAMPLE_INTERVAL_MS = 5 * 60_000;
// Series keeps at most 24h of samples (288 points at one per 5 minutes).
const SERIES_WINDOW_MS = 24 * 60 * 60_000;
const MAX_SERIES = 288;
// Daily rollups kept for the last 30 days.
const MAX_DAILY = 30;
// Never touch the disk more often than this (heartbeats are frequent).
const PERSIST_MIN_INTERVAL_MS = 30_000;

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// UTC calendar day, YYYY-MM-DD.
const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// On-disk shape. Deliberately excludes the id -> lastSeen recency map: keeping a
// list of who was online and when would be a privacy leak, and it self-heals from
// heartbeats after a restart anyway. No IP or User-Agent is ever stored here.
interface PresenceSnapshot {
  day: string;
  todayIds: string[];
  todayPeak: number;
  series: PresenceSeriesPoint[];
  daily: PresenceDailyPoint[];
}

const isSeriesPoint = (value: unknown): value is PresenceSeriesPoint =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PresenceSeriesPoint).t === 'number' &&
  typeof (value as PresenceSeriesPoint).online === 'number';

const isDailyPoint = (value: unknown): value is PresenceDailyPoint =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PresenceDailyPoint).day === 'string' &&
  typeof (value as PresenceDailyPoint).uniques === 'number' &&
  typeof (value as PresenceDailyPoint).peak === 'number';

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);

  private readonly ttlMs = parsePositiveInt(process.env.PRESENCE_TTL_MS, DEFAULT_TTL_MS);
  private readonly maxTracked = parsePositiveInt(
    process.env.PRESENCE_MAX_TRACKED,
    DEFAULT_MAX_TRACKED,
  );

  // In-memory only, never persisted: id -> epoch ms of last heartbeat.
  private readonly lastSeen = new Map<string, number>();

  // Persisted composite state.
  private day = utcDay(Date.now());
  private todayIds = new Set<string>();
  private todayPeak = 0;
  private series: PresenceSeriesPoint[] = [];
  private daily: PresenceDailyPoint[] = [];

  // Write serialization + debounce.
  private writeQueue: Promise<void> = Promise.resolve();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPersistAt = 0;

  private sampleTimer: ReturnType<typeof setInterval> | null = null;

  async onModuleInit(): Promise<void> {
    const snapshot = await this.loadSnapshot();
    this.applySnapshot(snapshot);
    // A restart may have straddled a UTC midnight: close out the stale day so its
    // uniques/peak land in `daily` instead of leaking into today's counters.
    this.maybeRollover(Date.now());
    this.logger.log(
      { day: this.day, uniquesToday: this.todayIds.size, days: this.daily.length },
      'presence_state_loaded',
    );
    this.sampleTimer = setInterval(() => this.sample(), SAMPLE_INTERVAL_MS);
    this.sampleTimer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    await this.flush();
  }

  /** Record a heartbeat and return the current live counters. */
  beat(id: string): PresenceCounters {
    const now = Date.now();
    this.maybeRollover(now);
    this.lastSeen.set(id, now);
    this.pruneExpired(now);
    this.enforceCap();
    this.todayIds.add(id);
    const online = this.lastSeen.size;
    if (online > this.todayPeak) {
      this.todayPeak = online;
    }
    this.schedulePersist();
    return { online, uniquesToday: this.todayIds.size };
  }

  /** Public snapshot for the stats endpoint (read-only view). */
  getStats(): PresenceStats {
    const now = Date.now();
    if (this.maybeRollover(now)) {
      this.schedulePersist();
    }
    return {
      online: this.countOnline(now),
      uniquesToday: this.todayIds.size,
      peakToday: this.todayPeak,
      series: this.series.map((point) => ({ ...point })),
      daily: this.daily.map((point) => ({ ...point })),
    };
  }

  /** Sampler tick: prune stale devices, append an online sample, trim the window. */
  sample(): void {
    const now = Date.now();
    this.maybeRollover(now);
    this.pruneExpired(now);
    this.series.push({ t: now, online: this.lastSeen.size });
    this.trimSeries(now);
    this.schedulePersist();
  }

  private countOnline(now: number): number {
    const cutoff = now - this.ttlMs;
    let count = 0;
    for (const seenAt of this.lastSeen.values()) {
      if (seenAt > cutoff) count += 1;
    }
    return count;
  }

  private pruneExpired(now: number): void {
    const cutoff = now - this.ttlMs;
    for (const [id, seenAt] of this.lastSeen) {
      if (seenAt <= cutoff) {
        this.lastSeen.delete(id);
      }
    }
  }

  private enforceCap(): void {
    const overflow = this.lastSeen.size - this.maxTracked;
    if (overflow <= 0) return;
    // Map.set on an existing key keeps its original insertion position, so insertion
    // order is not recency order; sort by lastSeen to evict the genuinely oldest.
    const oldest = [...this.lastSeen.entries()].sort((a, b) => a[1] - b[1]).slice(0, overflow);
    for (const [id] of oldest) {
      this.lastSeen.delete(id);
    }
  }

  private trimSeries(now: number): void {
    const cutoff = now - SERIES_WINDOW_MS;
    this.series = this.series.filter((point) => point.t >= cutoff);
    if (this.series.length > MAX_SERIES) {
      this.series = this.series.slice(-MAX_SERIES);
    }
  }

  /** Roll the day over if the UTC calendar day changed. Returns true if it did. */
  private maybeRollover(now: number): boolean {
    const today = utcDay(now);
    if (today === this.day) return false;
    this.daily.push({ day: this.day, uniques: this.todayIds.size, peak: this.todayPeak });
    if (this.daily.length > MAX_DAILY) {
      this.daily = this.daily.slice(-MAX_DAILY);
    }
    this.todayIds.clear();
    this.todayPeak = 0;
    this.day = today;
    return true;
  }

  private schedulePersist(): void {
    // A timer is already pending; its flush will capture the latest state (toSnapshot
    // reads live fields at write time), so coalesce into it instead of stacking writes.
    if (this.persistTimer) return;
    const elapsed = Date.now() - this.lastPersistAt;
    const delay = Math.max(0, PERSIST_MIN_INTERVAL_MS - elapsed);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.flush();
    }, delay);
    this.persistTimer.unref?.();
  }

  private toSnapshot(): PresenceSnapshot {
    return {
      day: this.day,
      todayIds: [...this.todayIds],
      todayPeak: this.todayPeak,
      series: this.series,
      daily: this.daily,
    };
  }

  private async flush(): Promise<void> {
    this.lastPersistAt = Date.now();
    const snapshot = this.toSnapshot();
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(() => this.writeSnapshot(snapshot));
    await this.writeQueue;
  }

  private async loadSnapshot(): Promise<PresenceSnapshot> {
    const fallback: PresenceSnapshot = {
      day: utcDay(Date.now()),
      todayIds: [],
      todayPeak: 0,
      series: [],
      daily: [],
    };
    return readJsonFile<PresenceSnapshot>(dataFile(FILE_NAME), fallback);
  }

  private async writeSnapshot(snapshot: PresenceSnapshot): Promise<void> {
    await writeJsonFile(dataFile(FILE_NAME), snapshot);
  }

  private applySnapshot(snapshot: PresenceSnapshot): void {
    this.day =
      typeof snapshot.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(snapshot.day)
        ? snapshot.day
        : utcDay(Date.now());
    this.todayIds = new Set(Array.isArray(snapshot.todayIds) ? snapshot.todayIds : []);
    this.todayPeak =
      typeof snapshot.todayPeak === 'number' && snapshot.todayPeak >= 0 ? snapshot.todayPeak : 0;
    this.series = Array.isArray(snapshot.series) ? snapshot.series.filter(isSeriesPoint) : [];
    this.daily = Array.isArray(snapshot.daily) ? snapshot.daily.filter(isDailyPoint) : [];
  }
}
