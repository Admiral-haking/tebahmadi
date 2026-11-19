import { model, models, Schema, type InferSchemaType } from "mongoose";

const COLLECTION = "sync_jobs";

const syncJobSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["orders-from-services", "stock-from-services", "stock-to-services"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["queued", "running", "succeeded", "failed"],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 3, min: 1 },
    // Times the worker died mid-run and the job was reclaimed (stale lock). Kept
    // separate from `attempts` so an interruption (e.g. a deploy/restart) is not
    // counted as a failed retry — otherwise the job looped forever as "5 of 3".
    interruptions: { type: Number, default: 0, min: 0 },
    runAfter: { type: Date, default: () => new Date(), index: true },
    lockedAt: { type: Date },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    lastError: { type: String },
    payload: { type: Schema.Types.Mixed },
    // Metrics from the last successful run (durations + push/reconcile counts),
    // surfaced in the marketplace-health dashboard.
    result: { type: Schema.Types.Mixed },
    durationMs: { type: Number },
  },
  { timestamps: true },
);

syncJobSchema.index({ status: 1, runAfter: 1, createdAt: 1 });
syncJobSchema.index({ type: 1, status: 1, createdAt: -1 });

export type SyncJobDocument = InferSchemaType<typeof syncJobSchema> & {
  _id: import("mongoose").Types.ObjectId;
};

export const SyncJobModel =
  (models.SyncJob as import("mongoose").Model<SyncJobDocument>) ||
  model<SyncJobDocument>("SyncJob", syncJobSchema, COLLECTION);
