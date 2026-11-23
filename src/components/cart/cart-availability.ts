export type CartAvailabilityRow = {
  variantId: string;
  available: number;
  sellable: boolean;
  reason?: 'inventory_frozen' | 'not_found' | 'insufficient_inventory' | string;
};

export type CartAvailabilityLine = {
  variantId: string;
  title: string;
  priceModel: 'fixed' | 'per_unit';
  qty?: number;
  requestedQty?: number;
  requestedUnit?: string;
  unitOfMeasure?: string;
};

export type CartAvailabilityIssue = {
  variantId: string;
  title: string;
  requestedQuantity: number;
  availableQuantity: number;
  unitLabel: string;
  message: string;
};

function toFinitePositiveNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return value;
}

export function normalizeCartVariantIds(values: readonly unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function getUnavailableVariantIds(
  variantIds: readonly string[],
  rows: readonly CartAvailabilityRow[],
): string[] {
  const byVariantId = new Map(rows.map((row) => [row.variantId, row]));
  return normalizeCartVariantIds(variantIds).filter((variantId) => {
    const row = byVariantId.get(variantId);
    return !row || row.sellable !== true || (toFinitePositiveNumber(row.available) ?? 0) <= 0;
  });
}

function formatQuantity(value: number): string {
  return value.toLocaleString('fa-IR', { maximumFractionDigits: 3 });
}

function requestedQuantity(line: CartAvailabilityLine): number {
  return line.priceModel === 'per_unit'
    ? Math.max(0, line.requestedQty ?? 0)
    : Math.max(0, Math.floor(line.qty ?? 0));
}

export function buildCartAvailabilityIssues(
  lines: readonly CartAvailabilityLine[],
  rows: readonly CartAvailabilityRow[],
): CartAvailabilityIssue[] {
  const byVariantId = new Map(rows.map((row) => [row.variantId, row]));

  return lines.flatMap((line) => {
    const row = byVariantId.get(line.variantId);
    const requested = requestedQuantity(line);
    const available = Math.max(0, toFinitePositiveNumber(row?.available) ?? 0);
    const unavailable = !row || row.sellable !== true || available <= 0;
    const insufficient = requested > 0 && available < requested;
    if (!unavailable && !insufficient) return [];

    const title = line.title.trim() || 'این کالا';
    const unitLabel = line.priceModel === 'per_unit'
      ? line.requestedUnit ?? line.unitOfMeasure ?? 'واحد'
      : 'عدد';

    let message: string;
    if (row?.reason === 'inventory_frozen') {
      message = `«${title}»: فروش این کالا موقتاً متوقف شده است. لطفاً آن را از سبد حذف کنید.`;
    } else if (available <= 0) {
      message = `«${title}»: در حال حاضر موجود نیست. لطفاً آن را از سبد حذف کنید.`;
    } else {
      message = `«${title}»: فقط ${formatQuantity(available)} ${unitLabel} قابل خرید است.`;
    }

    return [{
      variantId: line.variantId,
      title,
      requestedQuantity: requested,
      availableQuantity: available,
      unitLabel,
      message,
    } satisfies CartAvailabilityIssue];
  });
}
