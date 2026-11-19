import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const COLLECTION = 'pages';

const seoSchema = new Schema(
  {
    title: { type: String },
    description: { type: String },
    canonical: { type: String },
    noindex: { type: Boolean },
    ogImageId: { type: Schema.Types.ObjectId },
    jsonLd: Schema.Types.Mixed,
  },
  { _id: false }
);

const pageSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    content: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    publishedAt: { type: Date },
    seo: { type: seoSchema, default: undefined },
  },
  { timestamps: true }
);

pageSchema.index({ status: 1, publishedAt: -1 });

export type PageDocument = InferSchemaType<typeof pageSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PageModel =
  (mongoose.models.Page as mongoose.Model<PageDocument>) ||
  mongoose.model<PageDocument>('Page', pageSchema, COLLECTION);
