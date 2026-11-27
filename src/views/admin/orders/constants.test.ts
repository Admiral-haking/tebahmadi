import { describe, expect, it } from 'vitest';

import { getProgressLabel } from './constants';

describe('getProgressLabel', () => {
  it('returns a fallback for progress values not known by the admin UI', () => {
    expect(getProgressLabel('unexpected-state')).toBe('وضعیت نامشخص');
  });

  it('returns the localized label for a known progress value', () => {
    expect(getProgressLabel('in-progress')).toBe('در حال آماده‌سازی');
  });
});
