import { describe, expect, it } from 'vitest';

import { invoiceTapinWeight } from './invoice';
import { resolveTapinInsurance, resolveTapinPayType, resolveTapinPrePaidPrice } from './payment';

describe('Tapin shipment helpers', () => {
  it('calculates item weight using quantities and explicit overrides', () => {
    const invoice = {
      lines: [
        { variantId: 'v-1', qty: 2, weightGrams: 120 },
        { variantId: 'v-2', requestedQty: 3, weightGrams: 80 },
      ],
    };

    expect(invoiceTapinWeight(invoice, { itemWeights: [{ variantId: 'v-2', weightGrams: 100 }] })).toBe(540);
  });

  it('derives payment behavior from invoice shipping and requested values', () => {
    expect(resolveTapinPayType({ shippingPaymentMethod: 'on_delivery' }, 1)).toBe(2);
    expect(resolveTapinPayType({ shippingPaymentMethod: 'online' }, 3)).toBe(3);
    expect(resolveTapinPrePaidPrice(0, 1234)).toBe(1234);
    expect(resolveTapinInsurance(2, true)).toBe(false);
    expect(resolveTapinInsurance(1, true)).toBe(true);
  });
});
