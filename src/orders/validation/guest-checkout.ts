import { normalizeAndValidateShippingAddress } from './shipping-address';

/**
 * Guest checkout stores the same canonical phone format as authenticated
 * invoices. Full address validation remains the responsibility of the checkout
 * action; this helper only answers whether a guest phone can identify a user.
 */
export function normalizeGuestCheckoutPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const result = normalizeAndValidateShippingAddress({
    fname: 'مهمان',
    lname: 'خرید',
    phone: value,
    state: 'نامشخص',
    city: 'نامشخص',
    address: 'نامشخص',
    postalCode: '0000000000',
  });
  return result.success ? result.data.phone : null;
}
