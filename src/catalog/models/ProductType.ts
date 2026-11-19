import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose';

export type AttributeKind = 'text' | 'number' | 'boolean' | 'enum' | 'multi-enum' | 'json' | 'color';

export type ColorFamily =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'brown'
  | 'black'
  | 'white'
  | 'grey'
  | 'multi';

export interface ColorValue {
  key: string;
  name: string;
  swatches: string[];
  family?: ColorFamily;
  rtlName?: string;
  aliases?: string[];
  active?: boolean;
}

export interface AttributeDef {
  key: string;
  label: string;
  kind: AttributeKind;
  required?: boolean;
  variant?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  enumValues?: string[];
  values?: ColorValue[];
  min?: number;
  max?: number;
  regex?: string;
  unit?: string;
}

export interface ProductTypeSchema {
  name: string;
  version: number;
  attributes: AttributeDef[];
  createdAt: Date;
  updatedAt: Date;
}

export type ProductTypeDocument = HydratedDocument<ProductTypeSchema>;

const colorValueSchema = new Schema<ColorValue>(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    swatches: {
      type: [String],
      required: true,
      validate: {
        validator: (value: string[]) => Array.isArray(value) && value.length > 0 && value.length <= 6,
        message: 'Color swatches must include between 1 and 6 values',
      },
    },
    family: {
      type: String,
      enum: ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'brown', 'black', 'white', 'grey', 'multi'],
      default: undefined,
    },
    rtlName: { type: String, trim: true, default: undefined },
    aliases: { type: [String], default: undefined },
    active: { type: Boolean, default: true },
  },
  { _id: false },
);

const attributeSchema = new Schema<AttributeDef>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    kind: {
      type: String,
      required: true,
      enum: ['text', 'number', 'boolean', 'enum', 'multi-enum', 'json', 'color'],
    },
    required: { type: Boolean, default: false },
    variant: { type: Boolean, default: false },
    filterable: { type: Boolean, default: false },
    searchable: { type: Boolean, default: false },
    enumValues: { type: [String], default: undefined },
    values: { type: [colorValueSchema], default: undefined },
    min: { type: Number },
    max: { type: Number },
    regex: { type: String },
    unit: { type: String },
  },
  { _id: false },
);

const productTypeSchema = new Schema<ProductTypeSchema>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    version: { type: Number, default: 1 },
    attributes: { type: [attributeSchema], default: [] },
  },
  { timestamps: true },
);

const ProductTypeModel: Model<ProductTypeSchema> =
  models.ProductType || model<ProductTypeSchema>('ProductType', productTypeSchema);

export default ProductTypeModel;
