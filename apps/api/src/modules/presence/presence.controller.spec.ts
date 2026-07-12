import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PresenceBeatInput } from '@dotlearn/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ZodBodyPipe } from '../../common/zod/zod-body.pipe';
import { PresenceController } from './presence.controller';
import type { PresenceService } from './presence.service';

interface PresenceServiceMock {
  beat: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
  getAnalytics: ReturnType<typeof vi.fn>;
}

const VALID_ID = '11111111-1111-4111-8111-111111111111';
const VALID_VISITOR = '22222222-2222-4222-8222-222222222222';

describe('PresenceController', () => {
  let controller: PresenceController;
  let presence: PresenceServiceMock;

  beforeEach(() => {
    presence = {
      beat: vi.fn(),
      getStats: vi.fn(),
      getAnalytics: vi.fn(),
    };
    controller = new PresenceController(presence as unknown as PresenceService);
  });

  it('delegates a beat to the service with id, visitorId and topic', () => {
    presence.beat.mockReturnValue({ online: 3, uniquesToday: 7 });
    const result = controller.beat({ id: VALID_ID, visitorId: VALID_VISITOR, topic: 'git' });
    expect(presence.beat).toHaveBeenCalledWith(VALID_ID, VALID_VISITOR, 'git');
    expect(result).toEqual({ online: 3, uniquesToday: 7 });
  });

  it('passes undefined for an omitted visitorId and topic', () => {
    presence.beat.mockReturnValue({ online: 1, uniquesToday: 1 });
    controller.beat({ id: VALID_ID });
    expect(presence.beat).toHaveBeenCalledWith(VALID_ID, undefined, undefined);
  });

  it('delegates stats to the service', () => {
    const stats = { online: 1, uniquesToday: 1, peakToday: 1, series: [], daily: [] };
    presence.getStats.mockReturnValue(stats);
    expect(controller.stats()).toBe(stats);
  });

  it('returns analytics when the service provides them', () => {
    const analytics = { online: 1, topics: [] };
    presence.getAnalytics.mockReturnValue(analytics);
    expect(controller.analytics()).toBe(analytics);
  });

  it('404s when analytics is disabled (service returns null)', () => {
    presence.getAnalytics.mockReturnValue(null);
    expect(() => controller.analytics()).toThrow(NotFoundException);
  });
});

describe('PresenceBeatInput validation via ZodBodyPipe', () => {
  const pipe = new ZodBodyPipe(PresenceBeatInput);

  it('accepts a valid UUID v4 body', () => {
    expect(pipe.transform({ id: VALID_ID })).toEqual({ id: VALID_ID });
  });

  it('accepts an optional visitorId and topic slug', () => {
    expect(pipe.transform({ id: VALID_ID, visitorId: VALID_VISITOR, topic: 'db-indexes' })).toEqual(
      {
        id: VALID_ID,
        visitorId: VALID_VISITOR,
        topic: 'db-indexes',
      },
    );
  });

  it('rejects a topic that is not a slug', () => {
    expect(() => pipe.transform({ id: VALID_ID, topic: 'Not A Slug!' })).toThrow(
      BadRequestException,
    );
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
