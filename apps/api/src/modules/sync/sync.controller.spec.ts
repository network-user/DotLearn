import { BadRequestException } from '@nestjs/common';
import {
  SyncCreateInput,
  SyncDeleteInput,
  SyncLinkInput,
  SyncPullInput,
  SyncPushInput,
} from '@dotlearn/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ZodBodyPipe } from '../../common/zod/zod-body.pipe';
import { SyncController } from './sync.controller';
import type { SyncService } from './sync.service';

interface SyncServiceMock {
  create: ReturnType<typeof vi.fn>;
  link: ReturnType<typeof vi.fn>;
  pull: ReturnType<typeof vi.fn>;
  push: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

const VALID_CODE = '0123456789AB';
const VALID_BLOB = 'aGVsbG8=';

describe('SyncController', () => {
  let controller: SyncController;
  let sync: SyncServiceMock;

  beforeEach(() => {
    sync = {
      create: vi.fn(),
      link: vi.fn(),
      pull: vi.fn(),
      push: vi.fn(),
      remove: vi.fn(),
    };
    controller = new SyncController(sync as unknown as SyncService);
  });

  it('create() delegates to the service with no arguments', () => {
    sync.create.mockResolvedValue({ code: VALID_CODE, rev: 0 });
    const result = controller.create({});
    expect(sync.create).toHaveBeenCalledWith();
    return expect(result).resolves.toEqual({ code: VALID_CODE, rev: 0 });
  });

  it('link() delegates to the service with the body code', () => {
    sync.link.mockResolvedValue({ rev: 0, updatedAt: 1, size: 0 });
    controller.link({ code: VALID_CODE });
    expect(sync.link).toHaveBeenCalledWith(VALID_CODE);
  });

  it('pull() delegates to the service with code and sinceRev', () => {
    sync.pull.mockResolvedValue({ changed: false, rev: 2 });
    controller.pull({ code: VALID_CODE, sinceRev: 2 });
    expect(sync.pull).toHaveBeenCalledWith(VALID_CODE, 2);
  });

  it('pull() forwards an undefined sinceRev untouched', () => {
    sync.pull.mockResolvedValue({ changed: false, rev: 0 });
    controller.pull({ code: VALID_CODE });
    expect(sync.pull).toHaveBeenCalledWith(VALID_CODE, undefined);
  });

  it('push() delegates to the service with code, baseRev and blob', () => {
    sync.push.mockResolvedValue({ rev: 1, updatedAt: 1 });
    controller.push({ code: VALID_CODE, baseRev: 0, blob: VALID_BLOB });
    expect(sync.push).toHaveBeenCalledWith(VALID_CODE, 0, VALID_BLOB);
  });

  it('delete() delegates to the service remove() with the body code', () => {
    sync.remove.mockResolvedValue({ deleted: true });
    controller.delete({ code: VALID_CODE });
    expect(sync.remove).toHaveBeenCalledWith(VALID_CODE);
  });
});

describe('sync input validation via ZodBodyPipe', () => {
  it('SyncCreateInput accepts an empty body and rejects extra keys', () => {
    const pipe = new ZodBodyPipe(SyncCreateInput);
    expect(pipe.transform({})).toEqual({});
    expect(() => pipe.transform({ extra: 1 })).toThrow(BadRequestException);
  });

  it('SyncLinkInput accepts a valid code and rejects a malformed one', () => {
    const pipe = new ZodBodyPipe(SyncLinkInput);
    expect(pipe.transform({ code: VALID_CODE })).toEqual({ code: VALID_CODE });
    expect(() => pipe.transform({ code: 'not-a-code' })).toThrow(BadRequestException);
    expect(() => pipe.transform({})).toThrow(BadRequestException);
  });

  it('SyncPullInput accepts an optional sinceRev and rejects a negative one', () => {
    const pipe = new ZodBodyPipe(SyncPullInput);
    expect(pipe.transform({ code: VALID_CODE })).toEqual({ code: VALID_CODE });
    expect(pipe.transform({ code: VALID_CODE, sinceRev: 3 })).toEqual({
      code: VALID_CODE,
      sinceRev: 3,
    });
    expect(() => pipe.transform({ code: VALID_CODE, sinceRev: -1 })).toThrow(BadRequestException);
  });

  it('SyncPushInput accepts a well-formed push and rejects a non-base64 blob', () => {
    const pipe = new ZodBodyPipe(SyncPushInput);
    expect(pipe.transform({ code: VALID_CODE, baseRev: 0, blob: VALID_BLOB })).toEqual({
      code: VALID_CODE,
      baseRev: 0,
      blob: VALID_BLOB,
    });
    expect(() => pipe.transform({ code: VALID_CODE, baseRev: 0, blob: 'not base64!!' })).toThrow(
      BadRequestException,
    );
    expect(() => pipe.transform({ code: VALID_CODE, baseRev: 0 })).toThrow(BadRequestException);
  });

  it('SyncDeleteInput accepts a valid code and rejects a missing one', () => {
    const pipe = new ZodBodyPipe(SyncDeleteInput);
    expect(pipe.transform({ code: VALID_CODE })).toEqual({ code: VALID_CODE });
    expect(() => pipe.transform({})).toThrow(BadRequestException);
  });
});

describe('SyncController throttle metadata', () => {
  const hasThrottleLimit = (fn: (...args: never[]) => unknown): boolean =>
    Reflect.getMetadataKeys(fn).some(
      (key) => typeof key === 'string' && key.startsWith('THROTTLER:LIMIT'),
    );

  it.each([
    ['create', SyncController.prototype.create],
    ['link', SyncController.prototype.link],
    ['pull', SyncController.prototype.pull],
    ['push', SyncController.prototype.push],
    ['delete', SyncController.prototype.delete],
  ])('%s carries throttle limit metadata', (_name, method) => {
    expect(hasThrottleLimit(method)).toBe(true);
  });
});
