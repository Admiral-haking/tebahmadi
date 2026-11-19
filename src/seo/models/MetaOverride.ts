import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const COLLECTION = 'meta_overrides';

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

const metaOverrideSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    seo: { type: seoSchema, default: undefined },
  },
  { timestamps: true }
);

export type MetaOverrideDocument = InferSchemaType<typeof metaOverrideSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const MetaOverrideModel =
  (mongoose.models.MetaOverride as mongoose.Model<MetaOverrideDocument>) ||
  mongoose.model<MetaOverrideDocument>('MetaOverride', metaOverrideSchema, COLLECTION);
