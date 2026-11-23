import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const COLLECTION = 'recommendation_metrics';

export const RECOMMENDATION_SOURCES = ['cart', 'pdp'] as const;
export const RECOMMENDATION_EVENTS = ['impression', 'click', 'add'] as const;
export const RECOMMENDATION_ALGOS = ['copurchase', 'category', 'curated', 'explicit_bundle'] as const;

const recommendationMetricSchema = new Schema(
  {
    source: { type: String, enum: RECOMMENDATION_SOURCES, required: true },
    event: { type: String, enum: RECOMMENDATION_EVENTS, required: true },
    algo: { type: String, enum: RECOMMENDATION_ALGOS, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    contextProductIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

recommendationMetricSchema.index({ source: 1, event: 1, createdAt: -1 });
recommendationMetricSchema.index({ algo: 1, event: 1, createdAt: -1 });

export type RecommendationMetricDocument = InferSchemaType<typeof recommendationMetricSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RecommendationMetricModel =
  (mongoose.models.RecommendationMetric as mongoose.Model<RecommendationMetricDocument>) ||
  mongoose.model<RecommendationMetricDocument>('RecommendationMetric', recommendationMetricSchema, COLLECTION);
