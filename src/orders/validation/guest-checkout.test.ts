import { describe, expect, it } from 'vitest';

import { normalizeGuestCheckoutPhone } from './guest-checkout';

describe('guest checkout phone', () => {
  it('normalizes Iranian mobile numbers to the invoice format', () => {
    expect(normalizeGuestCheckoutPhone('۰۹۳۵۴۳۹۵۲۶۴')).toBe('+989354395264');
    expect(normalizeGuestCheckoutPhone('+989354395264')).toBe('+989354395264');
  });

  it('rejects landlines and malformed input', () => {
    expect(normalizeGuestCheckoutPhone('02112345678')).toBeNull();
    expect(normalizeGuestCheckoutPhone('')).toBeNull();
  });
});
