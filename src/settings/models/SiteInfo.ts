import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const COLLECTION = 'site_info';

const addressSchema = new Schema(
  {
    label: { type: String },
    address: { type: String, required: true },
  },
  { _id: false }
);

const phoneSchema = new Schema(
  {
    label: { type: String },
    number: { type: String, required: true },
  },
  { _id: false }
);

const socialSchema = new Schema(
  {
    platform: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const imageVariantSchema = new Schema(
  {
    originalId: { type: Schema.Types.ObjectId, required: true },
    mobileId: { type: Schema.Types.ObjectId },
    thumbId: { type: Schema.Types.ObjectId },
    groupId: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false }
);

const siteInfoSchema = new Schema(
  {
    appName: { type: String, required: true },
    description: { type: String },
    addresses: { type: [addressSchema], default: undefined },
    bio: { type: String },
    phones: { type: [phoneSchema], default: undefined },
    socials: { type: [socialSchema], default: undefined },
    customData: { type: Schema.Types.Mixed },
    logo: { type: imageVariantSchema, default: undefined },
  },
  { timestamps: true }
);

export type SiteInfoDocument = InferSchemaType<typeof siteInfoSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SiteInfoModel =
  (mongoose.models.SiteInfo as mongoose.Model<SiteInfoDocument>) ||
  mongoose.model<SiteInfoDocument>('SiteInfo', siteInfoSchema, COLLECTION);
