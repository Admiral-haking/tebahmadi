import mongoose, { InferSchemaType, Schema } from 'mongoose';

const COLLECTION = 'offers';

const offerSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ['percentage', 'absolute', 'transport'],
      required: true,
    },
    amount: {
      type: Number,
      min: 0,
    },
    startsAt: Date,
    endsAt: Date,
    usageLimitTotal: {
      type: Number,
      min: 0,
    },
    usageLimitPerUser: {
      type: Number,
      min: 0,
    },
    minOrderSubtotal: {
      type: Number,
      min: 0,
    },
    allowedProductTypeIds: [{ type: Schema.Types.ObjectId }],
    allowedCategoryIds: [{ type: Schema.Types.ObjectId }],
    allowedUserIds: [{ type: Schema.Types.ObjectId }],
    isActive: {
      type: Boolean,
      default: true,
    },
    timesRedeemed: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
    },
  },
  { timestamps: true }
);

offerSchema.index({ code: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
offerSchema.index({ isActive: 1, startsAt: 1, endsAt: 1 });

export type OfferDocument = InferSchemaType<typeof offerSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OfferModel =
  (mongoose.models.Offer as mongoose.Model<OfferDocument>) ||
  mongoose.model<OfferDocument>('Offer', offerSchema, COLLECTION);
