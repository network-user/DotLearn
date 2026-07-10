import { z } from 'zod';

// Anonymous, per-device random identifier. The client generates it with
// crypto.randomUUID() (always a v4), so we validate the v4 shape strictly to
// reject garbage without accepting other UUID versions.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PresenceBeatInput = z
  .object({
    id: z.string().regex(UUID_V4, { message: 'id must be a UUID v4' }),
  })
  .strict();
export type PresenceBeatInput = z.infer<typeof PresenceBeatInput>;

export const PresenceCounters = z
  .object({
    online: z.number().int().min(0),
    uniquesToday: z.number().int().min(0),
  })
  .strict();
export type PresenceCounters = z.infer<typeof PresenceCounters>;

export const PresenceSeriesPoint = z
  .object({
    // epoch milliseconds of the 5-minute online sample
    t: z.number().int().nonnegative(),
    online: z.number().int().min(0),
  })
  .strict();
export type PresenceSeriesPoint = z.infer<typeof PresenceSeriesPoint>;

export const PresenceDailyPoint = z
  .object({
    // UTC calendar day, YYYY-MM-DD
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    uniques: z.number().int().min(0),
    peak: z.number().int().min(0),
  })
  .strict();
export type PresenceDailyPoint = z.infer<typeof PresenceDailyPoint>;

export const PresenceStats = z
  .object({
    online: z.number().int().min(0),
    uniquesToday: z.number().int().min(0),
    series: z.array(PresenceSeriesPoint),
    daily: z.array(PresenceDailyPoint),
  })
  .strict();
export type PresenceStats = z.infer<typeof PresenceStats>;
