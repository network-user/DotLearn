import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PresenceService } from './presence.service';

// Keeps every test off the filesystem: the persist chain and initial load are
// stubbed so we exercise pure in-memory logic under fake timers.
const stubDisk = (service: PresenceService): { write: ReturnType<typeof vi.fn> } => {
  const write = vi.fn().mockResolvedValue(undefined);
  const internal = service as unknown as {
    writeSnapshot: (snapshot: unknown) => Promise<void>;
    loadSnapshot: () => Promise<unknown>;
  };
  internal.writeSnapshot = write;
  internal.loadSnapshot = vi.fn().mockResolvedValue({
    day: '2026-01-01',
    todayIds: [],
    todayPeak: 0,
    series: [],
    daily: [],
  });
  return { write };
};

const uuid = (n: number): string =>
  `${n.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;

describe('PresenceService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Midday so nothing rolls over unless a test deliberately crosses UTC midnight.
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('dedups repeated beats from one id into a single online device', () => {
    const service = new PresenceService();
    stubDisk(service);

    service.beat('a');
    service.beat('a');
    const counters = service.beat('a');

    expect(counters.online).toBe(1);
    expect(counters.uniquesToday).toBe(1);
    expect(service.getStats().online).toBe(1);
  });

  it('exposes no extended analytics when PRESENCE_ANALYTICS is off', () => {
    const service = new PresenceService();
    stubDisk(service);

    service.beat('a', '22222222-2222-4222-8222-222222222222', 'git');
    const stats = service.getStats();

    expect(stats.uniquesAllTime).toBeUndefined();
    expect(stats.reading).toBeUndefined();
    expect(service.getAnalytics()).toBeNull();
  });

  it('drops a device from online once its TTL elapses', () => {
    const service = new PresenceService();
    stubDisk(service);

    service.beat('a');
    expect(service.getStats().online).toBe(1);

    // 91s > 90s TTL: 'a' is stale.
    vi.advanceTimersByTime(91_000);
    expect(service.getStats().online).toBe(0);

    // A fresh beat from 'b' does not resurrect 'a'.
    const counters = service.beat('b');
    expect(counters.online).toBe(1);
    // Both were seen on the same UTC day.
    expect(counters.uniquesToday).toBe(2);
  });

  it('counts uniquesToday by distinct id regardless of repeats or expiry', () => {
    const service = new PresenceService();
    stubDisk(service);

    service.beat('a');
    service.beat('b');
    service.beat('c');
    service.beat('a'); // repeat does not increment
    vi.advanceTimersByTime(91_000);
    const counters = service.beat('a'); // expired-then-returning still same unique

    expect(counters.uniquesToday).toBe(3);
    expect(counters.online).toBe(1);
  });

  it('rolls the day over at UTC midnight: daily gains a row and today resets', () => {
    const service = new PresenceService();
    stubDisk(service);

    vi.setSystemTime(new Date('2026-01-01T23:59:00.000Z'));
    service.beat('a');
    service.beat('b'); // peak of 2 concurrent online
    // No completed day yet, but `daily` always carries today's in-progress rollup.
    expect(service.getStats().daily).toEqual([{ day: '2026-01-01', uniques: 2, peak: 2 }]);
    expect(service.getStats().uniquesToday).toBe(2);
    expect(service.getStats().peakToday).toBe(2);

    vi.setSystemTime(new Date('2026-01-02T00:01:00.000Z'));
    const counters = service.beat('c');

    const stats = service.getStats();
    // Yesterday is now a completed row; today ('c' only) is the trailing point.
    expect(stats.daily).toEqual([
      { day: '2026-01-01', uniques: 2, peak: 2 },
      { day: '2026-01-02', uniques: 1, peak: 1 },
    ]);
    expect(counters.uniquesToday).toBe(1);
    expect(stats.uniquesToday).toBe(1);
    // Peak resets with the new day: only 'c' has been online so far.
    expect(stats.peakToday).toBe(1);
    // 'a' and 'b' last beat >90s ago, only 'c' is online.
    expect(stats.online).toBe(1);
  });

  it('rolls over on a stats read even without a beat crossing midnight', () => {
    const service = new PresenceService();
    stubDisk(service);

    vi.setSystemTime(new Date('2026-01-01T23:59:00.000Z'));
    service.beat('a');

    vi.setSystemTime(new Date('2026-01-02T00:05:00.000Z'));
    const stats = service.getStats();

    expect(stats.daily).toEqual([
      { day: '2026-01-01', uniques: 1, peak: 1 },
      { day: '2026-01-02', uniques: 0, peak: 0 },
    ]);
    expect(stats.uniquesToday).toBe(0);
  });

  it('samples online into the series and trims to the 24h window', () => {
    const service = new PresenceService();
    stubDisk(service);

    service.beat('a');
    service.sample();
    const firstPoint = service.getStats().series.at(-1);
    expect(firstPoint?.online).toBe(1);

    // Push samples across more than 24h; older-than-24h points get trimmed and the
    // series never exceeds the 288-point cap.
    for (let i = 0; i < 300; i += 1) {
      vi.advanceTimersByTime(5 * 60_000);
      service.beat('a');
      service.sample();
    }

    const stats = service.getStats();
    const now = Date.now();
    expect(stats.series.length).toBeLessThanOrEqual(288);
    expect(stats.series.every((point) => point.t >= now - 24 * 60 * 60_000)).toBe(true);
    // The stale first sample from 25h ago is gone.
    expect(stats.series.some((point) => point.t === firstPoint?.t)).toBe(false);
  });

  it('caps the in-memory recency map and evicts the oldest devices', () => {
    vi.stubEnv('PRESENCE_MAX_TRACKED', '5');
    const service = new PresenceService();
    stubDisk(service);

    for (let i = 0; i < 20; i += 1) {
      vi.advanceTimersByTime(1); // distinct lastSeen per id, all within TTL
      service.beat(uuid(i));
    }

    // Never exceeds the cap.
    expect(service.getStats().online).toBe(5);
    // uniquesToday still counts every distinct id ever seen today, uncapped.
    expect(service.getStats().uniquesToday).toBe(20);
  });

  it('persists at most once per debounce window, not on every beat', async () => {
    const service = new PresenceService();
    const { write } = stubDisk(service);

    service.beat('a');
    service.beat('b');
    service.beat('c');
    // Leading write fires ~immediately (lastPersistAt was 0).
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(1);

    // Further beats inside the 30s window coalesce into a single later write.
    service.beat('d');
    service.beat('e');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('wires the sampler on init and stops it on destroy, flushing on shutdown', async () => {
    const service = new PresenceService();
    const { write } = stubDisk(service);

    await service.onModuleInit();
    service.beat('a');

    const before = service.getStats().series.length;
    await vi.advanceTimersByTimeAsync(5 * 60_000); // interval fires sample()
    expect(service.getStats().series.length).toBe(before + 1);

    await service.onModuleDestroy();
    const afterDestroy = service.getStats().series.length;
    await vi.advanceTimersByTimeAsync(30 * 60_000); // no further samples once the interval is cleared
    expect(service.getStats().series.length).toBe(afterDestroy);
    expect(write).toHaveBeenCalled();
  });

  it('throttles pruning: the first beat sweeps stale devices, an immediate second beat does not', () => {
    const service = new PresenceService();
    stubDisk(service);
    const internal = service as unknown as { lastSeen: Map<string, number> };

    // Two devices last seen past the 90s TTL sit in the recency map.
    internal.lastSeen.set('stale-1', Date.now() - 91_000);
    internal.lastSeen.set('stale-2', Date.now() - 91_000);

    // The first beat is outside any throttle window (lastPruneAt starts at 0): it
    // prunes, clearing both stale devices.
    service.beat('fresh-1');
    expect(internal.lastSeen.has('stale-1')).toBe(false);
    expect(internal.lastSeen.has('stale-2')).toBe(false);

    // A stale device seeded now, then another beat in the same instant, survives:
    // that beat is inside the 5s throttle window, so pruning is skipped.
    internal.lastSeen.set('stale-3', Date.now() - 91_000);
    service.beat('fresh-2');
    expect(internal.lastSeen.has('stale-3')).toBe(true);
  });

  it('reports online by freshness, so a stale device left un-pruned by the throttle is not counted', () => {
    const service = new PresenceService();
    stubDisk(service);
    const internal = service as unknown as {
      lastSeen: Map<string, number>;
      lastPruneAt: number;
    };

    // A stale device the throttle has not swept yet: a recent lastPruneAt makes the
    // next beat skip pruning, so the device lingers in the raw map.
    internal.lastSeen.set('stale', Date.now() - 91_000);
    internal.lastPruneAt = Date.now();

    const counters = service.beat('fresh');

    // Still present in the map (prune was throttled)...
    expect(internal.lastSeen.has('stale')).toBe(true);
    // ...but the reported count comes from countOnline's freshness filter, not map size.
    expect(counters.online).toBe(1);
  });
});

describe('PresenceService analytics (enabled)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    vi.stubEnv('PRESENCE_ANALYTICS', '1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('estimates all-time unique visitors from stable ids, ignoring repeats', () => {
    const service = new PresenceService();
    stubDisk(service);

    for (let i = 0; i < 400; i += 1) service.beat(uuid(i), `visitor-${i}`, 'git');
    // A second full pass of the very same visitors must not inflate the estimate.
    for (let i = 0; i < 400; i += 1) service.beat(uuid(i), `visitor-${i}`, 'git');

    const stats = service.getStats();
    expect(stats.uniquesToday).toBe(400);
    expect(stats.uniquesAllTime).toBeGreaterThan(376); // within ~6% of 400
    expect(stats.uniquesAllTime).toBeLessThan(424);
  });

  it('breaks down reading-now by topic over online devices', () => {
    const service = new PresenceService();
    stubDisk(service);

    service.beat(uuid(1), 'v-1', 'git');
    service.beat(uuid(2), 'v-2', 'git');
    service.beat(uuid(3), 'v-3', 'python');

    expect(service.getStats().reading).toEqual([
      { topic: 'git', count: 2 },
      { topic: 'python', count: 1 },
    ]);
  });

  it('builds per-topic analytics with reading-now and all-time uniques', () => {
    const service = new PresenceService();
    stubDisk(service);

    for (let i = 0; i < 300; i += 1) service.beat(uuid(i), `v-${i}`, 'git');

    const analytics = service.getAnalytics();
    expect(analytics).not.toBeNull();
    const git = analytics?.topics.find((topic) => topic.topic === 'git');
    expect(git?.readingNow).toBe(300);
    expect(git?.uniquesAllTime).toBeGreaterThan(282); // within ~6% of 300
    expect(git?.uniquesAllTime).toBeLessThan(318);
  });

  it('keeps peakAllTime and banks totalVisitorDays across a day rollover', () => {
    const service = new PresenceService();
    stubDisk(service);

    vi.setSystemTime(new Date('2026-01-01T23:59:00.000Z'));
    service.beat(uuid(1), 'v-1', 'git');
    service.beat(uuid(2), 'v-2', 'git'); // peak of 2 today
    expect(service.getStats().peakAllTime).toBe(2);

    vi.setSystemTime(new Date('2026-01-02T00:01:00.000Z'));
    service.beat(uuid(3), 'v-3', 'python'); // new day; yesterday's two devices are stale

    const stats = service.getStats();
    expect(stats.peakToday).toBe(1); // resets with the new day
    expect(stats.peakAllTime).toBe(2); // all-time peak survives
    expect(stats.totalVisitorDays).toBe(2); // yesterday's uniques banked
  });

  it('dedups unique visitors across days for the rolling windows', () => {
    const service = new PresenceService();
    stubDisk(service);

    vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
    for (let i = 0; i < 200; i += 1) service.beat(uuid(i), `d1-${i}`, 'git');

    vi.setSystemTime(new Date('2026-01-02T12:00:00.000Z'));
    for (let i = 0; i < 200; i += 1) service.beat(uuid(500 + i), `d2-${i}`, 'git');

    const stats = service.getStats();
    // 200 distinct visitors on each of two days = ~400 unique over the window.
    expect(stats.uniques7d).toBeGreaterThan(372);
    expect(stats.uniques7d).toBeLessThan(428);
    expect(stats.uniques30d).toBe(stats.uniques7d);
  });
});
