import { describe, expect, it } from 'vitest';

import {
  applyQuantityConstraints,
  type CartLine,
  type CartState,
} from './cart-domain';

const baseLine: CartLine = {
  productId: 'product-1',
  productSlug: 'product-1',
  title: 'محصول تستی',
  variantId: 'variant-1',
  sku: 'SKU-1',
  priceModel: 'fixed',
  qty: 1,
  unitPriceBase: 100_000,
};

describe('cart domain contract', () => {
  it('normalizes fixed quantities using the configured order limits', () => {
    expect(
      applyQuantityConstraints({
        ...baseLine,
        qty: 1,
        minimumOrderQuantity: 3,
        maximumOrderQuantity: 5,
      }),
    ).toMatchObject({ qty: 3, minimumOrderQuantity: 3, maximumOrderQuantity: 5 });

    expect(
      applyQuantityConstraints({
        ...baseLine,
        qty: 9,
        minimumOrderQuantity: 3,
        maximumOrderQuantity: 5,
      }).qty,
    ).toBe(5);
  });

  it('keeps measured quantities on the inventory precision contract', () => {
    expect(
      applyQuantityConstraints({
        ...baseLine,
        priceModel: 'per_unit',
        unitOfMeasure: 'kg',
        qty: undefined,
        requestedQty: 1.2349,
        requestedUnit: 'kg',
      }),
    ).toMatchObject({ requestedQty: 1.235 });
  });

  it('retains campaign attribution in the persisted cart state', () => {
    const state: CartState = {
      lines: [],
      savedLines: [],
      offerCode: null,
      transportId: null,
      address: null,
      shippingPaymentMethod: 'online',
      attribution: { source: 'campaign', medium: 'link' },
    };

    expect(state.attribution).toEqual({ source: 'campaign', medium: 'link' });
  });
});
