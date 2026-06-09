import { z } from 'zod';

import { SLUG_PATTERN } from './topic.schema';

export const HiddenTopic = z
  .object({
    slug: z.string().regex(SLUG_PATTERN),
    hiddenAt: z.string().datetime(),
    reason: z.string().max(500).optional(),
  })
  .strict();
export type HiddenTopic = z.infer<typeof HiddenTopic>;

export const HideTopicInput = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();
export type HideTopicInput = z.infer<typeof HideTopicInput>;
