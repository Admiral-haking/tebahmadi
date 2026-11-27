import { describe, expect, it } from 'vitest';

import { cartReducer, type CartState } from './CartProvider';

const emptyState: CartState = {
  lines: [],
  savedLines: [],
  offerCode: null,
  transportId: null,
  address: null,
  shippingPaymentMethod: 'online',
};

describe('cart reducer', () => {
  it('keeps a newly selected product in the cart', () => {
    const next = cartReducer(emptyState, {
      type: 'ADD_LINE',
      payload: {
        productId: 'product-1',
        productSlug: 'product-1',
        title: 'محصول تستی',
        variantId: 'variant-1',
        sku: 'SKU-1',
        priceModel: 'fixed',
        qty: 1,
        unitPriceBase: 100,
      },
    });

    expect(next.lines).toHaveLength(1);
    expect(next.lines[0]).toMatchObject({ variantId: 'variant-1', qty: 1 });
  });
});
