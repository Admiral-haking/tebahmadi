import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const COLLECTION = 'site_config';

const smsTemplateSchema = new Schema(
  {
    template: { type: String, required: true, trim: true },
    variables: { type: [String], default: [], validate: (value: unknown[]) => Array.isArray(value) },
  },
  { _id: false }
);

const smartPopupStepSchema = new Schema(
  {
    title: { type: String, trim: true, default: '' },
    body: { type: String, trim: true, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    imageMediaId: { type: String, trim: true, default: '' },
    actionLabel: { type: String, trim: true, default: '' },
    actionHref: { type: String, trim: true, default: '' },
    aiTextPrompt: { type: String, trim: true, default: '' },
    aiImagePrompt: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const smartPopupSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    version: { type: String, trim: true, default: '1' },
    showOnce: { type: Boolean, default: true },
    delayMs: { type: Number, min: 0, default: 1200 },
    pages: { type: [String], default: [] },
    steps: { type: [smartPopupStepSchema], default: [] },
  },
  { _id: false }
);

const siteConfigSchema = new Schema(
  {
    isOnboardingComplete: { type: Boolean, default: false },
    requiredKeys: { type: [String], default: undefined },
    values: { type: Schema.Types.Mixed, default: {} },
    smsTemplates: {
      orderConfirmation: { type: smsTemplateSchema, default: undefined },
      paymentReceipt: { type: smsTemplateSchema, default: undefined },
      loginCode: { type: smsTemplateSchema, default: undefined },
      shipmentTracking: { type: smsTemplateSchema, default: undefined },
      reviewRequest: { type: smsTemplateSchema, default: undefined },
    },
    smartPopup: { type: smartPopupSchema, default: undefined },
  },
  { timestamps: true }
);

export type SiteConfigDocument = InferSchemaType<typeof siteConfigSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SiteConfigModel =
  (mongoose.models.SiteConfig as mongoose.Model<SiteConfigDocument>) ||
  mongoose.model<SiteConfigDocument>('SiteConfig', siteConfigSchema, COLLECTION);
