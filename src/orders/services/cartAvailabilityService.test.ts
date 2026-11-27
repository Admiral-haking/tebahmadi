import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findProduct } = vi.hoisted(() => ({
  findProduct: vi.fn(),
}));

vi.mock('@/catalog/models/Product', () => ({
  default: {
    find: findProduct,
  },
}));

import { getCartVariantAvailability } from './cartAvailabilityService';

const variantId = '507f1f77bcf86cd799439011';

describe('cart variant availability', () => {
  beforeEach(() => {
    findProduct.mockReset();
  });

  it('keeps an active in-stock variant sellable when showInCart is false or active is omitted', async () => {
    findProduct.mockReturnValue({
      lean: () => Promise.resolve([
        {
          status: 'active',
          showInCart: false,
          variants: [
            {
              _id: variantId,
              inventory: { quantity: 4 },
            },
          ],
        },
      ]),
    });

    await expect(getCartVariantAvailability([variantId])).resolves.toEqual([
      {
        variantId,
        available: 4,
        sellable: true,
      },
    ]);
  });
});
