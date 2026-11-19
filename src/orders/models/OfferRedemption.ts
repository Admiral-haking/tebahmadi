import mongoose, { Schema } from 'mongoose';

const COLLECTION = 'offer_redemptions';

const offerRedemptionSchema = new Schema(
  {
    offerId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    count: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
);

offerRedemptionSchema.index({ offerId: 1, userId: 1 }, { unique: true });

export interface OfferRedemptionDocument extends mongoose.Document {
  offerId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  count: number;
}

export const OfferRedemptionModel =
  (mongoose.models.OfferRedemption as mongoose.Model<OfferRedemptionDocument>) ||
  mongoose.model<OfferRedemptionDocument>('OfferRedemption', offerRedemptionSchema, COLLECTION);
