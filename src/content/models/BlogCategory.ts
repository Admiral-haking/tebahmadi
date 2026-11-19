import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const COLLECTION = 'blog_categories';

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

const blogCategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'BlogCategory', default: null },
    path: { type: String, required: true, trim: true, unique: true },
    ancestors: { type: [Schema.Types.ObjectId], default: [] },
    depth: { type: Number, required: true, default: 0 },
    position: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    seo: { type: seoSchema, default: undefined },
  },
  { timestamps: true }
);

blogCategorySchema.index({ parentId: 1, slug: 1 }, { unique: true });
blogCategorySchema.index({ ancestors: 1 });
blogCategorySchema.index({ parentId: 1, position: 1 });

export type BlogCategoryDocument = InferSchemaType<typeof blogCategorySchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BlogCategoryModel =
  (mongoose.models.BlogCategory as mongoose.Model<BlogCategoryDocument>) ||
  mongoose.model<BlogCategoryDocument>('BlogCategory', blogCategorySchema, COLLECTION);
