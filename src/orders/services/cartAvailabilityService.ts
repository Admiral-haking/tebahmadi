import { Types } from 'mongoose';

import ProductModel from '@/catalog/models/Product';
import type { CartAvailabilityRow } from '@/components/cart/cart-availability';

/**
 * Reads sellable stock from the catalog in one query. The cart never treats a
 * browser snapshot as authoritative: a missing variant, inactive product, or
 * inactive variant is returned as not sellable and is handled by checkout.
 */
export async function getCartVariantAvailability(variantIds: readonly string[]): Promise<CartAvailabilityRow[]> {
  const ids = Array.from(
    new Set(
      variantIds
        .filter((value): value is string => typeof value === 'string' && Types.ObjectId.isValid(value))
        .map((value) => value.trim()),
    ),
  );

  if (ids.length === 0) return [];

  const products = await ProductModel.find(
    { 'variants._id': { $in: ids.map((id) => new Types.ObjectId(id)) } },
    { status: 1, showInCart: 1, variants: 1 },
  ).lean();

  const rows = new Map<string, CartAvailabilityRow>();
  for (const product of products) {
    const productSellable = product.status === 'active' && product.showInCart !== false;
    for (const variant of product.variants ?? []) {
      const variantId = variant._id?.toString();
      if (!variantId || !ids.includes(variantId)) continue;
      const available = Math.max(0, Number(variant.inventory?.quantity ?? 0) || 0);
      const sellable = productSellable && variant.active === true;
      rows.set(variantId, {
        variantId,
        available,
        sellable,
        reason: sellable ? (available > 0 ? undefined : 'insufficient_inventory') : 'not_sellable',
      });
    }
  }

  return ids.flatMap((variantId) => {
    const row = rows.get(variantId);
    return row ? [row] : [];
  });
}
