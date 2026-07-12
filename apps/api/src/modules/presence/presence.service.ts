import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Injectable, Logger } from '@nestjs/common';

import type {
  PresenceAnalytics,
  PresenceCounters,
  PresenceDailyPoint,
  PresenceReadingPoint,
  PresenceSeriesPoint,
  PresenceStats,
  PresenceTopicDailyPoint,
  PresenceTopicStat,
} from '@dotlearn/contracts';

import { dataFile } from '../../common/config/data-paths';
import { readJsonFile, writeJsonFile } from '../../common/storage/json-file-store';
import { HyperLogLog, mergedCount } from './hyperloglog';

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
// Stale devices are pruned from the recency map at most this often on the beat
// path; countOnline filters by freshness at read time so an un-pruned stale
// entry never inflates a reported count.
const PRUNE_MIN_INTERVAL_MS = 5_000;

// Analytics (deploy-only). HyperLogLog precisions, chosen for a small memory
// footprint on a constrained server: 2^p bytes each.
const HLL_P_ALLTIME = 14; // ~16 KB, ~0.8% error — the headline all-time number
const HLL_P_DAILY = 12; // ~4 KB — per-day sketch, merged for rolling 7d/30d unique
const HLL_P_TOPIC = 11; // ~2 KB — per-topic all-time unique readers
// Most-read topics returned in the live "reading now" breakdown.
const MAX_READING = 8;

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBool = (raw: string | undefined): boolean =>
  raw === '1' || (typeof raw === 'string' && raw.toLowerCase() === 'true');

// UTC calendar day, YYYY-MM-DD.
const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

// Persisted per-topic analytics for one topic.
interface TopicSnapshot {
  hll?: string;
  today?: string[];
  daily?: PresenceTopicDailyPoint[];
}

// On-disk shape. Deliberately excludes the id -> lastSeen recency map and the
// id -> topic map: keeping a list of who was online, when, and what they read
// would be a privacy leak, and both self-heal from heartbeats after a restart.
// No IP or User-Agent is ever stored here. The analytics.* fields are absent on
// pre-analytics snapshots and default to empty; they round-trip untouched even
// when analytics is disabled, so a disabled instance never drops existing data.
interface PresenceSnapshot {
  day: string;
  todayIds: string[];
  todayPeak: number;
  series: PresenceSeriesPoint[];
  daily: PresenceDailyPoint[];
  allTimeHll?: string;
  dailyHll?: string;
  dailyHllRing?: string[];
  peakAllTime?: number;
  totalVisitorDays?: number;
  topics?: Record<string, TopicSnapshot>;
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

const isTopicDailyPoint = (value: unknown): value is PresenceTopicDailyPoint =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PresenceTopicDailyPoint).day === 'string' &&
  typeof (value as PresenceTopicDailyPoint).uniques === 'number';

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);

  private readonly ttlMs = parsePositiveInt(process.env.PRESENCE_TTL_MS, DEFAULT_TTL_MS);
  private readonly maxTracked = parsePositiveInt(
    process.env.PRESENCE_MAX_TRACKED,
    DEFAULT_MAX_TRACKED,
  );
  // Extended analytics (all-time unique, rolling windows, per-topic) are computed
  // and exposed only when enabled — the deployed build sets this. Off by default,
  // so a local instance does no extra work and exposes only the basic counters.
  private readonly analyticsEnabled = parseBool(process.env.PRESENCE_ANALYTICS);

  // In-memory only, never persisted: id -> epoch ms of last heartbeat.
  private readonly lastSeen = new Map<string, number>();
  // In-memory only, never persisted: id -> topic slug it is currently reading.
  private readonly deviceTopic = new Map<string, string>();

  // Persisted composite state.
  private day = utcDay(Date.now());
  private todayIds = new Set<string>();
  private todayPeak = 0;
  private series: PresenceSeriesPoint[] = [];
  private daily: PresenceDailyPoint[] = [];

  // Persisted analytics state (only mutated when analyticsEnabled).
  private allTimeHll = new HyperLogLog(HLL_P_ALLTIME);
  private dailyHll = new HyperLogLog(HLL_P_DAILY);
  private dailyHllRing: HyperLogLog[] = [];
  private peakAllTime = 0;
  private totalVisitorDays = 0;
  private topicHll = new Map<string, HyperLogLog>();
  private topicToday = new Map<string, Set<string>>();
  private topicDaily = new Map<string, PresenceTopicDailyPoint[]>();

  // Write serialization + debounce.
  private writeQueue: Promise<void> = Promise.resolve();
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPersistAt = 0;

  private sampleTimer: ReturnType<typeof setInterval> | null = null;

  private lastPruneAt = 0;

  async onModuleInit(): Promise<void> {
    const snapshot = await this.loadSnapshot();
    this.applySnapshot(snapshot);
    // A restart may have straddled a UTC midnight: close out the stale day so its
    // uniques/peak land in `daily` instead of leaking into today's counters.
    this.maybeRollover(Date.now());
    this.logger.log(
      {
        day: this.day,
        uniquesToday: this.todayIds.size,
        days: this.daily.length,
        analytics: this.analyticsEnabled,
      },
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
  beat(id: string, visitorId?: string, topic?: string): PresenceCounters {
    const now = Date.now();
    this.maybeRollover(now);
    this.lastSeen.set(id, now);
    if (now - this.lastPruneAt >= PRUNE_MIN_INTERVAL_MS) {
      this.pruneExpired(now);
    }
    this.enforceCap();
    this.todayIds.add(id);

    if (this.analyticsEnabled) {
      if (visitorId) {
        this.allTimeHll.add(visitorId);
        this.dailyHll.add(visitorId);
      }
      if (topic) {
        this.deviceTopic.set(id, topic);
        this.trackTopic(id, visitorId, topic);
      }
    }

    const online = this.countOnline(now);
    if (online > this.todayPeak) {
      this.todayPeak = online;
    }
    if (this.analyticsEnabled && online > this.peakAllTime) {
      this.peakAllTime = online;
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
    const base: PresenceStats = {
      online: this.countOnline(now),
      uniquesToday: this.todayIds.size,
      peakToday: this.todayPeak,
      series: this.series.map((point) => ({ ...point })),
      daily: this.dailyWithToday(),
    };
    if (!this.analyticsEnabled) return base;
    return {
      ...base,
      uniquesAllTime: this.allTimeHll.count(),
      uniques7d: this.windowUnique(7),
      uniques30d: this.windowUnique(30),
      peakAllTime: this.peakAllTime,
      totalVisitorDays: this.totalVisitorDays,
      reading: this.computeReading(now),
    };
  }

  /** Full analytics payload for the dedicated page. Null when analytics is off. */
  getAnalytics(): PresenceAnalytics | null {
    if (!this.analyticsEnabled) return null;
    const stats = this.getStats();
    const reading = stats.reading ?? [];
    const readingByTopic = new Map(reading.map((point) => [point.topic, point.count]));

    const slugs = new Set<string>([
      ...this.topicHll.keys(),
      ...this.topicDaily.keys(),
      ...this.topicToday.keys(),
      ...readingByTopic.keys(),
    ]);

    const topics: PresenceTopicStat[] = [...slugs]
      .map((slug) => {
        const daily = [...(this.topicDaily.get(slug) ?? [])];
        const todaySet = this.topicToday.get(slug);
        if (todaySet && todaySet.size > 0) {
          daily.push({ day: this.day, uniques: todaySet.size });
        }
        return {
          topic: slug,
          readingNow: readingByTopic.get(slug) ?? 0,
          uniquesAllTime: this.topicHll.get(slug)?.count() ?? 0,
          daily: daily.slice(-MAX_DAILY),
        } satisfies PresenceTopicStat;
      })
      .sort((a, b) => b.uniquesAllTime - a.uniquesAllTime || b.readingNow - a.readingNow);

    return {
      online: stats.online,
      uniquesToday: stats.uniquesToday,
      peakToday: stats.peakToday,
      series: stats.series,
      daily: stats.daily,
      uniquesAllTime: stats.uniquesAllTime ?? 0,
      uniques7d: stats.uniques7d ?? 0,
      uniques30d: stats.uniques30d ?? 0,
      peakAllTime: stats.peakAllTime ?? 0,
      totalVisitorDays: stats.totalVisitorDays ?? 0,
      reading,
      topics,
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

  /** `daily` history with today's in-progress rollup appended (never persisted). */
  private dailyWithToday(): PresenceDailyPoint[] {
    const withToday = [
      ...this.daily,
      { day: this.day, uniques: this.todayIds.size, peak: this.todayPeak },
    ];
    return withToday.slice(-MAX_DAILY).map((point) => ({ ...point }));
  }

  /** Unique visitors over the last `days` UTC days (inclusive of today). */
  private windowUnique(days: number): number {
    const completed = this.dailyHllRing.slice(-(days - 1));
    return mergedCount([...completed, this.dailyHll]);
  }

  private computeReading(now: number): PresenceReadingPoint[] {
    const cutoff = now - this.ttlMs;
    const counts = new Map<string, number>();
    for (const [id, seenAt] of this.lastSeen) {
      if (seenAt <= cutoff) continue;
      const topic = this.deviceTopic.get(id);
      if (!topic) continue;
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, MAX_READING)
      .map(([topic, count]) => ({ topic, count }));
  }

  private trackTopic(id: string, visitorId: string | undefined, topic: string): void {
    let todaySet = this.topicToday.get(topic);
    if (!todaySet) {
      todaySet = new Set<string>();
      this.topicToday.set(topic, todaySet);
    }
    todaySet.add(id);
    if (visitorId) {
      let hll = this.topicHll.get(topic);
      if (!hll) {
        hll = new HyperLogLog(HLL_P_TOPIC);
        this.topicHll.set(topic, hll);
      }
      hll.add(visitorId);
    }
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
    this.lastPruneAt = now;
    const cutoff = now - this.ttlMs;
    for (const [id, seenAt] of this.lastSeen) {
      if (seenAt <= cutoff) {
        this.lastSeen.delete(id);
        this.deviceTopic.delete(id);
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
      this.deviceTopic.delete(id);
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
    if (this.analyticsEnabled) {
      this.totalVisitorDays += this.todayIds.size;
      this.dailyHllRing.push(this.dailyHll);
      if (this.dailyHllRing.length > MAX_DAILY) {
        this.dailyHllRing = this.dailyHllRing.slice(-MAX_DAILY);
      }
      this.dailyHll = new HyperLogLog(HLL_P_DAILY);
      for (const [slug, ids] of this.topicToday) {
        const history = this.topicDaily.get(slug) ?? [];
        history.push({ day: this.day, uniques: ids.size });
        this.topicDaily.set(slug, history.length > MAX_DAILY ? history.slice(-MAX_DAILY) : history);
      }
      this.topicToday.clear();
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
    const snapshot: PresenceSnapshot = {
      day: this.day,
      todayIds: [...this.todayIds],
      todayPeak: this.todayPeak,
      series: this.series,
      daily: this.daily,
      allTimeHll: this.allTimeHll.toBase64(),
      dailyHll: this.dailyHll.toBase64(),
      dailyHllRing: this.dailyHllRing.map((hll) => hll.toBase64()),
      peakAllTime: this.peakAllTime,
      totalVisitorDays: this.totalVisitorDays,
    };
    const topics: Record<string, TopicSnapshot> = {};
    const slugs = new Set<string>([
      ...this.topicHll.keys(),
      ...this.topicToday.keys(),
      ...this.topicDaily.keys(),
    ]);
    for (const slug of slugs) {
      const entry: TopicSnapshot = {};
      const hll = this.topicHll.get(slug);
      if (hll) entry.hll = hll.toBase64();
      const today = this.topicToday.get(slug);
      if (today && today.size > 0) entry.today = [...today];
      const daily = this.topicDaily.get(slug);
      if (daily && daily.length > 0) entry.daily = daily;
      topics[slug] = entry;
    }
    if (slugs.size > 0) snapshot.topics = topics;
    return snapshot;
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

    this.allTimeHll = this.loadHll(HLL_P_ALLTIME, snapshot.allTimeHll);
    this.dailyHll = this.loadHll(HLL_P_DAILY, snapshot.dailyHll);
    this.dailyHllRing = Array.isArray(snapshot.dailyHllRing)
      ? snapshot.dailyHllRing
          .filter((value): value is string => typeof value === 'string')
          .map((value) => this.loadHll(HLL_P_DAILY, value))
      : [];

    // Seed peak/visitor-days from existing history on first analytics run so a
    // pre-analytics deployment keeps its already-collected numbers.
    const maxDailyPeak = this.daily.reduce((max, point) => Math.max(max, point.peak), 0);
    this.peakAllTime =
      typeof snapshot.peakAllTime === 'number' && snapshot.peakAllTime >= 0
        ? Math.max(snapshot.peakAllTime, this.todayPeak, maxDailyPeak)
        : Math.max(this.todayPeak, maxDailyPeak);
    this.totalVisitorDays =
      typeof snapshot.totalVisitorDays === 'number' && snapshot.totalVisitorDays >= 0
        ? snapshot.totalVisitorDays
        : this.daily.reduce((sum, point) => sum + point.uniques, 0);

    this.topicHll = new Map();
    this.topicToday = new Map();
    this.topicDaily = new Map();
    if (snapshot.topics && typeof snapshot.topics === 'object') {
      for (const [slug, entry] of Object.entries(snapshot.topics)) {
        if (!entry || typeof entry !== 'object') continue;
        if (typeof entry.hll === 'string') {
          this.topicHll.set(slug, this.loadHll(HLL_P_TOPIC, entry.hll));
        }
        if (Array.isArray(entry.today)) {
          this.topicToday.set(
            slug,
            new Set(entry.today.filter((value): value is string => typeof value === 'string')),
          );
        }
        if (Array.isArray(entry.daily)) {
          this.topicDaily.set(slug, entry.daily.filter(isTopicDailyPoint));
        }
      }
    }
  }

  private loadHll(p: number, base64: string | undefined): HyperLogLog {
    if (typeof base64 !== 'string' || base64.length === 0) return new HyperLogLog(p);
    try {
      return HyperLogLog.fromBase64(p, base64);
    } catch {
      return new HyperLogLog(p);
    }
  }
}
