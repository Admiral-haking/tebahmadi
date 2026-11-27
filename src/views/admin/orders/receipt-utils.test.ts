import { describe, expect, it } from 'vitest';

import { getReceiptAddress } from './receipt-utils';

describe('getReceiptAddress', () => {
  it('returns a safe fallback when site information has no addresses', () => {
    expect(getReceiptAddress({ addresses: [] })).toBe('—');
  });
});
