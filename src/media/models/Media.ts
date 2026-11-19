import { Schema, model, models, type HydratedDocument, type Model, Types } from 'mongoose';
import type { MediaKind, MediaScope } from '@/types';

export interface MediaSchema {
  groupId: Types.ObjectId;
  kind: MediaKind;
  scope: MediaScope;
  originalId: Types.ObjectId;
  mobileId?: Types.ObjectId;
  thumbId?: Types.ObjectId;
  filename: string;
  contentType: string;
  ownerUserId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type MediaDocument = HydratedDocument<MediaSchema>;

export type MediaLean = Omit<MediaSchema, 'groupId' | 'originalId' | 'mobileId' | 'thumbId' | 'ownerUserId'> & {
  _id: string;
  id: string;
  groupId: string;
  originalId: string;
  mobileId?: string;
  thumbId?: string;
  ownerUserId?: string;
};

const mediaSchema = new Schema<MediaSchema>(
  {
    groupId: { type: Schema.Types.ObjectId, required: true },
    kind: {
      type: String,
      enum: ['image', 'file'],
      required: true,
    },
    scope: {
      type: String,
      enum: ['avatar', 'attachment', 'gallery'],
      required: true,
      index: true,
    },
    originalId: { type: Schema.Types.ObjectId, required: true },
    mobileId: { type: Schema.Types.ObjectId },
    thumbId: { type: Schema.Types.ObjectId },
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    ownerUserId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

mediaSchema.index({ scope: 1, ownerUserId: 1, createdAt: -1 });
mediaSchema.index({ groupId: 1 });

mediaSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret: any) => {
    if (ret._id instanceof Types.ObjectId) {
      ret.id = ret._id.toString();
      ret._id = ret._id.toString();
    }
    if (ret.groupId instanceof Types.ObjectId) ret.groupId = ret.groupId.toString();
    if (ret.originalId instanceof Types.ObjectId) ret.originalId = ret.originalId.toString();
    if (ret.mobileId instanceof Types.ObjectId) ret.mobileId = ret.mobileId.toString();
    if (ret.thumbId instanceof Types.ObjectId) ret.thumbId = ret.thumbId.toString();
    if (ret.ownerUserId instanceof Types.ObjectId) ret.ownerUserId = ret.ownerUserId.toString();
  },
});

const MediaModel: Model<MediaSchema> = models.Media || model<MediaSchema>('Media', mediaSchema);

export default MediaModel;
