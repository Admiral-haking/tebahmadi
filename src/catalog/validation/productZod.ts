import { z } from 'zod';
import type { AttributeDef, ProductTypeDocument } from '../models/ProductType';
import { objectIdString, nonEmptyString, slugSchema } from './sharedSchemas';

const UNIT_ENUM = ['unit', 'pair', 'kg', 'g', 'lb', 'oz', 'l', 'ml'] as const;

const HEX_REGEX = /^#([A-F0-9]{6})$/i;

const colorValueSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1, 'Color key is required')
      .max(100, 'Color key must be at most 100 characters')
      .regex(/^[a-z0-9-]+$/, 'Color key must be lowercase alphanumeric with dashes'),
    name: z.string().trim().min(1, 'Color name is required').max(200, 'Color name must be at most 200 characters'),
    swatches: z
      .array(
        z
          .string()
          .trim()
          .regex(/^#([A-F0-9]{3}|[A-F0-9]{6})$/i, 'Swatch must be a hex color'),
      )
      .min(1, 'At least one swatch is required')
      .max(6, 'Up to 6 swatches are supported'),
    family: z
      .enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'brown', 'black', 'white', 'grey', 'multi'])
      .optional(),
    rtlName: z.string().trim().max(200).optional(),
    aliases: z.array(z.string().trim().max(200)).optional(),
    active: z.boolean().optional(),
  })
  .transform((value) => ({
    ...value,
    swatches: value.swatches.map((swatch) => normalizeHex(swatch)),
  }));

function normalizeHex(input: string): string {
  const trimmed = input.trim().toUpperCase();
  if (/^#([A-F0-9]{3})$/i.test(trimmed)) {
    const [, digits] = trimmed.match(/^#([A-F0-9]{3})$/i) ?? [];
    if (digits) {
      const expanded = digits
        .split('')
        .map((char) => char.repeat(2))
        .join('');
      return `#${expanded.toUpperCase()}`;
    }
  }
  if (HEX_REGEX.test(trimmed)) {
    return `#${trimmed.slice(1).toUpperCase()}`;
  }
  return trimmed;
}

type ColorValueInput = z.infer<typeof colorValueSchema>;

function ensureWeightVariantAttribute(attributes: AttributeDef[]): AttributeDef[] {
  const weightIndex = attributes.findIndex((attr) => attr.key === 'weightGrams');
  if (weightIndex >= 0) {
    const existing = attributes[weightIndex];
    const normalized: AttributeDef = {
      ...existing,
      key: 'weightGrams',
      label: existing.label?.trim() || 'وزن (گرم)',
      kind: 'number',
      variant: true,
      required: true,
      unit: existing.unit ?? 'g',
      min: existing.min ?? 1,
    };
    const next = [...attributes];
    next[weightIndex] = normalized;
    return next;
  }

  return [
    ...attributes,
    {
      key: 'weightGrams',
      label: 'وزن (گرم)',
      kind: 'number',
      variant: true,
      required: true,
      filterable: false,
      searchable: false,
      unit: 'g',
      min: 1,
    },
  ];
}

function attributeValueSchema(def: AttributeDef): z.ZodTypeAny {
  switch (def.kind) {
    case 'text': {
      let schema = z.string();
      if (def.min !== undefined) schema = schema.min(def.min, `Minimum length ${def.min}`);
      if (def.max !== undefined) schema = schema.max(def.max, `Maximum length ${def.max}`);
      if (def.regex) {
        try {
          const regex = new RegExp(def.regex);
          schema = schema.regex(regex, 'Value does not match pattern');
        } catch {
          // ignore invalid regex at runtime; schema fallback without regex
        }
      }
      return schema;
    }
    case 'number': {
      let schema = z.number();
      if (def.min !== undefined) schema = schema.min(def.min);
      if (def.max !== undefined) schema = schema.max(def.max);
      return schema;
    }
    case 'boolean':
      return z.boolean();
    case 'enum':
      return z.enum((def.enumValues ?? []) as [string, ...string[]]);
    case 'multi-enum': {
      const values = (def.enumValues ?? []) as [string, ...string[]];
      return z
        .array(z.enum(values))
        .min(def.required ? 1 : 0)
        .superRefine((arr, ctx) => {
          const seen = new Set(arr);
          if (seen.size !== arr.length) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate values not allowed' });
          }
        });
    }
    case 'json':
      return z.unknown();
    case 'color': {
      const colorValues = def.values ?? [];
      if (colorValues.length === 0) {
        throw new Error(`Attribute ${def.key} has no color values defined`);
      }

      const allowedKeys = new Set(colorValues.map((value) => value.key));
      return z.union([
        z
          .string()
          .trim()
          .refine((value) => allowedKeys.has(value), 'Invalid color key'),
        colorValueSchema.refine((value) => allowedKeys.has(value.key), 'Invalid color key'),
      ]);
    }
    default:
      return z.unknown();
  }
}

function buildAttributeArraySchema(defs: AttributeDef[]): z.ZodTypeAny {
  const schemaMap = new Map<string, z.ZodTypeAny>();
  defs.forEach((def) => {
    if (def.enumValues && def.enumValues.length === 0 && (def.kind === 'enum' || def.kind === 'multi-enum')) {
      throw new Error(`Attribute ${def.key} has no enumValues defined`);
    }
    if (def.kind === 'color') {
      const values = def.values ?? [];
      if (values.length === 0) {
        throw new Error(`Attribute ${def.key} has no color values defined`);
      }
      const seenKeys = new Set<string>();
      values.forEach((value) => {
        if (seenKeys.has(value.key.toLowerCase())) {
          throw new Error(`Duplicate color key detected for attribute ${def.key}: ${value.key}`);
        }
        seenKeys.add(value.key.toLowerCase());
        if (!value.swatches || value.swatches.length === 0 || value.swatches.length > 6) {
          throw new Error(`Color ${value.key} must include between 1 and 6 swatches`);
        }
        value.swatches.forEach((swatch) => {
          if (!/^#([A-F0-9]{3}|[A-F0-9]{6})$/i.test(swatch)) {
            throw new Error(`Invalid color swatch ${swatch} for ${value.key}`);
          }
        });
      });
    }
    schemaMap.set(def.key, attributeValueSchema(def));
  });
  const requiredKeys = new Set(defs.filter((d) => d.required).map((d) => d.key));

  return z
    .array(
      z.object({
        key: z.string(),
        value: z.unknown(),
      }),
    )
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const def = schemaMap.get(item.key);
        if (!def) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown attribute key: ${item.key}`,
            path: [i, 'key'],
          });
          continue;
        }
        if (seen.has(item.key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate attribute key: ${item.key}`,
            path: [i, 'key'],
          });
          continue;
        }
        seen.add(item.key);
        const parsed = def.safeParse(item.value);
        if (!parsed.success) {
          parsed.error.issues.forEach((issue) => {
            ctx.addIssue({ ...issue, path: [i, 'value', ...(issue.path ?? [])] });
          });
        }
      }

      requiredKeys.forEach((key) => {
        if (!seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Missing required attribute: ${key}`,
          });
        }
      });
    });
}

const priceSchema = z.object({
  model: z.enum(['fixed', 'per_unit']),
  amount: z.number().int().nonnegative(),
  unitOfMeasure: z.enum(UNIT_ENUM).optional(),
});

const offerSchema = z
  .object({
    amount: z.number().int().nonnegative(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    label: z.string().min(1).max(120).optional(),
  })
  .superRefine((offer, ctx) => {
    if (offer.startsAt && offer.endsAt && offer.startsAt > offer.endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Offer startsAt must be before endsAt',
        path: ['startsAt'],
      });
    }
  });

const inventorySchema = z.object({
  trackingUnit: z.enum(UNIT_ENUM),
  quantity: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
});

export interface ProductValidatorResult {
  productSchema: z.ZodTypeAny;
  variantSchema: z.ZodTypeAny;
}

export function buildProductValidator(productType: ProductTypeDocument): ProductValidatorResult {
  const attributes = productType.attributes ?? [];
  const globalAttributes = attributes.filter((attr) => !attr.variant);
  const variantAttributes = ensureWeightVariantAttribute(attributes.filter((attr) => attr.variant));

  const globalAttributeSchema = buildAttributeArraySchema(globalAttributes).default([]);
  const variantAttributeSchema = buildAttributeArraySchema(variantAttributes).default([]);

  const variantSchema = z
    .object({
      sku: nonEmptyString.max(120),
      attributeValues: variantAttributeSchema,
      price: priceSchema,
      offer: offerSchema.optional(),
      inventory: inventorySchema,
      minimumOrderQuantity: z.number().positive('Minimum order quantity must be greater than zero').optional(),
      maximumOrderQuantity: z.number().positive('Maximum order quantity must be greater than zero').optional(),
      mediaIds: z.array(objectIdString).optional(),
      barcode: z.string().min(1).max(120).optional(),
      active: z.boolean().optional().default(true),
    })
    .superRefine((variant, ctx) => {
      const offer = variant.offer;
      if (offer && offer.amount > variant.price.amount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Offer amount cannot exceed base price',
          path: ['offer', 'amount'],
        });
      }
      if (
        variant.minimumOrderQuantity !== undefined &&
        variant.maximumOrderQuantity !== undefined &&
        variant.minimumOrderQuantity > variant.maximumOrderQuantity
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Minimum order quantity cannot exceed maximum order quantity',
          path: ['minimumOrderQuantity'],
        });
      }
    });

  const productSchema = z.object({
    productTypeId: objectIdString,
    title: nonEmptyString.max(200),
    slug: slugSchema,
    description: z.string().max(10_000).optional(),
    brand: z.string().max(200).optional(),
    seoTitle: z.string().max(200).optional(),
    seoDescription: z.string().max(500).optional(),
    attributeValues: globalAttributeSchema,
    variants: z.array(variantSchema).min(1, 'At least one variant is required'),
    categories: z.array(objectIdString).optional().default([]),
    searchableText: z.string().optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
    showInCart: z.boolean().optional().default(false),
  });

  return { productSchema, variantSchema };
}
