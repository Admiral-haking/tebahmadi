export function applyInventoryDelta(currentStock: number, delta: number, maxStock = 100000): number | null {
  if (!Number.isSafeInteger(currentStock) || !Number.isSafeInteger(delta) || !Number.isSafeInteger(maxStock) || currentStock < 0 || maxStock < 0) return null;
  const next = currentStock + delta;
  return next >= 0 && next <= maxStock ? next : null;
}
