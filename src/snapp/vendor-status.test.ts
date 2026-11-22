import { describe, expect, it } from 'vitest';

import { isSnappVendorActive, normalizeSnappVendorStatus } from './vendor-status';

describe('SnappShop vendor status', () => {
  it('normalizes provider status values', () => {
    expect(normalizeSnappVendorStatus(' active ')).toBe('ACTIVE');
    expect(normalizeSnappVendorStatus(null)).toBe('');
  });

  it('only considers ACTIVE branches operational', () => {
    expect(isSnappVendorActive('ACTIVE')).toBe(true);
    expect(isSnappVendorActive('inactive')).toBe(false);
    expect(isSnappVendorActive(undefined)).toBe(false);
  });
});
