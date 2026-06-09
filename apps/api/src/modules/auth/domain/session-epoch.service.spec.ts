import { describe, expect, it } from 'vitest';

import { SessionEpochService } from './session-epoch.service';

describe('SessionEpochService', () => {
  it('starts at epoch 0 for an unknown subject', () => {
    const service = new SessionEpochService();
    expect(service.current('admin')).toBe(0);
  });

  it('bump() increments and returns the new epoch', () => {
    const service = new SessionEpochService();
    expect(service.bump('admin')).toBe(1);
    expect(service.bump('admin')).toBe(2);
    expect(service.current('admin')).toBe(2);
  });

  it('tracks epochs per subject independently', () => {
    const service = new SessionEpochService();
    service.bump('admin');
    service.bump('admin');
    expect(service.current('admin')).toBe(2);
    expect(service.current('other')).toBe(0);
  });
});
