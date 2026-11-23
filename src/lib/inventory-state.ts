/**
 * Shared inventory quantity normalisation.
 *
 * Cart quantities for measured products must keep millesimal precision while
 * countable products are normalised by their own quantity constraints.
 */
export const INVENTORY_DECIMAL_PLACES = 3;
export const INVENTORY_QUANTITY_SCALE = 10 ** INVENTORY_DECIMAL_PLACES;

export function roundInventoryQuantity(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;

  const rounded =
    (Math.sign(parsed) || 1) *
    (Math.round((Math.abs(parsed) + Number.EPSILON) * INVENTORY_QUANTITY_SCALE) /
      INVENTORY_QUANTITY_SCALE);

  return Object.is(rounded, -0) ? 0 : rounded;
}

export function normalizeInventoryQuantity(value: unknown): number {
  return Math.max(0, roundInventoryQuantity(value));
}
