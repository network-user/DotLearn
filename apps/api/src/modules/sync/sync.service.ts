import { createHash, randomBytes } from 'node:crypto';

import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  SYNC_CODE_ALPHABET,
  SYNC_CODE_LENGTH,
  type SyncCreateOutput,
  type SyncDeleteOutput,
  type SyncLinkOutput,
  type SyncPullOutput,
  type SyncPushOutput,
} from '@dotlearn/contracts';

import { SyncStore, type SyncIndexEntry } from './sync.store';

const DEFAULT_MAX_BLOB_BYTES = 1_048_576;
const DEFAULT_MAX_CODES = 2_000;
const DEFAULT_TTL_DAYS = 90;

// lastAccessAt only feeds the 90-day GC. Refreshing it on every read would rewrite
// the whole metadata index (PersistentMap.set re-serializes and fsyncs) for no
// functional gain, so bump it at most once per this window per code.
const LAST_ACCESS_BUMP_MIN_MS = 10 * 60_000;

// Hourly TTL sweep; also run opportunistically from create() when at capacity.
const GC_INTERVAL_MS = 60 * 60_000;
// A collision (sha256(code) already in the index) is astronomically unlikely
// at 64 random bits; a handful of retries is just defense in depth.
const MAX_CREATE_ATTEMPTS = 5;
const BITS_PER_CHAR = 5;
const CODE_ENTROPY_BYTES = 8;

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// 64 random bits rendered as 12 chars of 5 bits each (60 of the 64 bits used).
const generateCode = (): string => {
  const bytes = randomBytes(CODE_ENTROPY_BYTES);
  let bits = 0n;
  for (const byte of bytes) {
    bits = (bits << 8n) | BigInt(byte);
  }
  let totalBits = bytes.length * 8;
  let code = '';
  for (let i = 0; i < SYNC_CODE_LENGTH; i += 1) {
    totalBits -= BITS_PER_CHAR;
    const index = Number((bits >> BigInt(totalBits)) & 0b11111n);
    code += SYNC_CODE_ALPHABET[index];
  }
  return code;
};

const hashCode = (code: string): string => createHash('sha256').update(code).digest('hex');

@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);

  private readonly maxBlobBytes = parsePositiveInt(
    process.env.SYNC_MAX_BLOB_BYTES,
    DEFAULT_MAX_BLOB_BYTES,
  );
  private readonly maxCodes = parsePositiveInt(process.env.SYNC_MAX_CODES, DEFAULT_MAX_CODES);
  private readonly ttlMs =
    parsePositiveInt(process.env.SYNC_TTL_DAYS, DEFAULT_TTL_DAYS) * 24 * 60 * 60_000;

  private gcTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly store: SyncStore) {}

  async onModuleInit(): Promise<void> {
    await this.store.load();
    await this.runGc();
    this.gcTimer = setInterval(() => {
      void this.runGc();
    }, GC_INTERVAL_MS);
    this.gcTimer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
    await this.store.flush();
  }

  async create(): Promise<SyncCreateOutput> {
    if (this.store.size >= this.maxCodes) {
      await this.runGc();
      if (this.store.size >= this.maxCodes) {
        throw new ServiceUnavailableException();
      }
    }

    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
      const code = generateCode();
      const key = hashCode(code);
      if (this.store.has(key)) continue;
      const now = Date.now();
      this.store.setEntry(key, {
        rev: 0,
        updatedAt: now,
        lastAccessAt: now,
        size: 0,
        createdAt: now,
      });
      return { code, rev: 0 };
    }
    throw new ServiceUnavailableException();
  }

  async link(code: string): Promise<SyncLinkOutput> {
    const key = hashCode(code);
    const entry = this.store.get(key);
    if (!entry) throw new NotFoundException();
    this.touchAccess(key, entry);
    return { rev: entry.rev, updatedAt: entry.updatedAt, size: entry.size };
  }

  async pull(code: string, sinceRev?: number): Promise<SyncPullOutput> {
    const key = hashCode(code);
    const entry = this.store.get(key);
    if (!entry) throw new NotFoundException();
    this.touchAccess(key, entry);

    if (entry.rev === 0 || sinceRev === entry.rev) {
      return { changed: false, rev: entry.rev };
    }

    const blobFile = await this.store.readBlob(key);
    if (!blobFile) {
      // Defensive: the index claims a rev but the blob file is missing.
      return { changed: false, rev: entry.rev };
    }
    return {
      changed: true,
      rev: entry.rev,
      updatedAt: entry.updatedAt,
      size: entry.size,
      blob: blobFile.blob,
    };
  }

  async push(code: string, baseRev: number, blob: string): Promise<SyncPushOutput> {
    const key = hashCode(code);
    const entry = this.store.get(key);
    if (!entry) throw new NotFoundException();
    if (baseRev !== entry.rev) {
      throw new ConflictException({ code: 'REV_CONFLICT', currentRev: entry.rev });
    }

    const decodedSize = Buffer.from(blob, 'base64').length;
    if (decodedSize > this.maxBlobBytes) {
      throw new BadRequestException('Blob exceeds the maximum size');
    }

    const now = Date.now();
    const nextRev = entry.rev + 1;
    await this.store.writeBlob(key, nextRev, now, blob);
    this.store.setEntry(key, {
      rev: nextRev,
      updatedAt: now,
      lastAccessAt: now,
      size: decodedSize,
      createdAt: entry.createdAt,
    });
    return { rev: nextRev, updatedAt: now };
  }

  async remove(code: string): Promise<SyncDeleteOutput> {
    const key = hashCode(code);
    await this.store.deleteBlob(key);
    this.store.deleteEntry(key);
    return { deleted: true };
  }

  // lastAccessAt drives the idle GC and nothing a response returns, so a read path
  // bumps it only after the window has elapsed: the common case (a client polling
  // every few seconds) then costs zero index writes.
  private touchAccess(key: string, entry: SyncIndexEntry): void {
    const now = Date.now();
    if (now - entry.lastAccessAt < LAST_ACCESS_BUMP_MIN_MS) return;
    this.store.setEntry(key, { ...entry, lastAccessAt: now });
  }

  private async runGc(): Promise<void> {
    const cutoff = Date.now() - this.ttlMs;
    const staleKeys: string[] = [];
    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccessAt < cutoff) staleKeys.push(key);
    }
    for (const key of staleKeys) {
      this.store.deleteEntry(key);
    }
    await Promise.all(staleKeys.map((key) => this.store.deleteBlob(key)));
    if (staleKeys.length > 0) {
      this.logger.log({ evicted: staleKeys.length }, 'sync_gc_evicted');
    }
  }
}
