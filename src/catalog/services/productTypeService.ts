import { revalidatePath, revalidateTag, TAGS } from '@/lib/cache';
import { z } from 'zod';
import ProductTypeModel, {
  type ProductTypeDocument,
  type AttributeDef,
  type ColorValue,
} from '../models/ProductType';
import ProductModel from '../models/Product';
import { buildProductValidator, type ProductValidatorResult } from '../validation/productZod';
import { nonEmptyString } from '../validation/sharedSchemas';

const PRODUCT_TYPE_REVALIDATE_PATHS = ['/catalog/product-types'];

async function revalidateProductTypeCaches(id?: string): Promise<void> {
  await revalidateTag(TAGS.CATALOG);
  if (id) {
    await revalidateTag(TAGS.PRODUCT_TYPE(id));
  }
  for (const path of PRODUCT_TYPE_REVALIDATE_PATHS) {
    await revalidatePath(path);
  }
}

const HEX_COLOR_REGEX = /^#([A-F0-9]{3}|[A-F0-9]{6})$/i;

const colorValueInputSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Color key must be lowercase alphanumeric with dashes'),
  name: nonEmptyString.max(200),
  swatches: z
    .array(
      z
        .string()
        .trim()
        .regex(HEX_COLOR_REGEX, 'Swatch must be a hex color'),
    )
    .min(1)
    .max(6),
  family: z
    .enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'brown', 'black', 'white', 'grey', 'multi'])
    .optional(),
  rtlName: z.string().trim().max(200).optional(),
  aliases: z.array(z.string().trim().max(200)).optional(),
  active: z.boolean().optional(),
});

const colorValueSchema: z.ZodType<ColorValue> = colorValueInputSchema.transform((value) =>
  normalizeColorValue(value),
);

type ColorValueInput = z.infer<typeof colorValueInputSchema>;

const attributeDefSchema: z.ZodType<AttributeDef> = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_]+$/, 'Attribute key must be alphanumeric with optional underscore'),
    label: nonEmptyString.max(200),
    kind: z.enum(['text', 'number', 'boolean', 'enum', 'multi-enum', 'json', 'color']),
    required: z.boolean().optional(),
    variant: z.boolean().optional(),
    filterable: z.boolean().optional(),
    searchable: z.boolean().optional(),
    enumValues: z.array(nonEmptyString.max(200)).optional(),
    values: z.array(colorValueSchema).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    regex: z.string().optional(),
    unit: z.string().max(50).optional(),
  })
  .superRefine((attr, ctx) => {
    if ((attr.kind === 'enum' || attr.kind === 'multi-enum') && (!attr.enumValues || attr.enumValues.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'enumValues required for enum/multi-enum attributes',
        path: ['enumValues'],
      });
    }
    if (attr.min !== undefined && attr.max !== undefined && attr.min > attr.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'min cannot exceed max',
        path: ['min'],
      });
    }
    if (attr.kind === 'color') {
      if (!attr.values || attr.values.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'values required for color attributes',
          path: ['values'],
        });
        return;
      }
      const keys = new Set<string>();
      attr.values.forEach((value, index) => {
        const key = value.key.toLowerCase();
        if (keys.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate color key: ${value.key}`,
            path: ['values', index, 'key'],
          });
        }
        keys.add(key);
      });
    }
  });

const productTypeInputSchema = z.object({
  name: nonEmptyString.max(200),
  version: z.number().int().positive().optional(),
  attributes: z.array(attributeDefSchema).default([]),
});

function ensureUniqueAttributeKeys(attributes: AttributeDef[]): void {
  const keys = new Set<string>();
  attributes.forEach((attr) => {
    if (keys.has(attr.key)) {
      throw new Error(`Duplicate attribute key: ${attr.key}`);
    }
    keys.add(attr.key);
  });
}

function normalizeColorValue(input: ColorValue | ColorValueInput): ColorValue {
  const key = input.key.trim().toLowerCase();
  const swatches = input.swatches.map((swatch: string) => {
    const upper = swatch.trim().toUpperCase();
    if (/^#([A-F0-9]{3})$/.test(upper)) {
      const digits = upper.slice(1);
      const expanded = digits
        .split('')
        .map((char: string) => char.repeat(2))
        .join('');
      return `#${expanded}`;
    }
    if (HEX_COLOR_REGEX.test(upper)) {
      return `#${upper.slice(1)}`;
    }
    return upper;
  });

  const hasMultiple = swatches.length > 1;
  const family = input.family ?? (hasMultiple ? 'multi' : input.family); // TODO: infer family from swatch hue when not provided.

  return {
    key,
    name: input.name.trim(),
    swatches,
    family,
    rtlName: input.rtlName?.trim() || undefined,
    aliases: input.aliases
      ?.map((alias: string) => alias.trim())
      .filter((alias: string) => alias.length > 0) || undefined,
    active: input.active ?? true,
  };
}

function normalizeAttributes(attributes: AttributeDef[]): AttributeDef[] {
  return attributes.map((attr) => {
    if (attr.kind !== 'color' || !attr.values) {
      return attr;
    }
    const seen = new Set<string>();
    const values = attr.values.map((value) => {
      const normalized = normalizeColorValue(value);
      const key = normalized.key.toLowerCase();
      if (seen.has(key)) {
        throw new Error(`Duplicate color key detected: ${normalized.key}`);
      }
      seen.add(key);
      return normalized;
    });
    return {
      ...attr,
      enumValues: undefined,
      values,
    };
  });
}

export async function listProductTypes(): Promise<ProductTypeDocument[]> {
  return ProductTypeModel.find().sort({ createdAt: -1 }).exec();
}

export async function getProductType(id: string): Promise<ProductTypeDocument | null> {
  return ProductTypeModel.findById(id).exec();
}

export async function createProductType(payload: unknown): Promise<ProductTypeDocument> {
  const parsed = productTypeInputSchema.parse(payload);
  ensureUniqueAttributeKeys(parsed.attributes);
  const normalized = normalizeAttributes(parsed.attributes);
  const doc = await ProductTypeModel.create({ ...parsed, attributes: normalized });
  await revalidateProductTypeCaches(doc._id.toString());
  return doc;
}

export async function updateProductType(
  id: string,
  payload: unknown,
): Promise<ProductTypeDocument | null> {
  const parsed = productTypeInputSchema.partial().parse(payload);
  const update: Record<string, unknown> = { ...parsed };
  if (parsed.attributes) {
    ensureUniqueAttributeKeys(parsed.attributes);
    update.attributes = normalizeAttributes(parsed.attributes);
  }
  const doc = await ProductTypeModel.findByIdAndUpdate(id, update, { new: true, runValidators: true }).exec();
  if (doc) {
    await revalidateProductTypeCaches(doc._id.toString());
  }
  return doc;
}

export async function deleteProductType(id: string): Promise<boolean> {
  const products = await ProductModel.exists({ productTypeId: id });
  if (products) {
    return false;
  }
  const result = await ProductTypeModel.findByIdAndDelete(id).exec();
  if (result) {
    await revalidateProductTypeCaches(id);
  }
  return !!result;
}

export function buildValidator(productType: ProductTypeDocument): ProductValidatorResult {
  return buildProductValidator(productType);
}
