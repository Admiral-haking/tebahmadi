import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const COLLECTION = 'review_requests';

const reviewRequestSchema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, index: true },
    phone: { type: String, required: true, trim: true },
    codeHash: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'completed', 'expired'], default: 'pending' },
    attempts: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
    submittedAt: { type: Date },
    lastVerifiedAt: { type: Date },
    orderNumber: { type: String, trim: true },
  },
  { timestamps: true },
);

reviewRequestSchema.index({ invoiceId: 1, status: 1 });
reviewRequestSchema.index({ expiresAt: 1 });

export type ReviewRequestDocument = InferSchemaType<typeof reviewRequestSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ReviewRequestModel =
  (mongoose.models.ReviewRequest as mongoose.Model<ReviewRequestDocument>) ||
  mongoose.model<ReviewRequestDocument>('ReviewRequest', reviewRequestSchema, COLLECTION);
