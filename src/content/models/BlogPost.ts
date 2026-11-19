import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const COLLECTION = 'blog_posts';

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

const blogPostSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true },
    excerpt: { type: String },
    content: { type: String, required: true },
    coverImageId: { type: Schema.Types.ObjectId },
    categories: { type: [Schema.Types.ObjectId], ref: 'BlogCategory', default: [] },
    tags: { type: [String], default: undefined },
    authorId: { type: Schema.Types.ObjectId },
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

blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ categories: 1 });
blogPostSchema.index({ title: 'text', excerpt: 'text', content: 'text' });

export type BlogPostDocument = InferSchemaType<typeof blogPostSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BlogPostModel =
  (mongoose.models.BlogPost as mongoose.Model<BlogPostDocument>) ||
  mongoose.model<BlogPostDocument>('BlogPost', blogPostSchema, COLLECTION);
