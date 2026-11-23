import { roundInventoryQuantity } from '@/lib/inventory-state';

export type Unit = 'unit' | 'pair' | 'kg' | 'g' | 'lb' | 'oz' | 'l' | 'ml';

export type CartLine = {
  productId: string;
  productSlug: string;
  title: string;
  variantId: string;
  sku: string;
  priceModel: 'fixed' | 'per_unit';
  unitOfMeasure?: Unit;
  qty?: number;
  requestedQty?: number;
  requestedUnit?: Unit;
  unitPriceBase: number;
  variantOfferAmount?: number;
  mediaThumbId?: string;
  attributesSummary?: string;
  weightGramsPerUnit?: number;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
};

export type CartAddress = {
  fname: string;
  lname: string;
  phone: string;
  state?: string;
  city?: string;
  address?: string;
  postalCode?: string;
};

export type ShippingPaymentMethod = 'online' | 'on_delivery';
export type CartAttribution = { campaign?: string; source?: string; medium?: string };

export type CartState = {
  lines: CartLine[];
  savedLines: CartLine[];
  offerCode?: string | null;
  transportId?: string | null;
  address?: CartAddress | null;
  shippingPaymentMethod: ShippingPaymentMethod;
  attribution?: CartAttribution;
};

const MONGO_OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

export function isMongoObjectId(value: string): boolean {
  return MONGO_OBJECT_ID_PATTERN.test(value);
}

/**
 * Older browser carts sometimes persisted a SKU in variantId. Those lines are
 * only stale when their product already has a persistent Mongo id; preview
 * catalog lines intentionally use stable non-Mongo ids and must be preserved.
 */
export function isStaleCartLine(line: Pick<CartLine, 'productId' | 'variantId'>): boolean {
  return isMongoObjectId(line.productId) && !isMongoObjectId(line.variantId);
}

const sanitizeConstraint = (value?: number): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return value;
};

const normalizeConstraints = (line: CartLine) => {
  const min = sanitizeConstraint(line.minimumOrderQuantity);
  const rawMax = sanitizeConstraint(line.maximumOrderQuantity);
  const max = rawMax !== undefined && min !== undefined && rawMax < min ? min : rawMax;
  return { min, max };
};

/** Keep the same quantity contract for fixed and measured cart lines. */
export function applyQuantityConstraints(line: CartLine): CartLine {
  const { min, max } = normalizeConstraints(line);

  if (line.priceModel === 'per_unit') {
    let quantity = line.requestedQty ?? 0;
    if (quantity <= 0) {
      return {
        ...line,
        requestedQty: quantity,
        minimumOrderQuantity: min,
        maximumOrderQuantity: max,
      };
    }
    if (min !== undefined && quantity < min) quantity = min;
    if (max !== undefined && quantity > max) quantity = max;

    return {
      ...line,
      requestedQty: roundInventoryQuantity(quantity),
      minimumOrderQuantity: min,
      maximumOrderQuantity: max,
    };
  }

  let quantity = Math.max(1, Math.floor(line.qty ?? 1));
  if (min !== undefined && quantity < min) quantity = Math.max(quantity, Math.ceil(min));
  if (max !== undefined && quantity > max) quantity = Math.min(quantity, Math.floor(max));

  return {
    ...line,
    qty: quantity > 0 ? quantity : 1,
    minimumOrderQuantity: min,
    maximumOrderQuantity: max,
  };
}
