import { describe, expect, it } from 'vitest';

import {
  buildCartAvailabilityIssues,
  getUnavailableVariantIds,
  normalizeCartVariantIds,
  type CartAvailabilityLine,
  type CartAvailabilityRow,
} from './cart-availability';

describe('cart availability helpers', () => {
  it('normalizes and de-duplicates variant ids without trusting client order', () => {
    expect(normalizeCartVariantIds([' v-2 ', 'v-1', 'v-2', '', null])).toEqual(['v-1', 'v-2']);
  });

  it('treats missing, non-sellable, and empty rows as unavailable', () => {
    const ids = ['v-1', 'v-2', 'v-3', 'v-4'];
    const rows: CartAvailabilityRow[] = [
      { variantId: 'v-1', available: 4, sellable: true },
      { variantId: 'v-2', available: 4, sellable: false, reason: 'inventory_frozen' },
      { variantId: 'v-3', available: 0, sellable: true },
    ];

    expect(getUnavailableVariantIds(ids, rows)).toEqual(['v-2', 'v-3', 'v-4']);
  });

  it('creates item-specific Persian messages for partial stock and frozen items', () => {
    const lines: CartAvailabilityLine[] = [
      { variantId: 'v-1', title: 'عسل کوهستان', priceModel: 'fixed', qty: 3 },
      { variantId: 'v-2', title: 'دمنوش شب', priceModel: 'per_unit', requestedQty: 1, requestedUnit: 'کیلو' },
    ];
    const rows: CartAvailabilityRow[] = [
      { variantId: 'v-1', available: 2, sellable: true },
      { variantId: 'v-2', available: 0, sellable: false, reason: 'inventory_frozen' },
    ];

    expect(buildCartAvailabilityIssues(lines, rows)).toEqual([
      expect.objectContaining({
        variantId: 'v-1',
        message: '«عسل کوهستان»: فقط ۲ عدد قابل خرید است.',
      }),
      expect.objectContaining({
        variantId: 'v-2',
        message: '«دمنوش شب»: فروش این کالا موقتاً متوقف شده است. لطفاً آن را از سبد حذف کنید.',
      }),
    ]);
  });
});
