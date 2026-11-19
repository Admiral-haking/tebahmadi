import mongoose, { InferSchemaType, Schema } from 'mongoose';

const COLLECTION = 'transport_carriers';

const pricingRowSchema = new Schema(
  {
    destRegion: {
      type: String,
      trim: true,
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    baseWeightLimit: {
      type: Number,
      required: true,
      min: 0,
    },
    baseWeightUnit: {
      type: String,
      enum: ['g', 'kg'],
      required: true,
    },
    overageStepWeight: {
      type: Number,
      required: true,
      min: 0,
    },
    overageStepUnit: {
      type: String,
      enum: ['g', 'kg'],
      required: true,
    },
    overageStepPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    maxWeight: {
      type: Number,
      min: 0,
    },
    label: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const transportSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    pricingRows: {
      type: [pricingRowSchema],
      default: [],
      validate: {
        validator(rows: unknown[]) {
          return Array.isArray(rows) && rows.length > 0;
        },
        message: 'At least one pricing row is required',
      },
    },
  },
  { timestamps: true }
);

transportSchema.index({ isActive: 1 });

export type TransportDocument = InferSchemaType<typeof transportSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const TransportModel =
  (mongoose.models.Transport as mongoose.Model<TransportDocument>) ||
  mongoose.model<TransportDocument>('Transport', transportSchema, COLLECTION);
