export type Cart = Record<string, number>;

export function normalizeCart(value: unknown): Cart {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Cart = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!id || typeof raw !== "number" && typeof raw !== "string") continue;
    const quantity = Math.floor(Number(raw));
    if (Number.isSafeInteger(quantity) && quantity > 0) result[id] = quantity;
  }
  return result;
}

export function setCartQuantity(current: number, requested: number, stock?: number): number {
  const quantity = Math.max(0, Math.floor(Number(requested) || 0));
  if (!Number.isSafeInteger(quantity)) return Math.max(0, Math.floor(current) || 0);
  if (stock !== undefined && Number.isFinite(stock)) return Math.min(quantity, Math.max(0, Math.floor(stock)));
  return quantity;
}

export function addCartQuantity(current: number, amount = 1, stock?: number): number {
  return setCartQuantity(current, (Math.floor(Number(current)) || 0) + (Math.floor(Number(amount)) || 0), stock);
}
