/**
 * SnappShop owns branch activation. Normalize harmless casing/whitespace
 * differences while refusing to treat unknown states as active.
 */
export function normalizeSnappVendorStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function isSnappVendorActive(value: unknown): boolean {
  return normalizeSnappVendorStatus(value) === 'ACTIVE';
}
