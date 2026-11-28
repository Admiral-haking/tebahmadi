import { model, models, Schema, type InferSchemaType } from 'mongoose';

export const TAPIN_SHIPMENT_JOB_STATES = [
  'queued',
  'running',
  'succeeded',
  'blocked',
  'failed',
] as const;

export type TapinShipmentJobState = (typeof TAPIN_SHIPMENT_JOB_STATES)[number];

const COLLECTION = 'tapin_shipment_jobs';

const tapinShipmentJobSchema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    manualId: { type: String, required: true, trim: true, maxlength: 128 },
    state: {
      type: String,
      enum: TAPIN_SHIPMENT_JOB_STATES,
      required: true,
      default: 'queued',
      index: true,
    },
    attempts: { type: Number, required: true, min: 0, default: 0 },
    maxAttempts: { type: Number, required: true, min: 1, max: 5, default: 3 },
    interruptions: { type: Number, required: true, min: 0, default: 0 },
    nextRunAt: { type: Date, required: true, default: () => new Date(), index: true },
    lockedAt: { type: Date },
    lockedBy: { type: String, trim: true, maxlength: 160 },
    heartbeatAt: { type: Date },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    lastErrorCode: { type: String, trim: true, maxlength: 100 },
    lastErrorMessage: { type: String, trim: true, maxlength: 500 },
    quoteSnapshot: { type: Schema.Types.Mixed },
    result: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

tapinShipmentJobSchema.index({ state: 1, nextRunAt: 1, createdAt: 1 });
tapinShipmentJobSchema.index({ state: 1, lockedAt: 1 });

export type TapinShipmentJobDocument = InferSchemaType<typeof tapinShipmentJobSchema> & {
  _id: import('mongoose').Types.ObjectId;
};

export const TapinShipmentJobModel =
  (models.TapinShipmentJob as import('mongoose').Model<TapinShipmentJobDocument>) ||
  model<TapinShipmentJobDocument>('TapinShipmentJob', tapinShipmentJobSchema, COLLECTION);
