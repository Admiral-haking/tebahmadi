import { describe, expect, it } from 'vitest';

import { moveLineToSaved, moveSavedLineToCart, type CartState } from './CartProvider';
import { isStaleCartLine } from '@/features/cart/cart-domain';

const line = {
  productId: 'p-1',
  productSlug: 'herb',
  title: 'عسل کوهستان',
  variantId: 'v-1',
  sku: 'SKU-1',
  priceModel: 'fixed' as const,
  qty: 2,
  unitPriceBase: 420_000,
};

const state: CartState = {
  lines: [line],
  savedLines: [],
  offerCode: null,
  transportId: null,
  address: null,
  shippingPaymentMethod: 'online',
};

describe('saved cart lines', () => {
  it('moves an active line to saved lines without changing its quantity', () => {
    const next = moveLineToSaved(state, 'v-1');

    expect(next.lines).toEqual([]);
    expect(next.savedLines).toEqual([line]);
  });

  it('moves a saved line back and merges duplicate quantities', () => {
    const next = moveSavedLineToCart(
      { ...state, lines: [{ ...line, qty: 1 }], savedLines: [line] },
      'v-1',
    );

    expect(next.savedLines).toEqual([]);
    expect(next.lines[0].qty).toBe(3);
  });

  it('detects legacy persisted lines that contain a SKU instead of a variant id', () => {
    expect(
      isStaleCartLine({
        productId: '6b01b31e53c87c42ebaf6e9b',
        variantId: 'TA-HONEY-MOUNTAIN',
      }),
    ).toBe(true);

    expect(
      isStaleCartLine({
        productId: 'preview-honey-mountain',
        variantId: 'TA-HONEY-MOUNTAIN',
      }),
    ).toBe(false);

    expect(
      isStaleCartLine({
        productId: '6b01b31e53c87c42ebaf6e9b',
        variantId: '6b01b31e53c87c42ebaf6e9c',
      }),
    ).toBe(false);
  });
});
