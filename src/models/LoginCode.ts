import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose';

export interface LoginCodeSchema {
  phone: string;
  code: string;
  expiresAt: Date;
  attempts: number;
  lastRequestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type LoginCodeDocument = HydratedDocument<LoginCodeSchema>;

const loginCodeSchema = new Schema<LoginCodeSchema>(
  {
    phone: { type: String, required: true },
    code: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastRequestedAt: { type: Date },
  },
  { timestamps: true },
);

loginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
loginCodeSchema.index({ phone: 1 }, { unique: true });

const LoginCodeModel: Model<LoginCodeSchema> =
  models.LoginCode || model<LoginCodeSchema>('LoginCode', loginCodeSchema);

export default LoginCodeModel;
