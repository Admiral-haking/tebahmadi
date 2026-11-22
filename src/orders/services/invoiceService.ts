import mongoose, { Types, type ClientSession } from 'mongoose';
import { revalidateTag, TAGS } from '@/lib/cache';
import ProductModel, {
  type VariantSchema,
  type AttributeValue,
} from '@/catalog/models/Product';
import ProductTypeModel from '@/catalog/models/ProductType';
import { InvoiceModel, type InvoiceDocument } from '@/orders/models/Invoice';
import {
  validateForCart,
  redeemAtomic,
  releaseRedemption,
  type OfferValidationLine,
  type OfferType,
} from '@/orders/services/offerService';
import { quoteShipping } from '@/orders/services/transportService';
import { clampNonNegative } from '@/lib/calc';
import { sendOrderConfirmationSms, sendShipmentTrackingSms } from '@/lib/sms';
import type { OfferDocument } from '@/orders/models/Offer';
import { supportsMongoTransactions } from '@/lib/mongo';
import { connectMongoose } from '@/lib/mongoose';
import {
  INVOICE_PROGRESS_STATES,
  ORDER_PROGRESS_FREEZE_MS,
  type InvoiceProgressState,
  type InvoiceProgressHistoryEntry,
} from '@/orders/constants/progress';
import { createReviewInvitationForInvoice } from '@/reviews/services/reviewService';
import { ReviewRequestModel } from '@/reviews/models/ReviewRequest';
import { syncServiceStock, type SyncStockProps } from '@/sync/service-stock';
import { TrackerModel } from '@/tracking';
import { normalizeTrackerItems } from '@/tracking/service/tracker-items';
import { scheduleHolooInvoiceSync, scheduleHolooReturnSync } from '@/holoo/services/sync-invoice';
// Side-effect import: boots the Holoo auto-sync sweep (no-op unless HOLOO_AUTO_SWEEP=1).
import '@/holoo/services/auto-sync-sweep';

export interface InvoiceLineInput {
  productId: string;
  variantId: string;
  qty?: number;
  requestedQty?: number;
  requestedUnit?: string;
}

export interface AddressInput {
  fname: string;
  lname: string;
  phone: string;
  state?: string;
  city?: string;
  address?: string;
  postalCode?: string;
}

export type ShippingPaymentMethod = 'online' | 'on_delivery';

export interface InvoicePricingInput {
  userId: string;
  lines: InvoiceLineInput[];
  transportId: string;
  address: AddressInput;
  offerCode?: string;
  now?: Date;
  shippingPaymentMethod?: ShippingPaymentMethod;
  torobClid?: string;
}

interface InvoiceLineSnapshot {
  productId: Types.ObjectId;
  productSlug: string;
  variantId: Types.ObjectId;
  sku: string;
  title: string;
  variantSummary?: string;
  priceModel: 'fixed' | 'per_unit';
  unitOfMeasure?: VariantSchema['price']['unitOfMeasure'];
  qty?: number;
  requestedQty?: number;
  requestedUnit?: string;
  unitPriceBase: number;
  variantOfferAmount?: number;
  unitPriceEffective: number;
  lineTotal: number;
  weightGrams?: number;
  attributesSnapshot?: Record<string, unknown>;
  mediaId?: Types.ObjectId;
}

interface BuiltLine {
  invoiceLine: InvoiceLineSnapshot;
  offerLine: OfferValidationLine;
  product: ProductLean;
  variant: VariantLean;
}

type InvoiceCreatePayload = {
  number: string;
  status: InvoiceStatus;
  userId: Types.ObjectId;
  lines: InvoiceLineSnapshot[];
  appliedOfferCode?: string;
  appliedOfferType?: OfferType;
  appliedOfferDiscount: number;
  transportId: Types.ObjectId;
  transportName: string;
  shippingPrice: number;
  shippingBreakdown: PricingComputation['shipping']['breakdown'];
  shippingPaymentMethod: ShippingPaymentMethod;
  shippingDeferred: number;
  addressSnapshot: AddressInput;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  grandTotal: number;
  paymentMethod: string;
  paymentMethodData?: Record<string, unknown>;
  pricingContext: {
    productTypeVersions: Record<string, number>;
    transportRowLabel?: string;
    offerSnapshot?: OfferSnapshot;
  };
  torobClid?: string;
};

interface PricingComputation {
  lines: InvoiceLineSnapshot[];
  subtotal: number;
  totalWeightGrams: number;
  offer?: {
    code: string;
    type: OfferType;
    discount: number;
    transportFree: boolean;
    snapshot: Record<string, unknown>;
  };
  shipping: {
    price: number;
    breakdown: { basePrice: number; steps: number; stepPrice: number };
    transportId: Types.ObjectId;
    transportName: string;
    chargedPrice: number;
    deferredPrice: number;
    paymentMethod: ShippingPaymentMethod;
    rowLabel?: string;
  };
  discountTotal: number;
  shippingTotal: number;
  grandTotal: number;
  productTypeVersions: Record<string, number>;
}

interface PricingOptions {
  session?: ClientSession;
}

type VariantLean = VariantSchema & { _id?: Types.ObjectId | string };

type ProductLean = {
  _id: Types.ObjectId;
  productTypeId: Types.ObjectId;
  typeVersion: number;
  title: string;
  slug: string;
  description?: string;
  brand?: string;
  attributeValues: AttributeValue[];
  variants: VariantLean[];
  categories: Types.ObjectId[];
  attrs?: Record<string, unknown> | Map<string, unknown>;
};

type ProductTypeLean = {
  _id: Types.ObjectId;
  attributes?: Array<{ key?: string; label?: string; variant?: boolean }>;
};

type OfferSnapshot = Record<string, unknown>;

type InvoiceStatus = InvoiceDocument['status'];

type InvoiceStatusUpdateResult =
  | { ok: true; invoice: InvoiceDocument }
  | { ok: false; reason: string };
type InvoiceProgressUpdateResult =
  | { ok: true; invoice: InvoiceDocument }
  | { ok: false; reason: string };
type PlainInvoiceProgress = {
  current?: InvoiceProgressState;
  inProgressAt?: Date;
  packagedPostedAt?: Date;
  orderFinishedAt?: Date;
  history: InvoiceProgressHistoryEntry[];
  packagedPostedTrackingNumber?: string;
};
type InvoiceProgressTransitionOptions = {
  trackingCode?: string;
};

function buildInvoiceTrackerPayload(invoice: InvoiceDocument) {
  const trackingCode = invoice.progress?.packagedPostedTrackingNumber;

  return {
    orderId: `${invoice.number}`,
    serviceId: 'website',
    orderStatus: invoice.status,
    progressState: invoice.progress?.current,
    amount: invoice.grandTotal,
    discount: invoice.appliedOfferDiscount,
    shippingServiceId: `${invoice.transportId}`,
    shippingServiceName: invoice.transportName,
    customerName: [invoice.addressSnapshot?.fname, invoice.addressSnapshot?.lname].filter(Boolean).join(" ") || undefined,
    customerPhone: invoice.addressSnapshot?.phone,
    customerPostalCode: invoice.addressSnapshot?.postalCode,
    customerAddress: invoice.addressSnapshot?.address,
    customerCity: invoice.addressSnapshot?.city,
    customerState: invoice.addressSnapshot?.state,
    items: normalizeTrackerItems(invoice.lines.map(item => ({
      serviceVariantId: `${item.variantId}`,
      variantId: item.variantId,
      title: item.variantSummary || item.title || "xxx",
      quantity: item.qty ?? item.requestedQty ?? 0,
      src: item.mediaId ? `/api/media/${item.mediaId}` : '/product-placeholder.svg',
      url: `/product/${item.productSlug}`,
      trackingCode,
      city: invoice.addressSnapshot?.city,
      state: invoice.addressSnapshot?.state
    }))),
  };
}

export async function syncInvoiceTracker(invoice: InvoiceDocument, session?: ClientSession) {
  const payload = buildInvoiceTrackerPayload(invoice);

  await TrackerModel.updateOne(
    {
      orderId: payload.orderId,
      serviceId: 'website',
    },
    {
      $set: payload,
      $setOnInsert: {
        createdAt: invoice.createdAt ?? new Date(),
      },
    },
    {
      upsert: true,
      session,
    },
  );
}

const STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['pending', 'canceled'],
  pending: ['paid', 'canceled'],
  paid: ['refunded', 'canceled'],
  canceled: [],
  refunded: [],
};

const PROGRESS_TRANSITIONS: Record<InvoiceProgressState, InvoiceProgressState[]> = {
  'in-progress': ['packaged-posted'],
  'packaged-posted': ['order-finished'],
  'order-finished': [],
};

type ProgressTimestampField = 'inProgressAt' | 'packagedPostedAt' | 'orderFinishedAt';

const PROGRESS_TIMESTAMP_FIELD: Record<InvoiceProgressState, ProgressTimestampField> = {
  'in-progress': 'inProgressAt',
  'packaged-posted': 'packagedPostedAt',
  'order-finished': 'orderFinishedAt',
};

const TEN_MINUTES_MS = 10 * 60 * 1000;
const AUTO_FINISH_LOOKBACK_MS = ORDER_PROGRESS_FREEZE_MS;
const INVOICE_MAINTENANCE_SWEEP_INTERVAL_MS = 60 * 1000;
const EXPIRED_INVOICE_SWEEP_BATCH_SIZE = 20;
const PROGRESS_AUTO_COMPLETE_BATCH_SIZE = 20;

const schedulerState = globalThis as typeof globalThis & {
  __invoiceMaintenanceInterval?: NodeJS.Timeout;
  __invoiceMaintenanceSweepInFlight?: boolean;
};

class InventoryAdjustmentError extends Error {
  constructor(public readonly reason: InventoryAdjustmentFailureReason, message?: string) {
    super(message ?? reason);
    this.name = 'InventoryAdjustmentError';
  }
}

type InventoryAdjustmentFailureReason =
  | 'product_not_found'
  | 'variant_not_found'
  | 'invalid_inventory_configuration'
  | 'insufficient_inventory';

function canTransition(current: InvoiceStatus, next: InvoiceStatus): boolean {
  if (current === next) {
    return true;
  }
  return STATUS_TRANSITIONS[current]?.includes(next) ?? false;
}

function canTransitionProgress(
  current: InvoiceProgressState | undefined,
  next: InvoiceProgressState,
): boolean {
  if (!current) {
    return true;
  }
  if (current === next) {
    return true;
  }
  return PROGRESS_TRANSITIONS[current]?.includes(next) ?? false;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function sanitizeTrackingCode(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function cloneProgress(progress?: InvoiceDocument['progress']): PlainInvoiceProgress {
  if (!progress) {
    return { history: [] };
  }
  const base =
    typeof (progress as { toObject?: () => PlainInvoiceProgress })?.toObject === 'function'
      ? (progress as { toObject: () => PlainInvoiceProgress }).toObject()
      : (progress as PlainInvoiceProgress);

  const rawHistory = Array.isArray(base.history) ? base.history : [];
  const history = rawHistory
    .map((entry) => {
      if (!entry) return undefined;
      const snapshot =
        typeof (entry as { toObject?: () => InvoiceProgressHistoryEntry })?.toObject === 'function'
          ? (entry as any).toObject()
          : (entry as InvoiceProgressHistoryEntry);
      if (!snapshot.state) {
        return undefined;
      }
      return {
        state: snapshot.state,
        changedAt: snapshot.changedAt ? new Date(snapshot.changedAt) : new Date(),
        trackingNumber: snapshot.trackingNumber ?? undefined,
      } satisfies InvoiceProgressHistoryEntry;
    })
    .filter((entry) => Boolean(entry)) as InvoiceProgressHistoryEntry[];

  return {
    current: base.current,
    inProgressAt: base.inProgressAt ? new Date(base.inProgressAt) : undefined,
    packagedPostedAt: base.packagedPostedAt ? new Date(base.packagedPostedAt) : undefined,
    orderFinishedAt: base.orderFinishedAt ? new Date(base.orderFinishedAt) : undefined,
    history,
    packagedPostedTrackingNumber: base.packagedPostedTrackingNumber ?? undefined,
  };
}

function isInvoiceFrozen(invoice: InvoiceDocument, referenceDate = new Date()): boolean {
  const packagedAt = invoice.progress?.packagedPostedAt
    ? new Date(invoice.progress.packagedPostedAt)
    : null;
  if (!packagedAt) {
    return false;
  }
  return referenceDate.getTime() - packagedAt.getTime() >= ORDER_PROGRESS_FREEZE_MS;
}

function formatAttributeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : '';
  }
  if (typeof value === 'boolean') {
    return value ? 'بله' : 'خیر';
  }
  if (Array.isArray(value)) {
    const formatted = value
      .map((item) => formatAttributeValue(item))
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return formatted.join('، ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.name === 'string' && record.name.trim().length > 0) {
      return record.name;
    }
    if (typeof record.label === 'string' && record.label.trim().length > 0) {
      return record.label;
    }
    if (typeof record.title === 'string' && record.title.trim().length > 0) {
      return record.title;
    }
    if (typeof record.key === 'string' && record.key.trim().length > 0) {
      return record.key;
    }
    if (typeof record.value === 'string' && record.value.trim().length > 0) {
      return record.value;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

async function applyInvoiceProgressTransition(
  invoice: InvoiceDocument,
  nextProgress: InvoiceProgressState,
  session?: ClientSession,
  options?: InvoiceProgressTransitionOptions,
) {
  const now = new Date();
  const progress = cloneProgress(invoice.progress);
  const timestampField = PROGRESS_TIMESTAMP_FIELD[nextProgress];
  if (!progress[timestampField]) {
    progress[timestampField] = now;
  }
  const trackingCode =
    nextProgress === 'packaged-posted' ? sanitizeTrackingCode(options?.trackingCode) : undefined;
  if (nextProgress === 'packaged-posted' && trackingCode) {
    progress.packagedPostedTrackingNumber = trackingCode;
  }
  const history = Array.isArray(progress.history) ? [...progress.history] : [];
  const historyEntry: InvoiceProgressHistoryEntry = {
    state: nextProgress,
    changedAt: now,
  };
  if (trackingCode) {
    historyEntry.trackingNumber = trackingCode;
  }
  history.push(historyEntry);
  progress.history = history;
  progress.current = nextProgress;

  await InvoiceModel.updateOne(
    { _id: invoice._id },
    { $set: { progress, updatedAt: now } },
    { session },
  ).exec();

  invoice.progress = progress as typeof invoice.progress;
  invoice.updatedAt = now;

  await syncInvoiceTracker(invoice, session);
}

function variantSummary(variant: VariantLean, attributeLabels?: Map<string, string>): string | undefined {
  const attributes = variant.attributeValues ?? [];
  if (attributes.length === 0) {
    return undefined;
  }
  const pieces = attributes
    .map((attr) => {
      const formatted = formatAttributeValue(attr.value);
      if (!formatted) {
        return undefined;
      }
      const label = attributeLabels?.get(attr.key) ?? attr.key;
      return `${label}: ${formatted}`;
    })
    .filter((item): item is string => typeof item === 'string' && item.length > 0);
  if (pieces.length === 0) {
    return undefined;
  }
  return pieces.join(' / ');
}

function attributesSnapshot(variant: VariantLean): Record<string, string> | undefined {
  const attributes = variant.attributeValues ?? [];
  if (attributes.length === 0) {
    return undefined;
  }
  return attributes.reduce<Record<string, string>>((acc, attr) => {
    const formatted = formatAttributeValue(attr.value);
    if (formatted) {
      acc[attr.key] = formatted;
    }
    return acc;
  }, {});
}

function convertQuantitySafely(value: number, fromUnit: string | undefined, toUnit: string | undefined): number {
  if (!fromUnit || !toUnit || fromUnit === toUnit) {
    return value;
  }
  return convertQuantity(value, fromUnit, toUnit);
}

function computeInventoryDelta(line: InvoiceDocument['lines'][number], variant: VariantSchema): number {
  const trackingUnit = variant.inventory?.trackingUnit;
  if (!trackingUnit) {
    throw new InventoryAdjustmentError('invalid_inventory_configuration', 'Variant inventory tracking unit missing');
  }

  if (line.priceModel === 'fixed') {
    const qty = line.qty ?? 0;
    if (qty <= 0) {
      throw new InventoryAdjustmentError('invalid_inventory_configuration', 'Invalid quantity in invoice line');
    }
    return qty;
  }

  const requestedQty = line.requestedQty ?? 0;
  if (requestedQty <= 0) {
    throw new InventoryAdjustmentError('invalid_inventory_configuration', 'Invalid requested quantity in invoice line');
  }

  const requestedUnit = line.requestedUnit ?? line.unitOfMeasure ?? trackingUnit;
  const priceUnit = line.unitOfMeasure ?? trackingUnit;

  let quantity = requestedQty;
  quantity = convertQuantitySafely(quantity, requestedUnit, priceUnit);
  quantity = convertQuantitySafely(quantity, priceUnit, trackingUnit);

  return quantity;
}

export async function adjustInventoryForInvoice(
  invoice: InvoiceDocument,
  mode: 'deduct' | 'restore',
  session?: ClientSession,
) {
  const lines = invoice.lines ?? [];
  if (lines.length === 0) {
    return;
  }

  const productIds = Array.from(
    new Set(
      lines.map((line) =>
        line.productId instanceof Types.ObjectId ? line.productId.toString() : String(line.productId),
      ),
    ),
  );

  const products = await ProductModel.find({ _id: { $in: productIds } })
    .session(session ?? null)
    .exec();

  const productMap = new Map(products.map((product) => [product._id.toString(), product]));
  const modifiedProducts = new Set<string>();
  const stockSyncPayload: SyncStockProps = [];

  for (const line of lines) {
    const productId = line.productId instanceof Types.ObjectId ? line.productId.toString() : String(line.productId);
    const variantId = line.variantId instanceof Types.ObjectId ? line.variantId.toString() : String(line.variantId);

    try {
      const product = productMap.get(productId);
      if (!product) {
        throw new InventoryAdjustmentError('product_not_found', `Product ${productId} not found for invoice adjustment`);
      }

      const variant = product.variants?.find((candidate) => {
        const candidateId = candidate._id instanceof Types.ObjectId ? candidate._id.toString() : String(candidate._id);
        return candidateId === variantId;
      });

      if (!variant) {
        throw new InventoryAdjustmentError('variant_not_found', `Variant ${variantId} not found for product ${productId}`);
      }

      const delta = computeInventoryDelta(line, variant);
      if (delta <= 0) {
        throw new InventoryAdjustmentError('invalid_inventory_configuration', 'Computed inventory delta is not positive');
      }

      const currentQuantity = variant.inventory?.quantity ?? 0;
      if (mode === 'deduct') {
        if (currentQuantity < delta) {
          throw new InventoryAdjustmentError('insufficient_inventory', 'Insufficient inventory to fulfill invoice');
        }
        variant.inventory.quantity = currentQuantity - delta;
      } else {
        variant.inventory.quantity = currentQuantity + delta;
      }
      if (variant.barcode) {
        stockSyncPayload.push({ barcode: variant.barcode, stock: variant.inventory.quantity });
      }

      modifiedProducts.add(productId);
      product.markModified('variants');
    } catch (error) {
      if (mode === 'restore' && error instanceof InventoryAdjustmentError) {
        console.warn(
          `Skipping inventory restore for invoice ${invoice.number ?? invoice._id.toString()} line ${variantId}`,
          error.reason,
        );
        continue;
      }
      throw error;
    }
  }

  const saveOperations = Array.from(modifiedProducts).map((productId) => {
    const product = productMap.get(productId);
    if (!product) {
      return Promise.resolve();
    }
    return product.save({ session });
  });

  await Promise.all(saveOperations);

  syncServiceStock(stockSyncPayload).catch((error) => {
    console.error('Failed to sync invoice inventory with external services', error);
  });
}

function isSkippableInventoryError(error: InventoryAdjustmentError): boolean {
  return error.reason === 'product_not_found' || error.reason === 'variant_not_found';
}

async function adjustInventorySafely(
  invoice: InvoiceDocument,
  mode: 'deduct' | 'restore',
  session: ClientSession | undefined,
  context: string,
) {
  try {
    await adjustInventoryForInvoice(invoice, mode, session);
  } catch (error) {
    if (mode === 'restore' && error instanceof InventoryAdjustmentError && isSkippableInventoryError(error)) {
      console.warn(`Inventory restore skipped for invoice ${invoice.number ?? invoice._id.toString()} (${context}): ${error.reason}`);
      return;
    }
    throw error;
  }
}

async function releaseInvoiceOffer(invoice: InvoiceDocument, session?: ClientSession) {
  await releaseRedemption({
    code: invoice.appliedOfferCode,
    userId: invoice.userId,
    session,
  });

  if (invoice.appliedOfferCode) {
    try {
      await Promise.all([
        revalidateTag(TAGS.OFFERS),
        revalidateTag(TAGS.OFFER(invoice.appliedOfferCode)),
      ]);
    } catch {
      console.warn('revalidateTag failed (background context), skipping');
    }
  }





}

function normalizeNumeric(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function buildInvoiceSmsData(invoice: InvoiceDocument): Record<string, unknown> {
  const nameParts = [invoice.addressSnapshot?.fname, invoice.addressSnapshot?.lname]
    .filter((part) => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part!.trim());

  return {
    name: nameParts.join(' ') || undefined,
    fname: invoice.addressSnapshot?.fname,
    lname: invoice.addressSnapshot?.lname,
    order: invoice.number,
    invoice: invoice.number,
    total: invoice.grandTotal,
    subtotal: invoice.subtotal,
    discount: invoice.discountTotal,
    shipping: invoice.shippingTotal,
    transport: invoice.transportName,
  } satisfies Record<string, unknown>;
}

const DEFAULT_WEIGHT_GRAMS = 200;

function extractWeightPerUnit(product: ProductLean, variant: VariantLean): number {
  const variantAttributes = variant.attributeValues ?? [];
  const productAttributes = product.attributeValues ?? [];

  const fromVariant = variantAttributes.find((attr) => attr.key === 'weightGrams')?.value;
  const fromVariantAlt = variantAttributes.find((attr) => attr.key === 'weight')?.value;
  const fromProduct = productAttributes.find((attr) => attr.key === 'weightGrams')?.value;
  const fromAttrs =
    product.attrs instanceof Map
      ? product.attrs.get('weightGrams')
      : typeof product.attrs === 'object' && product.attrs !== null
        ? (product.attrs as Record<string, unknown>).weightGrams
        : undefined;

  const sources = [fromVariant, fromVariantAlt, fromProduct, fromAttrs];

  for (const source of sources) {
    const numeric = normalizeNumeric(source);
    if (numeric !== undefined) {
      const rounded = Math.round(numeric);
      if (rounded > 0) {
        return rounded;
      }
    }
  }

  return DEFAULT_WEIGHT_GRAMS;
}

function resolvePrimaryMediaId(variant: VariantLean): Types.ObjectId | undefined {
  const mediaIds = Array.isArray(variant.mediaIds) ? variant.mediaIds : [];
  if (mediaIds.length === 0) {
    return undefined;
  }
  const primary = mediaIds[0];
  if (primary instanceof Types.ObjectId) {
    return primary;
  }
  if (typeof primary === 'string' && Types.ObjectId.isValid(primary)) {
    return new Types.ObjectId(primary);
  }
  return undefined;
}

function computeVariantPricing(
  variant: VariantLean,
  now: Date
): { unitPriceBase: number; variantOfferAmount?: number; unitPriceEffective: number } {
  const base = variant.price.amount;
  const offer = variant.offer;
  const active =
    !!offer &&
    (!offer.startsAt || now >= new Date(offer.startsAt)) &&
    (!offer.endsAt || now <= new Date(offer.endsAt));
  const discount = active ? offer.amount : 0;
  const effective = Math.max(0, base - (discount ?? 0));
  return {
    unitPriceBase: base,
    variantOfferAmount: discount ? discount : undefined,
    unitPriceEffective: effective,
  };
}

function toStringId(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Types.ObjectId) return value.toString();
  return undefined;
}

function ensureQuantityForModel(line: InvoiceLineInput, variant: VariantLean) {
  if (variant.price.model === 'fixed') {
    assert(line.qty !== undefined && line.qty > 0, 'Quantity required for fixed price variant');
  } else {
    assert(
      line.requestedQty !== undefined && line.requestedQty > 0,
      'requestedQty required for per-unit variants'
    );
  }
}

function convertQuantity(value: number, fromUnit: string | undefined, toUnit: string | undefined): number {
  if (!fromUnit || !toUnit || fromUnit === toUnit) {
    return value;
  }

  const weightUnits = new Set(['g', 'kg']);
  const volumeUnits = new Set(['ml', 'l']);

  if (weightUnits.has(fromUnit) && weightUnits.has(toUnit)) {
    if (fromUnit === 'kg' && toUnit === 'g') {
      return value * 1000;
    }
    if (fromUnit === 'g' && toUnit === 'kg') {
      return value / 1000;
    }
  }

  if (volumeUnits.has(fromUnit) && volumeUnits.has(toUnit)) {
    if (fromUnit === 'l' && toUnit === 'ml') {
      return value * 1000;
    }
    if (fromUnit === 'ml' && toUnit === 'l') {
      return value / 1000;
    }
  }

  throw new Error(`Unsupported unit conversion from ${fromUnit} to ${toUnit}`);
}

function buildOfferSnapshot(offer?: OfferDocument | null): OfferSnapshot | undefined {
  if (!offer) {
    return undefined;
  }

  const snapshot: OfferSnapshot = {
    _id: offer._id,
    code: offer.code,
    type: offer.type,
    amount: offer.amount,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    usageLimitTotal: offer.usageLimitTotal,
    usageLimitPerUser: offer.usageLimitPerUser,
    minOrderSubtotal: offer.minOrderSubtotal,
  };

  return snapshot;
}

async function buildLines(
  inputs: InvoiceLineInput[],
  now: Date,
  session?: ClientSession
): Promise<{
  builtLines: BuiltLine[];
  subtotal: number;
  totalWeightGrams: number;
  productTypeVersions: Record<string, number>;
}> {
  assert(inputs.length > 0, 'At least one line required');

  const productIds = Array.from(new Set(inputs.map((line) => line.productId)));
  const products = (await ProductModel.find({ _id: { $in: productIds.map(toObjectId) } })
    .session(session ?? null)
    .lean()) as unknown as ProductLean[];

  const productMap = new Map<string, ProductLean>(
    products.map((product) => [product._id.toString(), product])
  );

  const productTypeIds = Array.from(
    new Set(products.map((product) => product.productTypeId?.toString()).filter(Boolean) as string[])
  );

  const productTypes: ProductTypeLean[] = productTypeIds.length
    ? ((await ProductTypeModel.find(
      { _id: { $in: productTypeIds } },
      { _id: 1, attributes: 1 }
    ).lean()) as ProductTypeLean[])
    : [];

  const variantAttributeLabelsByType = new Map<string, Map<string, string>>();
  productTypes.forEach((type) => {
    const labels = new Map<string, string>();
    const attributes = Array.isArray(type.attributes) ? type.attributes : [];
    attributes.forEach((attr) => {
      if (!attr?.variant) {
        return;
      }
      if (!attr.key) {
        return;
      }
      const label = typeof attr.label === 'string' && attr.label.trim().length > 0 ? attr.label.trim() : attr.key;
      labels.set(attr.key, label);
    });
    variantAttributeLabelsByType.set(
      type._id.toString(),
      labels
    );
  });

  const builtLines: BuiltLine[] = [];
  const productTypeVersions: Record<string, number> = {};

  let subtotal = 0;
  let totalWeightGrams = 0;

  for (const input of inputs) {
    const product = productMap.get(input.productId);
    if (!product) {
      throw new Error(`Product ${input.productId} not found`);
    }

    const variantsList = product.variants as VariantLean[];
    const variant = variantsList.find((candidate) => {
      const candidateId = candidate._id instanceof Types.ObjectId
        ? candidate._id.toString()
        : candidate._id
          ? String(candidate._id)
          : undefined;
      return candidateId === input.variantId;
    });

    if (!variant) {
      throw new Error(`Variant ${input.variantId} not found for product ${input.productId}`);
    }

    if (!variant.active) {
      throw new Error(`Variant ${input.variantId} is not active`);
    }

    ensureQuantityForModel(input, variant);

    const { unitPriceBase, variantOfferAmount, unitPriceEffective } = computeVariantPricing(variant, now);

    let qty: number | undefined;
    let requestedQty: number | undefined;
    let requestedUnit: string | undefined;
    let baseUnits = 0;

    if (variant.price.model === 'fixed') {
      if (input.qty === undefined) {
        throw new Error('Quantity required for fixed price variant');
      }
      qty = input.qty;
      baseUnits = qty;
    } else {
      if (input.requestedQty === undefined) {
        throw new Error('requestedQty required for per-unit variants');
      }
      requestedQty = input.requestedQty;
      requestedUnit = input.requestedUnit ?? variant.price.unitOfMeasure;
      if (!variant.price.unitOfMeasure) {
        throw new Error('Per-unit pricing requires unitOfMeasure on variant');
      }
      baseUnits = convertQuantity(requestedQty, requestedUnit, variant.price.unitOfMeasure);
    }

    const rawTotal = unitPriceEffective * baseUnits;
    const lineTotal = Math.round(rawTotal);

    const weightPerUnit = extractWeightPerUnit(product, variant);
    const weightGrams = Math.round(weightPerUnit * baseUnits);

    subtotal += lineTotal;
    totalWeightGrams += weightGrams;

    const attributeLabels = variantAttributeLabelsByType.get(product.productTypeId.toString());

    const invoiceLine: InvoiceLineSnapshot = {
      productId: toObjectId(input.productId),
      productSlug: product.slug,
      variantId: toObjectId(input.variantId),
      sku: variant.sku,
      title: product.title,
      variantSummary: variantSummary(variant, attributeLabels),
      priceModel: variant.price.model,
      unitOfMeasure: variant.price.unitOfMeasure,
      qty,
      requestedQty,
      requestedUnit,
      unitPriceBase,
      variantOfferAmount,
      unitPriceEffective,
      lineTotal,
      weightGrams: weightGrams > 0 ? weightGrams : undefined,
      attributesSnapshot: attributesSnapshot(variant),
      mediaId: resolvePrimaryMediaId(variant),
    };

    const categoryIds = (product.categories ?? []).map((cat) =>
      cat instanceof Types.ObjectId ? cat.toString() : String(cat)
    );
    const offerLine: OfferValidationLine = {
      lineSubtotal: lineTotal,
      productTypeId: product.productTypeId.toString(),
      categoryIds,
    };

    productTypeVersions[product.productTypeId.toString()] = product.typeVersion;

    builtLines.push({ invoiceLine, offerLine, product, variant });
  }

  return { builtLines, subtotal, totalWeightGrams, productTypeVersions };
}

async function computePricing(
  input: InvoicePricingInput,
  options: PricingOptions = {}
): Promise<PricingComputation> {
  const now = input.now ?? new Date();
  const { builtLines, subtotal, totalWeightGrams, productTypeVersions } = await buildLines(
    input.lines,
    now,
    options.session
  );

  const offerLines = builtLines.map((line) => line.offerLine);
  let discountTotal = 0;
  let transportFree = false;
  let offerType: OfferType | undefined;
  let offerSnapshot: OfferSnapshot | undefined;

  if (input.offerCode) {
    const offerResult = await validateForCart({
      code: input.offerCode,
      userId: input.userId,
      subtotal,
      lineItems: offerLines,
      now,
    });

    if (!offerResult.ok) {
      throw new Error(`Offer invalid: ${offerResult.reason}`);
    }

    discountTotal = offerResult.discountToman;
    transportFree = offerResult.transportFree;
    offerType = offerResult.type;
    offerSnapshot = buildOfferSnapshot(offerResult.offer);
  }


  const transportQuote = await quoteShipping({
    carrierId: input.transportId,
    totalWeightGrams,
    destinationState: input.address?.state,
    destinationCity: input.address?.city,
    destinationRegion: input.address?.city ?? input.address?.state,
  });
  if (!transportQuote.ok) {
    throw new Error(`Transport quote failed: ${transportQuote.reason}`);
  }

  const paymentMethod: ShippingPaymentMethod =
    input.shippingPaymentMethod === 'on_delivery' ? 'on_delivery' : 'online';
  const baseShippingPrice = transportQuote.price;
  const effectiveShippingPrice = transportFree ? 0 : baseShippingPrice;
  const chargeNow = paymentMethod === 'online';
  const chargedPrice = chargeNow ? effectiveShippingPrice : 0;
  const deferredPrice = chargeNow ? 0 : effectiveShippingPrice;
  const shippingTotal = chargedPrice;
  const discountClamped = clampNonNegative(discountTotal);
  const grandTotal = Math.max(0, subtotal - discountClamped + shippingTotal);

  return {
    lines: builtLines.map((line) => line.invoiceLine),
    subtotal,
    totalWeightGrams,
    offer:
      offerType && input.offerCode
        ? {
          code: input.offerCode.trim().toUpperCase(),
          type: offerType,
          discount: discountClamped,
          transportFree,
          snapshot: offerSnapshot ?? {},
        }
        : undefined,
    shipping: {
      price: effectiveShippingPrice,
      breakdown: transportQuote.breakdown,
      transportId: toObjectId(input.transportId),
      transportName: transportQuote.carrier.name,
      chargedPrice,
      deferredPrice,
      paymentMethod,
      rowLabel:
        transportQuote.carrier.pricingRows?.[transportQuote.rowIndex]?.label ?? undefined,
    },
    discountTotal: discountClamped,
    shippingTotal,
    grandTotal,
    productTypeVersions,
  };
}

export async function previewInvoice(
  input: InvoicePricingInput,
  options: PricingOptions = {}
) {
  const pricing = await computePricing(input, options);
  return {
    lines: pricing.lines,
    subtotal: pricing.subtotal,
    discountTotal: pricing.discountTotal,
    shippingTotal: pricing.shippingTotal,
    grandTotal: pricing.grandTotal,
    offer: pricing.offer,
    shipping: pricing.shipping,
    productTypeVersions: pricing.productTypeVersions,
  };
}

async function generateInvoiceNumber(session?: ClientSession): Promise<string> {
  const date = new Date();
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate()
  ).padStart(2, '0')}`;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = String(Math.floor(Math.random() * 9000) + 1000);
    const candidate = `INV-${datePart}-${suffix}`;
    const exists = await InvoiceModel.exists({ number: candidate }).session(session ?? null);
    if (!exists) {
      return candidate;
    }
  }

  throw new Error('Unable to generate invoice number');
}

async function executeInvoiceCreation(
  input: InvoicePricingInput,
  session?: ClientSession,
): Promise<{ created: InvoiceDocument; appliedOfferCode?: string }> {
  const pricing = await computePricing(input, session ? { session } : {});

  if (pricing.offer) {
    const redemption = await redeemAtomic({
      code: pricing.offer.code,
      userId: input.userId,
      session,
    });
    if (!redemption.ok) {
      throw new Error(`Offer redemption failed: ${redemption.reason}`);
    }
  }

  const number = await generateInvoiceNumber(session);

  const invoiceDoc: InvoiceCreatePayload = {
    number,
    status: 'pending' as const,
    userId: toObjectId(input.userId),
    lines: pricing.lines,
    appliedOfferCode: pricing.offer?.code,
    appliedOfferType: pricing.offer?.type,
    appliedOfferDiscount: pricing.offer?.discount ?? 0,
    transportId: pricing.shipping.transportId,
    transportName: pricing.shipping.transportName,
    shippingPrice: pricing.shipping.price,
    shippingBreakdown: pricing.shipping.breakdown,
    shippingPaymentMethod: pricing.shipping.paymentMethod,
    shippingDeferred: pricing.shipping.deferredPrice,
    addressSnapshot: input.address,
    subtotal: pricing.subtotal,
    discountTotal: pricing.discountTotal,
    shippingTotal: pricing.shippingTotal,
    grandTotal: pricing.grandTotal,
    paymentMethod: 'zarinpal',
    paymentMethodData: undefined,
    torobClid: input.torobClid || undefined,
    pricingContext: {
      productTypeVersions: pricing.productTypeVersions,
      transportRowLabel: pricing.shipping.rowLabel,
      offerSnapshot: pricing.offer?.snapshot,
    },
  };

  const createdDocs = await InvoiceModel.create([invoiceDoc], session ? { session } : undefined);
  const created = createdDocs[0];

  try {
    await adjustInventoryForInvoice(created, 'deduct', session);
  } catch (error) {
    if (!session) {
      try {
        await InvoiceModel.deleteOne({ _id: created._id }).exec();
      } catch (cleanupError) {
        console.error('Failed to clean up invoice after inventory adjustment failure', cleanupError);
      }
    }
    throw error;
  }

  try {
    await syncInvoiceTracker(created, session);
  } catch (error) {
    console.warn('Failed to sync invoice tracker after invoice creation', error);
  }

  return {
    created,
    appliedOfferCode: pricing.offer?.code,
  };
}

async function postCreateInvoice(
  created: InvoiceDocument,
  appliedOfferCode?: string,
): Promise<InvoiceDocument> {
  if (appliedOfferCode) {
    // The invoice is already persisted; a cache-revalidation failure must not
    // fail the request (which would prompt a retry → duplicate order).
    try {
      await Promise.all([
        revalidateTag(TAGS.OFFERS),
        revalidateTag(TAGS.OFFER(appliedOfferCode)),
      ]);
    } catch {
      console.warn('revalidateTag failed (background context), skipping');
    }
  }

  const phone = created.addressSnapshot?.phone;
  if (phone) {
    const smsData = buildInvoiceSmsData(created);
    sendOrderConfirmationSms(phone, smsData).catch((err) => {
      console.warn('Order confirmation SMS failed', err);
    });
  }

  return created;
}

async function createInvoiceWithoutTransactions(input: InvoicePricingInput): Promise<InvoiceDocument> {
  const { created, appliedOfferCode } = await executeInvoiceCreation(input);
  return postCreateInvoice(created, appliedOfferCode);
}

export async function createInvoice(input: InvoicePricingInput): Promise<InvoiceDocument> {
  if (!supportsMongoTransactions()) {
    return createInvoiceWithoutTransactions(input);
  }

  const session = await mongoose.startSession();
  let created: InvoiceDocument | undefined;
  let appliedOfferCode: string | undefined;

  try {
    await session.withTransaction(async () => {
      const result = await executeInvoiceCreation(input, session);
      created = result.created;
      appliedOfferCode = result.appliedOfferCode;
    });
  } catch (error) {
    if ((error as { code?: number }).code === 20) {
      await session.endSession();
      return createInvoiceWithoutTransactions(input);
    }
    await session.endSession();
    throw error;
  }

  await session.endSession();

  if (!created) {
    throw new Error('Invoice creation failed');
  }

  return postCreateInvoice(created, appliedOfferCode);
}

export async function getInvoiceById(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  const invoice = (await InvoiceModel.findById(id).lean()) as (Record<string, any> | null);
  if (!invoice) {
    return null;
  }

  const lines = Array.isArray(invoice.lines) ? (invoice.lines as Array<Record<string, unknown>>) : [];
  const needsEnrichment = lines.some(
    (line) =>
      !line ||
      typeof line !== 'object' ||
      typeof line.productSlug !== 'string' ||
      line.productSlug.trim().length === 0 ||
      !line.mediaId,
  );

  if (!needsEnrichment) {
    return invoice;
  }

  const productIds = Array.from(
    new Set(
      lines
        .map((line) => toStringId((line as { productId?: unknown })?.productId))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (productIds.length === 0) {
    return invoice;
  }

  const products = await ProductModel.find({ _id: { $in: productIds.map((pid) => new Types.ObjectId(pid)) } })
    .select({ slug: 1, variants: 1 })
    .lean();

  const productMap = new Map(
    products.map((product) => [toStringId(product._id) ?? '', product]),
  );

  lines.forEach((rawLine) => {
    if (!rawLine || typeof rawLine !== 'object') return;
    const productId = toStringId((rawLine as { productId?: unknown }).productId);
    if (!productId) return;
    const product = productMap.get(productId);
    if (!product) return;

    const line = rawLine as Record<string, unknown>;

    if (typeof product.slug === 'string' && product.slug.trim().length > 0) {
      line.productSlug = product.slug;
    }

    const variantId = toStringId((line.variantId as unknown) ?? undefined);
    if (!variantId) return;

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const variant = variants.find((candidate) => toStringId(candidate?._id) === variantId);
    if (!variant) return;

    if (!line.mediaId) {
      const media = resolvePrimaryMediaId(variant as VariantLean);
      if (media) {
        line.mediaId = media;
      }
    }
  });

  return invoice;
}

export async function listInvoicesForUser(userId: string, limit = 50) {
  const invoices = await InvoiceModel.find({ userId: toObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const invoiceIds = invoices
    .map((invoice) => toStringId(invoice._id))
    .filter((id): id is string => Boolean(id));

  const reviewRequests =
    invoiceIds.length > 0
      ? await ReviewRequestModel.find({ invoiceId: { $in: invoiceIds.map((id) => new Types.ObjectId(id)) } })
        .sort({ updatedAt: -1 })
        .lean()
      : [];

  const reviewMap = new Map<string, (typeof reviewRequests)[number]>();
  reviewRequests.forEach((request) => {
    const key = toStringId(request.invoiceId);
    if (!key) return;
    if (reviewMap.has(key)) {
      return;
    }
    reviewMap.set(key, request);
  });

  const missingReviews = invoices.filter((invoice) => {
    const id = toStringId(invoice._id);
    const finished = invoice.progress?.current === 'order-finished';
    return id && finished && !reviewMap.has(id);
  });

  if (missingReviews.length > 0) {
    await Promise.allSettled(
      missingReviews.map((invoice) =>
        createReviewInvitationForInvoice(invoice as unknown as InvoiceDocument).catch((error) => {
          console.error('Failed to auto-create review invitation', error);
        }),
      ),
    );

    if (invoiceIds.length > 0) {
      const refreshed = await ReviewRequestModel.find({ invoiceId: { $in: invoiceIds.map((id) => new Types.ObjectId(id)) } })
        .sort({ updatedAt: -1 })
        .lean();
      refreshed.forEach((request) => {
        const key = toStringId(request.invoiceId);
        if (!key) return;
        if (reviewMap.has(key)) {
          return;
        }
        reviewMap.set(key, request);
      });
    }
  }

  return invoices.map((invoice) => {
    const id = toStringId(invoice._id);
    const review = id ? reviewMap.get(id) : null;
    return {
      ...invoice,
      reviewToken: review?.token,
      reviewStatus: review?.status,
      reviewExpiresAt: review?.expiresAt,
    };
  });
}

async function updateInvoiceStatusInternal(
  id: string,
  nextStatus: InvoiceStatus,
  session?: ClientSession,
): Promise<InvoiceStatusUpdateResult> {
  try {
    const query = InvoiceModel.findById(id);
    if (session) {
      query.session(session);
    }
    const invoice = await query;
    if (!invoice) {
      return { ok: false as const, reason: 'not_found' };
    }

    const result = await applyInvoiceStatusTransition(invoice, nextStatus, session);
    return result.ok
      ? { ok: true as const, invoice: result.invoice! }
      : { ok: false as const, reason: result.reason! };
  } catch (error) {
    if (error instanceof InventoryAdjustmentError) {
      return { ok: false as const, reason: error.reason };
    }
    throw error;
  }
}

export async function updateInvoiceStatus(
  id: string,
  nextStatus: InvoiceStatus,
  session?: ClientSession,
): Promise<InvoiceStatusUpdateResult> {
  if (!Types.ObjectId.isValid(id)) return { ok: false, reason: 'invalid_id' };
  const result = await updateInvoiceStatusImpl(id, nextStatus, session);
  // Push the invoice into the Holoo accounting service once it is paid. Runs
  // fire-and-forget after commit; no-op unless Holoo auto-sync is configured.
  if (result.ok && nextStatus === 'paid') {
    scheduleHolooInvoiceSync(id);
  }
  // When an invoice is canceled or refunded, sync the return to Holoo
  if (result.ok && (nextStatus === "canceled" || nextStatus === "refunded")) {
    scheduleHolooReturnSync(id);
  }
  return result;
}

async function updateInvoiceStatusImpl(
  id: string,
  nextStatus: InvoiceStatus,
  session?: ClientSession,
): Promise<InvoiceStatusUpdateResult> {
  if (session) {
    return updateInvoiceStatusInternal(id, nextStatus, session);
  }

  if (supportsMongoTransactions()) {
    const managedSession = await mongoose.startSession();
    try {
      let result: InvoiceStatusUpdateResult | undefined;
      await managedSession.withTransaction(async () => {
        result = await updateInvoiceStatusInternal(id, nextStatus, managedSession);
      });
      return result ?? { ok: false as const, reason: 'unknown_error' };
    } catch (error) {
      if (error instanceof InventoryAdjustmentError) {
        return { ok: false as const, reason: error.reason };
      }
      throw error;
    } finally {
      await managedSession.endSession();
    }
  }

  return updateInvoiceStatusInternal(id, nextStatus);
}

type UpdateInvoiceProgressOptions = {
  trackingCode?: string;
};

export async function updateInvoiceProgress(
  id: string,
  nextProgress: InvoiceProgressState,
  options?: UpdateInvoiceProgressOptions,
  session?: ClientSession,
): Promise<InvoiceProgressUpdateResult> {
  if (!Types.ObjectId.isValid(id)) return { ok: false, reason: 'invalid_id' };
  const query = InvoiceModel.findById(id);
  if (session) {
    query.session(session);
  }
  const invoice = await query;
  if (!invoice) {
    return { ok: false as const, reason: 'not_found' };
  }
  if (invoice.status !== 'paid') {
    return { ok: false as const, reason: 'status_not_paid' };
  }
  if (isInvoiceFrozen(invoice)) {
    return { ok: false as const, reason: 'invoice_frozen' };
  }
  const currentProgress = invoice.progress?.current as InvoiceProgressState | undefined;
  if (!canTransitionProgress(currentProgress, nextProgress)) {
    return { ok: false as const, reason: 'invalid_progress_transition' };
  }

  const trackingCode = sanitizeTrackingCode(options?.trackingCode);
  const previousTracking = invoice.progress?.packagedPostedTrackingNumber ?? undefined;
  if (nextProgress === 'packaged-posted' && !trackingCode) {
    return { ok: false as const, reason: 'tracking_code_required' };
  }

  if (currentProgress === nextProgress) {
    if (nextProgress !== 'packaged-posted') {
      return { ok: true as const, invoice };
    }
    if (trackingCode === previousTracking) {
      return { ok: true as const, invoice };
    }
  }

  await applyInvoiceProgressTransition(invoice, nextProgress, session, { trackingCode });

  if (nextProgress === 'packaged-posted' && trackingCode && trackingCode !== previousTracking) {
    const receptor = invoice.addressSnapshot?.phone;
    if (receptor) {
      const payload = {
        trackingCode,
        orderNumber: invoice.number,
        transportName: invoice.transportName ?? '',
      };
      sendShipmentTrackingSms(receptor, payload).catch((error) => {
        console.error('Failed to send shipment tracking SMS', error);
      });
    }
  }

  if (nextProgress === 'order-finished') {
    createReviewInvitationForInvoice(invoice).catch((error) => {
      console.error('Failed to enqueue review invitation SMS', error);
    });
  }

  return { ok: true as const, invoice };
}

async function applyInvoiceStatusTransition(
  invoice: InvoiceDocument,
  nextStatus: InvoiceStatus,
  session?: ClientSession,
): Promise<{ ok: true; invoice: InvoiceDocument } | { ok: false; reason: string }> {
  const currentStatus = invoice.status;

  if (currentStatus === nextStatus) {
    return { ok: true as const, invoice };
  }

  if (isInvoiceFrozen(invoice)) {
    return { ok: false as const, reason: 'invoice_frozen' };
  }

  if (!canTransition(currentStatus, nextStatus)) {
    return { ok: false as const, reason: 'invalid_transition' };
  }

  if (currentStatus === 'draft' && nextStatus === 'pending') {
    await adjustInventoryForInvoice(invoice, 'deduct', session);
  }

  if (currentStatus === 'pending' && nextStatus === 'canceled') {
    await adjustInventorySafely(invoice, 'restore', session, 'status_transition_pending_to_canceled');
    await releaseInvoiceOffer(invoice, session);
  }

  if (currentStatus === 'paid' && (nextStatus === 'refunded' || nextStatus === 'canceled')) {
    await adjustInventorySafely(invoice, 'restore', session, 'status_transition_paid_to_refunded');
    await releaseInvoiceOffer(invoice, session);
  }

  const now = new Date();
  const setPayload: Record<string, unknown> = { status: nextStatus, updatedAt: now };

  if (currentStatus === 'pending' && nextStatus === 'canceled') {
    const paymentData =
      typeof invoice.paymentMethodData === 'object' && invoice.paymentMethodData !== null && !Array.isArray(invoice.paymentMethodData)
        ? (invoice.paymentMethodData as Record<string, unknown>)
        : {};
    const rawPaymentStatus = typeof paymentData.status === 'string' ? paymentData.status.trim().toLowerCase() : '';
    if (!['paid', 'verified', 'settled', 'success', 'succeeded', 'failed', 'canceled', 'cancelled', 'expired'].includes(rawPaymentStatus)) {
      setPayload['paymentMethodData.status'] = 'expired';
      setPayload['paymentMethodData.expiredAt'] = now;
    }
  }

  await InvoiceModel.updateOne(
    { _id: invoice._id },
    { $set: setPayload },
    { session },
  ).exec();

  invoice.status = nextStatus;
  invoice.updatedAt = now;

  await syncInvoiceTracker(invoice, session);

  return { ok: true as const, invoice };
}

async function cancelExpiredPendingInvoicesBatch(): Promise<void> {
  try {
    await connectMongoose();
  } catch (error) {
    console.error('Invoice expiration sweep failed to connect to MongoDB', error);
    return;
  }

  const threshold = new Date(Date.now() - TEN_MINUTES_MS);

  const candidates = await InvoiceModel.find(
    { status: 'pending', createdAt: { $lte: threshold } },
    { _id: 1 },
  )
    .sort({ createdAt: 1 })
    .limit(EXPIRED_INVOICE_SWEEP_BATCH_SIZE)
    .lean()
    .exec();

  if (candidates.length === 0) {
    return;
  }

  for (const candidate of candidates) {
    const id = String(candidate._id);
    try {
      const result = await updateInvoiceStatus(id, 'canceled');

      if (!result.ok && result.reason !== 'invalid_transition' && result.reason !== 'not_found') {
        console.warn(`Failed to auto-cancel expired invoice ${id}: ${result.reason}`);
      }
    } catch (error) {
      console.error(`Error auto-canceling expired invoice ${id}`, error);
    }
  }
}

async function forceCompleteInvoiceProgress(invoiceId: string): Promise<void> {
  const invoice = await InvoiceModel.findById(invoiceId);
  if (!invoice) {
    return;
  }
  if (invoice.progress?.current === 'order-finished') {
    return;
  }
  await applyInvoiceProgressTransition(invoice, 'order-finished');
  createReviewInvitationForInvoice(invoice).catch((error) => {
    console.error('Failed to enqueue review invitation SMS (auto-finalize)', error);
  });
}

async function finalizeOverdueShippedInvoicesBatch(): Promise<void> {
  try {
    await connectMongoose();
  } catch (error) {
    console.error('Invoice progress sweep failed to connect to MongoDB', error);
    return;
  }

  const threshold = new Date(Date.now() - AUTO_FINISH_LOOKBACK_MS);
  const candidates = await InvoiceModel.find(
    {
      'progress.current': 'packaged-posted',
      'progress.packagedPostedAt': { $lte: threshold },
      $or: [
        { 'progress.orderFinishedAt': { $exists: false } },
        { 'progress.orderFinishedAt': null },
      ],
    },
    { _id: 1 },
  )
    .sort({ 'progress.packagedPostedAt': 1 })
    .limit(PROGRESS_AUTO_COMPLETE_BATCH_SIZE)
    .lean()
    .exec();

  if (candidates.length === 0) {
    return;
  }

  for (const candidate of candidates) {
    const id = String(candidate._id);
    try {
      await forceCompleteInvoiceProgress(id);
    } catch (error) {
      console.error(`Error auto-finalizing invoice ${id}`, error);
    }
  }
}

async function runInvoiceMaintenanceSweep(): Promise<void> {
  if (schedulerState.__invoiceMaintenanceSweepInFlight) {
    return;
  }
  schedulerState.__invoiceMaintenanceSweepInFlight = true;
  try {
    await cancelExpiredPendingInvoicesBatch();
    await finalizeOverdueShippedInvoicesBatch();
  } finally {
    schedulerState.__invoiceMaintenanceSweepInFlight = false;
  }
}

function ensureInvoiceMaintenanceScheduler(): void {
  if (typeof window !== 'undefined') {
    return;
  }
  // Importing route modules during `next build` must not start background work.
  // The scheduler also has nothing useful to do until a Mongo connection is
  // configured (local tests and static analysis intentionally omit it).
  if (process.env.NEXT_PHASE === 'phase-production-build' || !process.env.MONGO_URI?.trim()) {
    return;
  }
  // Opt-out flag: the public-facing instance sets DISABLE_BACKGROUND_JOBS=1 so
  // recurring maintenance runs only in the dedicated worker instance. Defaults
  // to enabled, so single-instance / dev setups are unaffected.
  if (process.env.DISABLE_BACKGROUND_JOBS === '1') {
    return;
  }
  if (!schedulerState.__invoiceMaintenanceInterval) {
    schedulerState.__invoiceMaintenanceInterval = setInterval(() => {
      runInvoiceMaintenanceSweep().catch((error) => {
        console.error('Invoice maintenance sweep failed', error);
      });
    }, INVOICE_MAINTENANCE_SWEEP_INTERVAL_MS);
    if (typeof schedulerState.__invoiceMaintenanceInterval.unref === 'function') {
      schedulerState.__invoiceMaintenanceInterval.unref();
    }
    runInvoiceMaintenanceSweep().catch((error) => {
      console.error('Initial invoice maintenance sweep failed', error);
    });
  }
}

ensureInvoiceMaintenanceScheduler();
