/**
 * Single source of truth for stock/inventory normalisation. Stock must NEVER be
 * negative anywhere — in the UI, on save, or in sync payloads. Use this helper
 * at every point a stock value is read for display or written to the DB / a
 * marketplace, so the rule is enforced consistently.
 */
export function normalizeStock(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
