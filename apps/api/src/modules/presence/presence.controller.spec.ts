import { BadRequestException } from '@nestjs/common';
import { PresenceBeatInput } from '@dotlearn/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ZodBodyPipe } from '../../common/zod/zod-body.pipe';
import { PresenceController } from './presence.controller';
import type { PresenceService } from './presence.service';

interface PresenceServiceMock {
  beat: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
}

const VALID_ID = '11111111-1111-4111-8111-111111111111';

describe('PresenceController', () => {
  let controller: PresenceController;
  let presence: PresenceServiceMock;

  beforeEach(() => {
    presence = {
      beat: vi.fn(),
      getStats: vi.fn(),
    };
    controller = new PresenceController(presence as unknown as PresenceService);
  });

  it('delegates a beat to the service with the body id', () => {
    presence.beat.mockReturnValue({ online: 3, uniquesToday: 7 });
    const result = controller.beat({ id: VALID_ID });
    expect(presence.beat).toHaveBeenCalledWith(VALID_ID);
    expect(result).toEqual({ online: 3, uniquesToday: 7 });
  });

  it('delegates stats to the service', () => {
    const stats = { online: 1, uniquesToday: 1, series: [], daily: [] };
    presence.getStats.mockReturnValue(stats);
    expect(controller.stats()).toBe(stats);
  });
});

describe('PresenceBeatInput validation via ZodBodyPipe', () => {
  const pipe = new ZodBodyPipe(PresenceBeatInput);

  it('accepts a valid UUID v4 body', () => {
    expect(pipe.transform({ id: VALID_ID })).toEqual({ id: VALID_ID });
  });

  it('rejects a non-UUID id', () => {
    expect(() => pipe.transform({ id: 'not-a-uuid' })).toThrow(BadRequestException);
  });

  it('rejects a non-v4 UUID (wrong version nibble)', () => {
    // Valid UUID shape but version 1.
    expect(() => pipe.transform({ id: '11111111-1111-1111-8111-111111111111' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a missing id', () => {
    expect(() => pipe.transform({})).toThrow(BadRequestException);
  });

  it('rejects extra keys because the schema is strict', () => {
    expect(() => pipe.transform({ id: VALID_ID, extra: 'x' })).toThrow(BadRequestException);
  });
});
