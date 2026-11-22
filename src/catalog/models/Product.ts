import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
  Types,
} from 'mongoose';
import type { ColorFamily } from './ProductType';

export type ProductStatus = 'draft' | 'active' | 'archived';

export interface AttributeValue {
  key: string;
  value: unknown;
}

export interface PriceModel {
  model: 'fixed' | 'per_unit';
  amount: number;
  unitOfMeasure?: 'unit' | 'pair' | 'kg' | 'g' | 'lb' | 'oz' | 'l' | 'ml';
}

export interface OfferModel {
  amount: number;
  startsAt?: Date;
  endsAt?: Date;
  label?: string;
}

export interface InventoryModel {
  trackingUnit: 'unit' | 'pair' | 'kg' | 'g' | 'lb' | 'oz' | 'l' | 'ml';
  quantity: number;
  lowStockThreshold?: number;
  /** Prevents automatic marketplace pushes while an inventory discrepancy is investigated. */
  frozen?: boolean;
}

export interface VariantSchema {
  _id: Types.ObjectId
  sku: string;
  attributeValues: AttributeValue[];
  price: PriceModel;
  offer?: OfferModel;
  inventory: InventoryModel;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
  mediaIds?: Types.ObjectId[];
  barcode?: string;
  active: boolean;
  colorKey?: string;
  colorName?: string;
  colorSwatches?: string[];
  colorFamily?: ColorFamily;
  tapinProductId?: number;
  tapinCategoryId?: string;
  tapinSyncedAt?: Date;
  tapinMappings?: Array<{
    shopId: string;
    productId: number;
    categoryId: string;
    syncedAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductSchema {
  productTypeId: Types.ObjectId
  typeVersion: number;
  title: string;
  slug: string;
  description?: string;
  brand?: string;
  attributeValues: AttributeValue[];
  attrs: Map<string, unknown>;
  variants: VariantSchema[];
  categories: Types.ObjectId[];
  searchableText?: string;
  status: ProductStatus;
  showInCart: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductDocument = HydratedDocument<ProductSchema>;

const attributeValueSchema = new Schema<AttributeValue>(
  {
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const priceSchema = new Schema<PriceModel>(
  {
    model: { type: String, required: true, enum: ['fixed', 'per_unit'] },
    amount: { type: Number, required: true, min: 0 },
    unitOfMeasure: {
      type: String,
      enum: ['unit', 'pair', 'kg', 'g', 'lb', 'oz', 'l', 'ml'],
      default: undefined,
    },
  },
  { _id: false },
);

const offerSchema = new Schema<OfferModel>(
  {
    amount: { type: Number, required: true, min: 0 },
    startsAt: { type: Date },
    endsAt: { type: Date },
    label: { type: String },
  },
  { _id: false },
);

const inventorySchema = new Schema<InventoryModel>(
  {
    trackingUnit: {
      type: String,
      required: true,
      enum: ['unit', 'pair', 'kg', 'g', 'lb', 'oz', 'l', 'ml'],
    },
    quantity: { type: Number, required: true, min: 0 },
    lowStockThreshold: { type: Number, min: 0 },
    frozen: { type: Boolean, default: false },
  },
  { _id: false },
);

const variantSchema = new Schema<VariantSchema>(
  {
    sku: { type: String, required: true, trim: true },
    attributeValues: { type: [attributeValueSchema], default: [] },
    price: { type: priceSchema, required: true },
    offer: { type: offerSchema },
    inventory: { type: inventorySchema, required: true },
    minimumOrderQuantity: { type: Number, min: 0 },
    maximumOrderQuantity: { type: Number, min: 0 },
    mediaIds: { type: [Schema.Types.ObjectId], default: undefined },
    barcode: { type: String },
    active: { type: Boolean, default: true },
    colorKey: { type: String },
    colorName: { type: String },
    colorSwatches: { type: [String], default: undefined },
    colorFamily: {
      type: String,
      enum: ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'brown', 'black', 'white', 'grey', 'multi'],
      default: undefined,
    },
    tapinProductId: { type: Number, min: 1 },
    tapinCategoryId: { type: String, trim: true },
    tapinSyncedAt: { type: Date },
    tapinMappings: {
      type: [
        new Schema(
          {
            shopId: { type: String, required: true, trim: true },
            productId: { type: Number, required: true, min: 1 },
            categoryId: { type: String, required: true, trim: true },
            syncedAt: { type: Date },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
  },
  { timestamps: true },
);

const productSchema = new Schema<ProductSchema>(
  {
    productTypeId: { type: Schema.Types.ObjectId, ref: 'ProductType', required: true },
    typeVersion: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    brand: { type: String },
    attributeValues: { type: [attributeValueSchema], default: [] },
    attrs: { type: Map, of: Schema.Types.Mixed, default: () => new Map() },
    variants: { type: [variantSchema], default: [] },
    categories: { type: [Schema.Types.ObjectId], ref: 'Category', default: [] },
    searchableText: { type: String },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
    },
    seoTitle: { type: String },
    seoDescription: { type: String },
    showInCart: { type: Boolean, default: false },
  },
  { timestamps: true },
);

productSchema.index({ categories: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ searchableText: 'text' });
productSchema.index({ 'attrs.size': 1 });
productSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });
productSchema.index({ 'variants.barcode': 1 }, { unique: true, sparse: true });
productSchema.index({ 'variants.offer.startsAt': 1 });
productSchema.index({ 'variants.offer.endsAt': 1 });
productSchema.index({ 'variants.colorKey': 1 });
productSchema.index({ 'variants.colorFamily': 1 });
productSchema.index({ 'attrs.color': 1 });
productSchema.index({ 'attrs.colorFamily': 1 });


const ProductModel: Model<ProductSchema> =
  models.Product || model<ProductSchema>('Product', productSchema);

export default ProductModel;
