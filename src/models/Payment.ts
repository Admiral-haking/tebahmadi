import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const COLLECTION = 'payment_transactions';

const paymentSchema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    authority: { type: String },
    refId: { type: String },
    description: { type: String },
    email: { type: String },
    mobile: { type: String },
    callbackURL: { type: String, required: true },
    gateway: { type: String, required: true, enum: ['zarinpal', 'torob', 'azkivam', 'digipay', 'snapppay', 'bajetpay'], default: 'zarinpal' },
    requestKey: { type: String, trim: true, maxlength: 128 },
    gatewayUrl: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['initiated', 'requested', 'redirected', 'verified', 'paid', 'failed', 'canceled'],
      default: 'initiated',
    },
    verifyPayload: { type: Schema.Types.Mixed },
    errorCode: { type: Number },
    errorMessage: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentSchema.index({ invoiceId: 1, createdAt: -1 });
paymentSchema.index({ authority: 1 }, { unique: true, sparse: true });
paymentSchema.index({ refId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index(
  { invoiceId: 1, gateway: 1, requestKey: 1 },
  { unique: true, partialFilterExpression: { requestKey: { $type: 'string' } } },
);

export type PaymentTransactionDocument = InferSchemaType<typeof paymentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PaymentTransactionModel =
  (mongoose.models.PaymentTransaction as mongoose.Model<PaymentTransactionDocument>) ||
  mongoose.model<PaymentTransactionDocument>('PaymentTransaction', paymentSchema, COLLECTION);
