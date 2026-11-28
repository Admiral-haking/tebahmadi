import { describe, expect, it } from 'vitest';

import { TapinError } from './client';
import { isAmbiguousTapinRegistrationFailure } from './manual-registration-safety';

describe('manual Tapin registration safety', () => {
  it('treats upstream/network failures as ambiguous after a register request', () => {
    expect(isAmbiguousTapinRegistrationFailure(new TapinError('timeout', 504))).toBe(true);
    expect(isAmbiguousTapinRegistrationFailure(new TapinError('upstream', 502))).toBe(true);
    expect(isAmbiguousTapinRegistrationFailure(new TapinError('invalid', 422))).toBe(false);
  });
});
