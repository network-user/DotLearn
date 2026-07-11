import { z } from 'zod';

// Anonymous cross-device sync. A sync code is minted server-side from 64
// random bits rendered as 12 chars of Crockford base32 (no I/L/O/U). The
// server stores only sha256(code); the code itself is the bearer secret and
// travels exclusively in POST bodies so it never reaches URL logs.
export const SYNC_CODE_LENGTH = 12;
export const SYNC_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SYNC_CODE_CANONICAL = /^[0-9A-HJKMNP-TV-Z]{12}$/;

// Hard protocol cap for the opaque snapshot blob: base64 of 1 MiB of bytes.
// The server may enforce a lower (env-configured) limit on decoded size.
export const SYNC_BLOB_MAX_CHARS = 1_398_104;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Canonicalize user input into the form the schemas accept: uppercase, strip
 * separators, map the confusable characters Crockford base32 excludes.
 * Returns a string that may still fail SyncCode validation (e.g. wrong
 * length) - callers validate after normalizing.
 */
export function normalizeSyncCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

/** Display form: XXXX-XXXX-XXXX. */
export function formatSyncCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-');
}

export const SyncCode = z.string().regex(SYNC_CODE_CANONICAL, { message: 'invalid sync code' });
export type SyncCode = z.infer<typeof SyncCode>;

export const SyncBlob = z
  .string()
  .min(4)
  .max(SYNC_BLOB_MAX_CHARS)
  .regex(BASE64, { message: 'blob must be base64' })
  .refine((s) => s.length % 4 === 0, { message: 'blob must be base64' });
export type SyncBlob = z.infer<typeof SyncBlob>;

const Rev = z.number().int().min(0);
const EpochMs = z.number().int().nonnegative();
const Size = z.number().int().nonnegative();

export const SyncCreateInput = z.object({}).strict();
export type SyncCreateInput = z.infer<typeof SyncCreateInput>;

export const SyncCreateOutput = z.object({ code: SyncCode, rev: Rev }).strict();
export type SyncCreateOutput = z.infer<typeof SyncCreateOutput>;

export const SyncLinkInput = z.object({ code: SyncCode }).strict();
export type SyncLinkInput = z.infer<typeof SyncLinkInput>;

export const SyncLinkOutput = z.object({ rev: Rev, updatedAt: EpochMs, size: Size }).strict();
export type SyncLinkOutput = z.infer<typeof SyncLinkOutput>;

export const SyncPullInput = z.object({ code: SyncCode, sinceRev: Rev.optional() }).strict();
export type SyncPullInput = z.infer<typeof SyncPullInput>;

export const SyncPullOutput = z.discriminatedUnion('changed', [
  z.object({ changed: z.literal(false), rev: Rev }).strict(),
  z
    .object({
      changed: z.literal(true),
      rev: Rev,
      updatedAt: EpochMs,
      size: Size,
      blob: SyncBlob,
    })
    .strict(),
]);
export type SyncPullOutput = z.infer<typeof SyncPullOutput>;

export const SyncPushInput = z.object({ code: SyncCode, baseRev: Rev, blob: SyncBlob }).strict();
export type SyncPushInput = z.infer<typeof SyncPushInput>;

export const SyncPushOutput = z.object({ rev: Rev, updatedAt: EpochMs }).strict();
export type SyncPushOutput = z.infer<typeof SyncPushOutput>;

// 409 payload surfaced under error.details by the API's exception filter when
// a push races another device. The client re-pulls, re-merges and retries.
export const SyncPushConflict = z
  .object({ code: z.literal('REV_CONFLICT'), currentRev: Rev })
  .strict();
export type SyncPushConflict = z.infer<typeof SyncPushConflict>;

export const SyncDeleteInput = z.object({ code: SyncCode }).strict();
export type SyncDeleteInput = z.infer<typeof SyncDeleteInput>;

export const SyncDeleteOutput = z.object({ deleted: z.literal(true) }).strict();
export type SyncDeleteOutput = z.infer<typeof SyncDeleteOutput>;
