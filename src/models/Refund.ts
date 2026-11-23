import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const refundSchema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, required: true, index: true },
    paymentTransactionId: { type: Schema.Types.ObjectId, index: true },
    amount: { type: Number, required: true, min: 0 },
    gateway: { type: String, trim: true },
    gatewayRefId: { type: String, trim: true },
    reason: { type: String, trim: true },
    status: {
      type: String,
      enum: ['recorded', 'requested', 'completed', 'failed', 'rejected'],
      default: 'recorded',
      required: true,
    },
    requestedAt: { type: Date },
    requestedBy: { type: Schema.Types.ObjectId },
    /** Idempotency scope: `full` or a caller-supplied stable partial-refund key. */
    operation: { type: String, trim: true, maxlength: 160 },
    completedAt: { type: Date },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

refundSchema.index({ invoiceId: 1, createdAt: -1 });
refundSchema.index({ status: 1, createdAt: -1 });
// A gateway action is claimed before it is sent. Partial indexing preserves
// historical/manual `recorded` rows while making active operations idempotent.
refundSchema.index(
  { invoiceId: 1, gateway: 1, operation: 1 },
  {
    unique: true,
    name: 'active_refund_operation_unique',
    partialFilterExpression: {
      status: { $in: ['requested', 'completed'] },
      operation: { $type: 'string' },
      gateway: { $type: 'string' },
    },
  },
);

export type RefundDocument = InferSchemaType<typeof refundSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const RefundModel =
  (mongoose.models.Refund as mongoose.Model<RefundDocument>) ||
  mongoose.model<RefundDocument>('Refund', refundSchema, 'refunds');
