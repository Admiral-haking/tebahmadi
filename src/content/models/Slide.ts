import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const COLLECTION = 'slides';

const slideSchema = new Schema(
  {
    // Legacy field kept for backward compatibility with old documents.
    mediaId: { type: Schema.Types.ObjectId, required: false },
    mediaDesktopId: { type: Schema.Types.ObjectId, required: false },
    mediaMobileId: { type: Schema.Types.ObjectId, required: false },
    href: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

slideSchema.index({ createdAt: -1 });

slideSchema.set('toJSON', {
  versionKey: false,
  transform: (_doc, ret: any) => {
    if (ret._id instanceof mongoose.Types.ObjectId) {
      ret.id = ret._id.toString();
      ret._id = ret.id;
    }
    if (ret.mediaId instanceof mongoose.Types.ObjectId) {
      ret.mediaId = ret.mediaId.toString();
    }
    if (ret.mediaDesktopId instanceof mongoose.Types.ObjectId) {
      ret.mediaDesktopId = ret.mediaDesktopId.toString();
    }
    if (ret.mediaMobileId instanceof mongoose.Types.ObjectId) {
      ret.mediaMobileId = ret.mediaMobileId.toString();
    }
  },
});

type SlideSchema = InferSchemaType<typeof slideSchema>;

export type SlideDocument = SlideSchema & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type SlideLean = Omit<SlideDocument, '_id' | 'mediaId' | 'mediaDesktopId' | 'mediaMobileId'> & {
  id: string;
  mediaId?: string;
  mediaDesktopId?: string;
  mediaMobileId?: string;
};

export const SlideModel =
  (mongoose.models.Slide as mongoose.Model<SlideDocument>) ||
  mongoose.model<SlideDocument>('Slide', slideSchema, COLLECTION);
