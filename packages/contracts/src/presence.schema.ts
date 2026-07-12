import { z } from 'zod';

// Anonymous, per-device random identifier. The client generates it with
// crypto.randomUUID() (always a v4), so we validate the v4 shape strictly to
// reject garbage without accepting other UUID versions.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Lowercase slug of the topic a device is currently reading. Sent only for the
// aggregate "reading now" / per-topic analytics; never linked to an id on disk.
const TOPIC_SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const PresenceBeatInput = z
  .object({
    id: z.string().regex(UUID_V4, { message: 'id must be a UUID v4' }),
    // Stable (non-rotating) anonymous device id, feeding the all-time unique
    // estimator. Optional so older clients and the analytics-off build still work.
    visitorId: z.string().regex(UUID_V4, { message: 'visitorId must be a UUID v4' }).optional(),
    topic: z.string().regex(TOPIC_SLUG, { message: 'topic must be a slug' }).optional(),
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

// A topic and how many tracked devices are reading it right now.
export const PresenceReadingPoint = z
  .object({
    topic: z.string().regex(TOPIC_SLUG),
    count: z.number().int().min(0),
  })
  .strict();
export type PresenceReadingPoint = z.infer<typeof PresenceReadingPoint>;

export const PresenceStats = z
  .object({
    online: z.number().int().min(0),
    uniquesToday: z.number().int().min(0),
    // Highest simultaneous online seen today (resets at UTC midnight).
    peakToday: z.number().int().min(0),
    series: z.array(PresenceSeriesPoint),
    daily: z.array(PresenceDailyPoint),
    // Extended metrics, present only when analytics is enabled on the server
    // (the deployed build). Omitted entirely on a local/analytics-off instance.
    uniquesAllTime: z.number().int().min(0).optional(),
    uniques7d: z.number().int().min(0).optional(),
    uniques30d: z.number().int().min(0).optional(),
    peakAllTime: z.number().int().min(0).optional(),
    totalVisitorDays: z.number().int().min(0).optional(),
    reading: z.array(PresenceReadingPoint).optional(),
  })
  .strict();
export type PresenceStats = z.infer<typeof PresenceStats>;

// Per-topic daily unique readers (no peak: topics don't track concurrency).
export const PresenceTopicDailyPoint = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    uniques: z.number().int().min(0),
  })
  .strict();
export type PresenceTopicDailyPoint = z.infer<typeof PresenceTopicDailyPoint>;

export const PresenceTopicStat = z
  .object({
    topic: z.string().regex(TOPIC_SLUG),
    readingNow: z.number().int().min(0),
    uniquesAllTime: z.number().int().min(0),
    daily: z.array(PresenceTopicDailyPoint),
  })
  .strict();
export type PresenceTopicStat = z.infer<typeof PresenceTopicStat>;

// Full payload for the dedicated analytics page. Available only when analytics
// is enabled; the endpoint 404s otherwise. Extended metrics are required here.
export const PresenceAnalytics = PresenceStats.extend({
  uniquesAllTime: z.number().int().min(0),
  uniques7d: z.number().int().min(0),
  uniques30d: z.number().int().min(0),
  peakAllTime: z.number().int().min(0),
  totalVisitorDays: z.number().int().min(0),
  reading: z.array(PresenceReadingPoint),
  topics: z.array(PresenceTopicStat),
});
export type PresenceAnalytics = z.infer<typeof PresenceAnalytics>;
