import { describe, expect, it } from 'vitest';

import { normalizeAndValidateShippingAddress } from './shipping-address';

describe('normalizeAndValidateShippingAddress', () => {
  it('normalizes Persian digits and Iranian mobile numbers', () => {
    const result = normalizeAndValidateShippingAddress({
      fname: ' علی ',
      lname: ' احمدی ',
      phone: '۰۹۱۲۰۰۰۰۰۰۰',
      state: ' خراسان رضوی ',
      city: ' مشهد ',
      address: ' بلوار سجاد، پلاک ۱۲ ',
      postalCode: '۹۱۸۷۶۵۴۳۲۱',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('+989120000000');
      expect(result.data.postalCode).toBe('9187654321');
      expect(result.data.fname).toBe('علی');
    }
  });

  it('accepts the +98 mobile form', () => {
    const result = normalizeAndValidateShippingAddress({
      fname: 'علی', lname: 'احمدی', phone: '+989120000000',
      state: 'تهران', city: 'تهران', address: 'خیابان ولیعصر، پلاک ۲۴', postalCode: '1234567890',
    });

    expect(result.success).toBe(true);
  });

  it.each([
    ['missing province', { state: '' }],
    ['missing city', { city: '' }],
    ['missing address', { address: '' }],
    ['invalid postal code', { postalCode: '1234' }],
    ['invalid phone', { phone: '02112345678' }],
  ])('rejects %s', (_label, override) => {
    const result = normalizeAndValidateShippingAddress({
      fname: 'علی', lname: 'احمدی', phone: '09120000000',
      state: 'تهران', city: 'تهران', address: 'خیابان ولیعصر، پلاک ۲۴', postalCode: '1234567890',
      ...override,
    });

    expect(result.success).toBe(false);
  });
});
