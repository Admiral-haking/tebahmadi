import { describe, expect, it } from 'vitest';

import {
  CHECKOUT_ATTEMPT_KEY_MAX_LENGTH,
  createCheckoutAttemptKey,
  normalizeCheckoutAttemptKey,
  shouldReuseCheckoutAttempt,
} from './checkout-session';

describe('checkout session helpers', () => {
  it('creates a bounded, non-empty attempt key', () => {
    const key = createCheckoutAttemptKey({ now: 1732272000000, random: 'abc123' });

    expect(key).toBe('tebahmadi-1732272000000-abc123');
    expect(key.length).toBeLessThanOrEqual(CHECKOUT_ATTEMPT_KEY_MAX_LENGTH);
  });

  it('normalizes persisted keys and rejects invalid values', () => {
    expect(normalizeCheckoutAttemptKey('  checkout-123  ')).toBe('checkout-123');
    expect(normalizeCheckoutAttemptKey('')).toBeNull();
    expect(normalizeCheckoutAttemptKey('x'.repeat(200))).toHaveLength(CHECKOUT_ATTEMPT_KEY_MAX_LENGTH);
  });

  it('reuses the same key during a retry instead of creating a duplicate checkout', () => {
    expect(shouldReuseCheckoutAttempt('checkout-123')).toBe(true);
    expect(shouldReuseCheckoutAttempt('   ')).toBe(false);
    expect(shouldReuseCheckoutAttempt(null)).toBe(false);
  });
});
