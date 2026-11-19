import { Schema, model, models, type HydratedDocument, type Model, Types } from 'mongoose';

export interface CategorySchema {
  name: string;
  slug: string;
  parentId?: Types.ObjectId | null;
  path: string;
  ancestors: Types.ObjectId[];
  depth: number;
  position: number;
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
  imageId?: Types.ObjectId;
  mediaId?: Types.ObjectId;
  productTypeId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CategoryDocument = HydratedDocument<CategorySchema>;

const categorySchema = new Schema<CategorySchema>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    path: { type: String, required: true, unique: true },
    ancestors: { type: [Schema.Types.ObjectId], default: [] },
    depth: { type: Number, required: true },
    position: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    seoTitle: { type: String },
    seoDescription: { type: String },
    imageId: { type: Schema.Types.ObjectId },
    mediaId: { type: Schema.Types.ObjectId, ref: 'Media', default: undefined },
    productTypeId: { type: Schema.Types.ObjectId, ref: 'ProductType', default: undefined },
  },
  { timestamps: true },
);

categorySchema.index({ parentId: 1, slug: 1 }, { unique: true });
categorySchema.index({ ancestors: 1 });
categorySchema.index({ parentId: 1, position: 1 });

const CategoryModel: Model<CategorySchema> =
  models.Category || model<CategorySchema>('Category', categorySchema);

export default CategoryModel;
