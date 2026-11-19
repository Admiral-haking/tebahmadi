import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const COLLECTION = 'product_reviews';

const productReviewSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: 'ReviewRequest' },
    invoiceId: { type: Schema.Types.ObjectId, required: true, index: true },
    productId: { type: Schema.Types.ObjectId, required: true, index: true },
    productSlug: { type: String, required: true, trim: true },
    productTitle: { type: String, required: true, trim: true },
    variantId: { type: Schema.Types.ObjectId },
    variantSummary: { type: String, trim: true },
    sku: { type: String, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
    authorName: { type: String, trim: true },
    phone: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'published'], default: 'pending' },
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId },
    orderNumber: { type: String, trim: true },
    lineKey: { type: String, required: true },
  },
  { timestamps: true },
);

productReviewSchema.index({ invoiceId: 1, lineKey: 1 }, { unique: true });
productReviewSchema.index({ productId: 1, status: 1, createdAt: -1 });

export type ProductReviewDocument = InferSchemaType<typeof productReviewSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ProductReviewModel =
  (mongoose.models.ProductReview as mongoose.Model<ProductReviewDocument>) ||
  mongoose.model<ProductReviewDocument>('ProductReview', productReviewSchema, COLLECTION);
