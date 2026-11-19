import mongoose, { Schema, type InferSchemaType } from "mongoose";

const COLLECTION = "error_logs";

const errorLogSchema = new Schema(
  {
    level: {
      type: String,
      enum: ["error", "warning", "info"],
      default: "error",
      index: true,
    },
    category: {
      type: String,
      enum: ["api", "payment", "sync", "marketplace", "ai", "system"],
      default: "system",
      index: true,
    },
    source: { type: String, required: true, trim: true, index: true },
    message: { type: String, required: true, trim: true },
    stack: { type: String },
    statusCode: { type: Number, min: 100, max: 599 },
    route: { type: String, trim: true },
    method: { type: String, trim: true },
    userId: { type: Schema.Types.ObjectId, index: true },
    fingerprint: { type: String, trim: true, index: true },
    metadata: { type: Schema.Types.Mixed },
    resolvedAt: { type: Date, index: true },
    resolvedBy: { type: Schema.Types.ObjectId },
    resolvedNote: { type: String, trim: true },
  },
  { timestamps: true },
);

errorLogSchema.index({ createdAt: -1 });
errorLogSchema.index({ level: 1, category: 1, createdAt: -1 });
errorLogSchema.index({ message: "text", source: "text", route: "text" });

export type ErrorLogDocument = InferSchemaType<typeof errorLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ErrorLogModel =
  (mongoose.models.ErrorLog as mongoose.Model<ErrorLogDocument>) ||
  mongoose.model<ErrorLogDocument>("ErrorLog", errorLogSchema, COLLECTION);
