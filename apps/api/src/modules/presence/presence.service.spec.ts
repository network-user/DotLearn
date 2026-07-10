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
    expect(service.getStats().daily).toHaveLength(0);
    expect(service.getStats().uniquesToday).toBe(2);

    vi.setSystemTime(new Date('2026-01-02T00:01:00.000Z'));
    const counters = service.beat('c');

    const stats = service.getStats();
    expect(stats.daily).toEqual([{ day: '2026-01-01', uniques: 2, peak: 2 }]);
    expect(counters.uniquesToday).toBe(1);
    expect(stats.uniquesToday).toBe(1);
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

    expect(stats.daily).toEqual([{ day: '2026-01-01', uniques: 1, peak: 1 }]);
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
});
