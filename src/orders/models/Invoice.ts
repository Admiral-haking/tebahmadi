import mongoose, { InferSchemaType, Schema } from 'mongoose';
import { INVOICE_PROGRESS_STATES } from '@/orders/constants/progress';

const COLLECTION = 'invoices';
export const DEFAULT_INVOICE_PAYMENT_METHOD = 'zarinpal';

const lineSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, required: true },
    productSlug: { type: String, required: true, trim: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    sku: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    variantSummary: { type: String, trim: true },
    priceModel: { type: String, enum: ['fixed', 'per_unit'], required: true },
    unitOfMeasure: {
      type: String,
      enum: ['unit', 'pair', 'kg', 'g', 'lb', 'oz', 'l', 'ml'],
    },
    qty: { type: Number, min: 0 },
    requestedQty: { type: Number, min: 0 },
    requestedUnit: { type: String, trim: true },
    unitPriceBase: { type: Number, required: true, min: 0 },
    variantOfferAmount: { type: Number, min: 0 },
    unitPriceEffective: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    weightGrams: { type: Number, min: 0 },
    attributesSnapshot: { type: Schema.Types.Mixed },
    mediaId: { type: Schema.Types.ObjectId },
  },
  { _id: false }
);

const shippingBreakdownSchema = new Schema(
  {
    basePrice: { type: Number, required: true },
    steps: { type: Number, required: true },
    stepPrice: { type: Number, required: true },
  },
  { _id: false }
);

const progressHistorySchema = new Schema(
  {
    state: { type: String, enum: INVOICE_PROGRESS_STATES, required: true },
    changedAt: { type: Date, required: true },
    trackingNumber: { type: String, trim: true },
  },
  { _id: false }
);

const progressSchema = new Schema(
  {
    current: { type: String, enum: INVOICE_PROGRESS_STATES },
    inProgressAt: { type: Date },
    packagedPostedAt: { type: Date },
    orderFinishedAt: { type: Date },
    history: { type: [progressHistorySchema], default: undefined },
    packagedPostedTrackingNumber: { type: String, trim: true },
  },
  { _id: false }
);

const invoiceSchema = new Schema(
  {
    number: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['draft', 'pending', 'paid', 'canceled', 'refunded'],
      default: 'pending',
    },
    userId: { type: Schema.Types.ObjectId, required: true },
    lines: { type: [lineSchema], required: true },
    appliedOfferCode: { type: String, uppercase: true, trim: true },
    appliedOfferType: { type: String, enum: ['percentage', 'absolute', 'transport'] },
    appliedOfferDiscount: { type: Number, min: 0 },
    transportId: { type: Schema.Types.ObjectId, required: true },
    transportName: { type: String, required: true, trim: true },
    shippingPrice: { type: Number, required: true, min: 0 },
    shippingBreakdown: shippingBreakdownSchema,
    shippingPaymentMethod: {
      type: String,
      enum: ['online', 'on_delivery'],
      default: 'online',
    },
    shippingDeferred: { type: Number, min: 0, default: 0 },
    addressSnapshot: {
      fname: { type: String, required: true, trim: true },
      lname: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      state: { type: String, trim: true },
      city: { type: String, trim: true },
      address: { type: String, trim: true },
      postalCode: { type: String, trim: true },
    },
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, min: 0 },
    shippingTotal: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      trim: true,
      default: DEFAULT_INVOICE_PAYMENT_METHOD,
    },
    paymentMethodData: { type: Schema.Types.Mixed },
    pricingContext: {
      productTypeVersions: Schema.Types.Mixed,
      transportRowLabel: { type: String, trim: true },
      offerSnapshot: Schema.Types.Mixed,
    },
    torobClid: { type: String, trim: true },
    progress: progressSchema,
  },
  { timestamps: true }
);

invoiceSchema.index({ number: 1 }, { unique: true });
invoiceSchema.index({ userId: 1, createdAt: -1 });
invoiceSchema.index({ torobClid: 1, createdAt: 1 });

export type InvoiceDocument = InferSchemaType<typeof invoiceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const InvoiceModel =
  (mongoose.models.Invoice as mongoose.Model<InvoiceDocument>) ||
  mongoose.model<InvoiceDocument>('Invoice', invoiceSchema, COLLECTION);
