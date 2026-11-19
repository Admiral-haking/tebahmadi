'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Icon,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useFieldArray, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';

import type { AttributeDef, AttributeKind, ColorFamily, ColorValue } from '@/catalog/models/ProductType';
import type { ProductStatus } from '@/catalog/models/Product';
import OfferBulkDialog from '@/components/admin/products/OfferBulkDialog';
import { Form, Field } from '@/components/hook-form';

import AttributeFields from './components/attribute-fields';
import AIProductChatDialog from './components/llm-text';
import Splash from '@/components/splash';
import Orderly from '@/components/orderly';
import VariantFull from './components/variant-full';
import VariantWizard from './components/wizard';

const PRICE_MODEL_OPTIONS = [
  { value: 'fixed', label: 'قیمت ثابت' },
  { value: 'per_unit', label: 'بر اساس واحد' },
] as const;

const UNIT_OPTIONS = [
  { value: 'unit', label: 'عدد' },
  { value: 'pair', label: 'جفت' },
  { value: 'kg', label: 'کیلوگرم' },
  { value: 'g', label: 'گرم' },
  { value: 'lb', label: 'پوند' },
  { value: 'oz', label: 'اونس' },
  { value: 'l', label: 'لیتر' },
  { value: 'ml', label: 'میلی‌لیتر' },
] as const;

const STATUS_OPTIONS: Array<{ value: ProductStatus; label: string }> = [
  { value: 'draft', label: 'پیش‌نویس' },
  { value: 'active', label: 'فعال' },
  { value: 'archived', label: 'آرشیو' },
];

type AttributeRecord = Record<string, unknown>;

type VariantDTO = {
  _id?: string;
  sku?: string;
  attributeValues?: Array<{ key: string; value: unknown }>;
  price?: { model?: 'fixed' | 'per_unit'; amount?: number; unitOfMeasure?: string };
  offer?: { amount?: number; startsAt?: string; endsAt?: string; label?: string } | null;
  inventory?: { trackingUnit?: string; quantity?: number; lowStockThreshold?: number };
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
  mediaIds?: string[] | null;
  barcode?: string | null;
  active?: boolean;
};

type ProductDTO = {
  id?: string;
  _id?: string;
  productTypeId?: string;
  title?: string;
  slug?: string;
  description?: string | null;
  brand?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  status?: ProductStatus;
  showInCart?: boolean;
  attributeValues?: Array<{ key: string; value: unknown }>;
  variants?: VariantDTO[];
  categories?: string[];
};

type ProductTypeOption = {
  id: string;
  name: string;
  version?: number;
  attributes: AttributeDef[];
};

type CategoryOption = {
  id: string;
  name: string;
  path: string;
};

type ProductApiResponse = {
  product?: Record<string, unknown> | null;
};

type ProductTypesApiResponse = {
  productTypes?: Array<Record<string, unknown>>;
};

type CategoriesApiResponse = {
  categories?: Array<Record<string, unknown>>;
};

const ATTRIBUTE_KIND_VALUES: AttributeKind[] = ['text', 'number', 'boolean', 'enum', 'multi-enum', 'json', 'color'];
const ATTRIBUTE_KIND_SET = new Set<AttributeKind>(ATTRIBUTE_KIND_VALUES);
const COLOR_FAMILY_VALUES: ColorFamily[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'brown',
  'black',
  'white',
  'grey',
  'multi',
];
const COLOR_FAMILY_SET = new Set<ColorFamily>(COLOR_FAMILY_VALUES);

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

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const message = (await response.text().catch(() => '')) || response.statusText;
    throw new Error(message || 'Failed to load data');
  }
  return (await response.json()) as T;
}

function normalizeColorValueResponse(input: unknown): ColorValue | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const value = input as Record<string, unknown>;

  const key = typeof value.key === 'string' ? value.key : '';
  const name = typeof value.name === 'string' ? value.name : '';
  const swatches = Array.isArray(value.swatches)
    ? (value.swatches as unknown[])
      .map((swatch) => String(swatch))
      .map((swatch) => swatch.trim())
      .filter((swatch) => swatch.length > 0)
    : [];

  if (!key || !name || swatches.length === 0) {
    return null;
  }

  const familyValue = typeof value.family === 'string' ? (value.family as ColorFamily) : undefined;
  const family = familyValue && COLOR_FAMILY_SET.has(familyValue) ? familyValue : undefined;

  const aliases = Array.isArray(value.aliases)
    ? (value.aliases as unknown[])
      .map((alias) => String(alias).trim())
      .filter((alias) => alias.length > 0)
    : undefined;

  const colorValue = {
    key,
    name,
    swatches,
    family,
    rtlName: typeof value.rtlName === 'string' && value.rtlName.trim().length > 0 ? value.rtlName.trim() : undefined,
    aliases,
    active: value.active === undefined ? true : Boolean(value.active),
  } satisfies ColorValue;

  return colorValue;
}

function normalizeAttributeResponse(input: unknown): AttributeDef | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const attribute = input as Record<string, unknown>;

  const key = typeof attribute.key === 'string' ? attribute.key : '';
  const label = typeof attribute.label === 'string' ? attribute.label : '';
  const rawKind = typeof attribute.kind === 'string' ? (attribute.kind as AttributeKind) : 'text';
  const kind = ATTRIBUTE_KIND_SET.has(rawKind) ? rawKind : 'text';

  if (!key || !label) {
    return null;
  }

  const enumValues = Array.isArray(attribute.enumValues)
    ? (attribute.enumValues as unknown[])
      .map((value) => String(value).trim())
      .filter((value) => value.length > 0)
    : [];

  const colorValues = Array.isArray(attribute.values)
    ? (attribute.values as unknown[])
      .map(normalizeColorValueResponse)
      .filter((value): value is ColorValue => value !== null)
    : [];

  const normalized = {
    key,
    label,
    kind,
    required: attribute.required === undefined ? undefined : Boolean(attribute.required),
    variant: attribute.variant === undefined ? undefined : Boolean(attribute.variant),
    filterable: attribute.filterable === undefined ? undefined : Boolean(attribute.filterable),
    searchable: attribute.searchable === undefined ? undefined : Boolean(attribute.searchable),
    enumValues: enumValues.length > 0 ? enumValues : undefined,
    values: colorValues.length > 0 ? colorValues : undefined,
    min: typeof attribute.min === 'number' ? attribute.min : undefined,
    max: typeof attribute.max === 'number' ? attribute.max : undefined,
    regex: typeof attribute.regex === 'string' ? attribute.regex : undefined,
    unit: typeof attribute.unit === 'string' ? attribute.unit : undefined,
  } satisfies AttributeDef;

  return normalized;
}

function normalizeProductTypeResponse(input: Record<string, unknown>): ProductTypeOption {
  const attributes = Array.isArray(input.attributes)
    ? (input.attributes as unknown[])
      .map(normalizeAttributeResponse)
      .filter((attr): attr is AttributeDef => attr !== null)
    : [];

  return {
    id:
      typeof input.id === 'string'
        ? input.id
        : typeof input._id === 'string'
          ? input._id
          : '',
    name: typeof input.name === 'string' ? input.name : '',
    version: typeof input.version === 'number' ? input.version : undefined,
    attributes,
  } satisfies ProductTypeOption;
}

function normalizeAttributeValueArray(input: unknown): Array<{ key: string; value: unknown }> {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => {
      if (typeof item !== 'object' || item === null) return null;
      const record = item as Record<string, unknown>;
      const key = typeof record.key === 'string' ? record.key : '';
      if (!key) return null;
      return { key, value: record.value };
    })
    .filter((value): value is { key: string; value: unknown } => value !== null);
}

function normalizeVariantResponse(input: unknown): VariantDTO | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const variant = input as Record<string, unknown>;

  const price = typeof variant.price === 'object' && variant.price !== null
    ? ((): VariantDTO['price'] => {
      const priceRecord = variant.price as Record<string, unknown>;
      const model = priceRecord.model === 'per_unit' ? 'per_unit' : 'fixed';
      const amount = typeof priceRecord.amount === 'number' ? priceRecord.amount : undefined;
      const unit = typeof priceRecord.unitOfMeasure === 'string' ? priceRecord.unitOfMeasure : undefined;
      return { model, amount, unitOfMeasure: unit };
    })()
    : undefined;

  const inventory = typeof variant.inventory === 'object' && variant.inventory !== null
    ? ((): VariantDTO['inventory'] => {
      const inventoryRecord = variant.inventory as Record<string, unknown>;
      const trackingUnit = typeof inventoryRecord.trackingUnit === 'string' ? inventoryRecord.trackingUnit : undefined;
      const quantity = typeof inventoryRecord.quantity === 'number' ? inventoryRecord.quantity : undefined;
      const lowStockThreshold = typeof inventoryRecord.lowStockThreshold === 'number'
        ? inventoryRecord.lowStockThreshold
        : undefined;
      return { trackingUnit, quantity, lowStockThreshold };
    })()
    : undefined;

  const offer = typeof variant.offer === 'object' && variant.offer !== null
    ? ((): VariantDTO['offer'] => {
      const offerRecord = variant.offer as Record<string, unknown>;
      const amount = typeof offerRecord.amount === 'number' ? offerRecord.amount : undefined;
      const startsAt = typeof offerRecord.startsAt === 'string' ? offerRecord.startsAt : undefined;
      const endsAt = typeof offerRecord.endsAt === 'string' ? offerRecord.endsAt : undefined;
      const label = typeof offerRecord.label === 'string' ? offerRecord.label : undefined;
      return { amount, startsAt, endsAt, label };
    })()
    : undefined;

  const minimumOrderQuantityValue = (variant as Record<string, unknown>).minimumOrderQuantity;
  const maximumOrderQuantityValue = (variant as Record<string, unknown>).maximumOrderQuantity;
  const minimumOrderQuantity =
    typeof minimumOrderQuantityValue === 'number' ? minimumOrderQuantityValue : undefined;
  const maximumOrderQuantity =
    typeof maximumOrderQuantityValue === 'number' ? maximumOrderQuantityValue : undefined;

  const sku = typeof variant.sku === 'string' ? variant.sku : undefined;

  if (!sku) {
    return null;
  }

  return {
    _id: typeof variant._id === 'string' ? variant._id : undefined,
    sku,
    attributeValues: normalizeAttributeValueArray(variant.attributeValues),
    price,
    offer,
    inventory,
    minimumOrderQuantity,
    maximumOrderQuantity,
    mediaIds: Array.isArray(variant.mediaIds)
      ? (variant.mediaIds as unknown[]).map((id) => String(id))
      : undefined,
    barcode: typeof variant.barcode === 'string' ? variant.barcode : undefined,
    active: variant.active === undefined ? undefined : Boolean(variant.active),
  } satisfies VariantDTO;
}

function normalizeProductResponse(product: Record<string, unknown> | null | undefined): ProductDTO | null {
  if (!product) {
    return null;
  }

  const statusValue = typeof product.status === 'string' ? (product.status as ProductStatus) : undefined;
  const status: ProductStatus | undefined = statusValue && ['draft', 'active', 'archived'].includes(statusValue)
    ? statusValue
    : undefined;

  const variants = Array.isArray(product.variants)
    ? (product.variants as unknown[])
      .map(normalizeVariantResponse)
      .filter((variant): variant is VariantDTO => variant !== null)
    : [];

  const categories = Array.isArray(product.categories)
    ? (product.categories as unknown[]).map((value) => String(value))
    : [];

  return {
    id:
      typeof product.id === 'string'
        ? product.id
        : typeof product._id === 'string'
          ? product._id
          : undefined,
    _id: typeof product._id === 'string' ? product._id : undefined,
    productTypeId: typeof product.productTypeId === 'string' ? product.productTypeId : undefined,
    title: typeof product.title === 'string' ? product.title : undefined,
    slug: typeof product.slug === 'string' ? product.slug : undefined,
    description: typeof product.description === 'string' ? product.description : undefined,
    brand: typeof product.brand === 'string' ? product.brand : undefined,
    seoTitle: typeof product.seoTitle === 'string' ? product.seoTitle : undefined,
    seoDescription: typeof product.seoDescription === 'string' ? product.seoDescription : undefined,
    status,
    showInCart: typeof product.showInCart === 'boolean' ? product.showInCart : undefined,
    attributeValues: normalizeAttributeValueArray(product.attributeValues),
    variants,
    categories,
  } satisfies ProductDTO;
}

type VariantFormValue = {
  sku: string;
  active: boolean;
  priceModel: 'fixed' | 'per_unit';
  priceAmount?: number;
  priceUnit?: string;
  inventoryTracking: string;
  inventoryQuantity?: number;
  inventoryLowStock?: number;
  minimumOrderQuantity?: number;
  maximumOrderQuantity?: number;
  barcode?: string;
  offerEnabled: boolean;
  offerAmount?: number;
  offerStartsAt?: string;
  offerEndsAt?: string;
  offerLabel?: string;
  mediaIds: string[];
  attributeValues: AttributeRecord;
};

type ProductFormValues = {
  productTypeId: string;
  title: string;
  slug: string;
  description: string;
  brand: string;
  seoTitle: string;
  seoDescription: string;
  status: ProductStatus;
  showInCart: boolean;
  attributeValues: AttributeRecord;
  categories: string[];
  variants: VariantFormValue[];
};

type BulkPrice = { model: 'fixed' | 'per_unit'; amount: number; unitOfMeasure?: string };
type BulkOffer = { amount: number; startsAt?: Date; endsAt?: Date; label?: string };
type BulkVariant = { sku: string; price: BulkPrice; offer?: BulkOffer; active: boolean };

interface ProductSaveFormProps {
  defaultValues?: ProductDTO | null;
  productTypes: ProductTypeOption[];
  categories: CategoryOption[];
  obj?: any
}

const productSchema = z.object({
  productTypeId: z.string().min(1, 'نوع محصول را انتخاب کنید'),
  title: z.string().trim().min(1, 'عنوان محصول الزامی است'),
  slug: z.string().trim().min(1, 'شناسه محصول الزامی است'),
  description: z.string().optional().default(''),
  brand: z.string().optional().default(''),
  seoTitle: z.string().optional().default(''),
  seoDescription: z.string().optional().default(''),
  status: z.enum(['draft', 'active', 'archived']),
  showInCart: z.boolean().optional().default(false),
  categories: z.array(z.string()).optional().default([]),
  attributeValues: z.record(z.any(), z.any()).optional().default({}),
  variants: z
    .array(
      z
        .object({
          sku: z.string().trim().min(1, 'شناسه واریانت الزامی است'),
          active: z.boolean().optional(),
          priceModel: z.enum(['fixed', 'per_unit']),
          priceAmount: z.number({ error: 'قیمت پایه واریانت را وارد کنید' }).nonnegative('قیمت نباید منفی باشد'),
          priceUnit: z.string().optional(),
          inventoryTracking: z.string().min(1, 'واحد موجودی را انتخاب کنید'),
          inventoryQuantity: z
            .number({ error: 'تعداد موجودی الزامی است' })
            .nonnegative('موجودی نباید منفی باشد'),
          inventoryLowStock: z.number().nonnegative('حد آستانه نمی‌تواند منفی باشد').optional(),
          minimumOrderQuantity: z.number().positive('حداقل مقدار سفارش باید بیشتر از صفر باشد').optional(),
          maximumOrderQuantity: z.number().positive('حداکثر مقدار سفارش باید بیشتر از صفر باشد').optional(),
          barcode: z.string().max(120, 'حداکثر ۱۲۰ کاراکتر').optional(),
          offerEnabled: z.boolean().optional(),
          offerAmount: z.number().nonnegative('مقدار تخفیف نباید منفی باشد').optional(),
          offerStartsAt: z.string().optional(),
          offerEndsAt: z.string().optional(),
          offerLabel: z.string().max(120, 'حداکثر ۱۲۰ کاراکتر').optional(),
          mediaIds: z.array(z.string().trim().min(1)).optional().default([]),
          attributeValues: z.record(z.any(), z.any()).optional().default({}),
        })
        .superRefine((variant, ctx) => {
          if (variant.offerEnabled && (variant.offerAmount === undefined || Number.isNaN(variant.offerAmount))) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'مقدار تخفیف الزامی است',
              path: ['offerAmount'],
            });
          }
          if (variant.offerEnabled && variant.offerStartsAt && variant.offerEndsAt) {
            const start = new Date(variant.offerStartsAt);
            const end = new Date(variant.offerEndsAt);
            if (!Number.isNaN(start.valueOf()) && !Number.isNaN(end.valueOf()) && start > end) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'تاریخ پایان باید بعد از تاریخ شروع باشد',
                path: ['offerEndsAt'],
              });
            }
          }
          if (
            variant.minimumOrderQuantity !== undefined &&
            variant.maximumOrderQuantity !== undefined &&
            variant.minimumOrderQuantity > variant.maximumOrderQuantity
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'حداقل مقدار سفارش نمی‌تواند بیشتر از حداکثر باشد',
              path: ['minimumOrderQuantity'],
            });
          }
        }),
    )
    .min(1, 'حداقل یک واریانت لازم است'),
});

function attributeDefaultValue(def: AttributeDef): string | number | boolean | string[] | undefined {
  switch (def.kind) {
    case 'text':
      return '';
    case 'number':
      return undefined;
    case 'boolean':
      return false;
    case 'enum':
      return '';
    case 'multi-enum':
      return [];
    case 'json':
      return '';
    case 'color':
      return '';
    default:
      return undefined;
  }
}

function adaptAttributeValue(def: AttributeDef, value: unknown): unknown {
  if (value === undefined || value === null) {
    return attributeDefaultValue(def);
  }

  switch (def.kind) {
    case 'text':
      return String(value ?? '');
    case 'number':
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim().length === 0) return undefined;
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'enum':
      return String(value);
    case 'multi-enum':
      if (Array.isArray(value)) {
        return value.map((item) => String(item));
      }
      return value != null ? [String(value)] : [];
    case 'json':
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return typeof value === 'string' ? value : JSON.stringify(value);
      }
    case 'color':
      if (typeof value === 'string') {
        return value;
      }
      if (typeof value === 'object' && value !== null && 'key' in (value as Record<string, unknown>)) {
        const key = (value as { key?: string }).key;
        return key ?? '';
      }
      return '';
    default:
      return value;
  }
}

function attributesArrayToRecord(
  attributes: Array<{ key: string; value: unknown }> | undefined,
  defs: AttributeDef[],
): AttributeRecord {
  const map = new Map<string, unknown>();
  (attributes ?? []).forEach((item) => {
    map.set(item.key, item.value);
  });

  const record: AttributeRecord = {};
  defs.forEach((def) => {
    record[def.key] = adaptAttributeValue(def, map.get(def.key));
  });
  return record;
}

function formatDateTimeInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  const tzOffset = date.getTimezoneOffset() * 60000;
  const localISO = new Date(date.valueOf() - tzOffset).toISOString();
  return localISO.slice(0, 16);
}

function formatDateObjectToInput(date?: Date | null): string {
  if (!date) return '';
  return formatDateTimeInput(date.toISOString());
}

function parseDateInput(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return undefined;
  return parsed;
}

function createEmptyVariant(attributes: AttributeDef[]): VariantFormValue {
  const attributeValues: AttributeRecord = {};
  attributes.forEach((attr) => {
    attributeValues[attr.key] = attributeDefaultValue(attr);
  });

  return {
    sku: '',
    active: true,
    priceModel: 'fixed',
    priceAmount: undefined,
    priceUnit: 'unit',
    inventoryTracking: 'unit',
    inventoryQuantity: undefined,
    inventoryLowStock: undefined,
    minimumOrderQuantity: undefined,
    maximumOrderQuantity: undefined,
    barcode: '',
    offerEnabled: false,
    offerAmount: undefined,
    offerStartsAt: '',
    offerEndsAt: '',
    offerLabel: '',
    mediaIds: [],
    attributeValues,
  };
}

function trimmedOrUndefined(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildDefaultValues(
  product: ProductDTO | null | undefined,
  productTypes: ProductTypeOption[],
): ProductFormValues {
  const initialTypeId = product?.productTypeId ?? product?.['productTypeId'] ?? '';
  const resolvedTypeId = initialTypeId || productTypes[0]?.id || '';
  const productType = productTypes.find((item) => item.id === resolvedTypeId);
  const globalAttributes = productType?.attributes.filter((attr) => !attr.variant) ?? [];
  const variantAttributes = ensureWeightVariantAttribute(
    productType?.attributes.filter((attr) => attr.variant) ?? [],
  );

  const attributeValues = attributesArrayToRecord(product?.attributeValues, globalAttributes);

  const variants: VariantFormValue[] = (product?.variants ?? []).map((variant) => {
    const attributeValuesRecord = attributesArrayToRecord(variant.attributeValues, variantAttributes);
    return {
      sku: variant.sku ?? '',
      active: variant.active ?? true,
      priceModel: variant.price?.model ?? 'fixed',
      priceAmount: variant.price?.amount,
      priceUnit: variant.price?.unitOfMeasure,
      inventoryTracking: variant.inventory?.trackingUnit ?? 'unit',
      inventoryQuantity: variant.inventory?.quantity,
      inventoryLowStock: variant.inventory?.lowStockThreshold ?? undefined,
      minimumOrderQuantity: variant.minimumOrderQuantity,
      maximumOrderQuantity: variant.maximumOrderQuantity,
      barcode: variant.barcode ?? '',
      offerEnabled: Boolean(variant.offer),
      offerAmount: variant.offer?.amount ?? undefined,
      offerStartsAt: formatDateTimeInput(variant.offer?.startsAt ?? undefined),
      offerEndsAt: formatDateTimeInput(variant.offer?.endsAt ?? undefined),
      offerLabel: variant.offer?.label ?? '',
      mediaIds: Array.isArray(variant.mediaIds) ? variant.mediaIds.map((id) => String(id)) : [],
      attributeValues: attributeValuesRecord,
    };
  });

  if (variants.length === 0) {
    variants.push(createEmptyVariant(variantAttributes));
  }

  return {
    productTypeId: resolvedTypeId,
    title: product?.title ?? '',
    slug: product?.slug ?? '',
    description: product?.description ?? '',
    brand: product?.brand ?? '',
    seoTitle: product?.seoTitle ?? '',
    seoDescription: product?.seoDescription ?? '',
    status: product?.status ?? 'draft',
    showInCart: product?.showInCart ?? false,
    attributeValues,
    categories: (product?.categories ?? []).map(String),
    variants,
  };
}

function buildAttributePayload(
  record: AttributeRecord,
  defs: AttributeDef[],
  setFieldError: (field: string, message: string) => void,
  fieldPrefix: string,
): { success: boolean; data: Array<{ key: string; value: unknown }> } {
  const data: Array<{ key: string; value: unknown }> = [];
  let success = true;

  defs.forEach((def) => {
    const raw = record?.[def.key];
    const fieldName = `${fieldPrefix}.${def.key}`;

    const pushValue = (value: unknown) => {
      data.push({ key: def.key, value });
    };

    switch (def.kind) {
      case 'text': {
        const value = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
        if (!value && def.required) {
          setFieldError(fieldName, 'این فیلد الزامی است');
          success = false;
        } else if (value) {
          pushValue(value);
        }
        break;
      }
      case 'number': {
        let numberValue: number | undefined;
        if (typeof raw === 'number') {
          numberValue = raw;
        } else if (typeof raw === 'string' && raw.trim().length > 0) {
          const parsed = Number(raw);
          if (!Number.isNaN(parsed)) numberValue = parsed;
        }
        if (numberValue === undefined) {
          if (def.required) {
            setFieldError(fieldName, 'عدد معتبر وارد کنید');
            success = false;
          }
        } else {
          pushValue(numberValue);
        }
        break;
      }
      case 'boolean': {
        const value = Boolean(raw);
        if (value || def.required) {
          pushValue(value);
        }
        break;
      }
      case 'enum': {
        const value = typeof raw === 'string' ? raw : raw != null ? String(raw) : '';
        if (!value) {
          if (def.required) {
            setFieldError(fieldName, 'یکی از گزینه‌ها را انتخاب کنید');
            success = false;
          }
        } else if (!def.enumValues || def.enumValues.includes(value)) {
          pushValue(value);
        } else {
          setFieldError(fieldName, 'گزینه انتخاب‌شده معتبر نیست');
          success = false;
        }
        break;
      }
      case 'multi-enum': {
        const values: string[] = Array.isArray(raw)
          ? raw.map((item) => String(item))
          : raw != null
            ? [String(raw)]
            : [];
        const filtered = values.filter(Boolean);
        if (filtered.length === 0) {
          if (def.required) {
            setFieldError(fieldName, 'حداقل یک گزینه را انتخاب کنید');
            success = false;
          }
        } else {
          pushValue(filtered);
        }
        break;
      }
      case 'json': {
        if (typeof raw === 'string' && raw.trim().length > 0) {
          try {
            pushValue(JSON.parse(raw));
          } catch {
            setFieldError(fieldName, 'ساختار JSON معتبر نیست');
            success = false;
          }
        } else if (def.required) {
          setFieldError(fieldName, 'این فیلد الزامی است');
          success = false;
        }
        break;
      }
      case 'color': {
        const value = typeof raw === 'string' ? raw.trim() : '';
        if (!value) {
          if (def.required) {
            setFieldError(fieldName, 'انتخاب رنگ الزامی است');
            success = false;
          }
          break;
        }
        const validKeys = (def.values ?? []).map((color) => color.key);
        if (validKeys.length > 0 && !validKeys.includes(value)) {
          setFieldError(fieldName, 'رنگ انتخاب‌شده معتبر نیست');
          success = false;
          break;
        }
        pushValue(value);
        break;
      }
      default:
        break;
    }
  });

  return { success, data };
}

function ProductSaveForm({ defaultValues = null, productTypes, categories, obj }: ProductSaveFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [offerDialogOpen, setOfferDialogOpen] = useState<boolean>(false);

  const [llmProductDialog, setLlmProductDialog] = useState(false);

  const [wizard, setWizard] = useState(false);

  const [price, setPrice] = useState(1000);

  const methods = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema as any),
    defaultValues: obj || buildDefaultValues(defaultValues ?? undefined, productTypes),
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
    formState: { isSubmitting },
  } = methods;

  const productTypeId = useWatch({ control, name: 'productTypeId' });
  const previousProductTypeIdRef = useRef<string | undefined>(productTypeId);
  const variantsWatch = useWatch({ control, name: 'variants', defaultValue: [] as VariantFormValue[] });

  const dialogVariants = useMemo(() => {
    return (variantsWatch ?? []).map((variant) => {
      const priceAmount = Number(variant?.priceAmount ?? 0);
      const offerEnabled = Boolean(variant?.offerEnabled);
      const offerAmount = Number(variant?.offerAmount ?? 0);
      const startsAtDate = parseDateInput(variant?.offerStartsAt);
      const endsAtDate = parseDateInput(variant?.offerEndsAt);

      const price: BulkPrice = {
        model: variant?.priceModel ?? 'fixed',
        amount: Number.isFinite(priceAmount) ? priceAmount : 0,
        unitOfMeasure: variant?.priceUnit || undefined,
      };

      return {
        sku: variant?.sku ?? '',
        active: variant?.active ?? true,
        price,
        offer:
          offerEnabled && (offerAmount > 0 || startsAtDate || endsAtDate || (variant?.offerLabel ?? '').trim())
            ? {
              amount: Number.isFinite(offerAmount) ? offerAmount : 0,
              label: variant?.offerLabel?.trim() || undefined,
              startsAt: startsAtDate,
              endsAt: endsAtDate,
            }
            : undefined,
      } satisfies BulkVariant;
    });
  }, [variantsWatch]);

  const productType = useMemo(() => productTypes.find((item) => item.id === productTypeId), [productTypeId, productTypes]);
  const globalAttributes = useMemo(() => productType?.attributes.filter((attr) => !attr.variant) ?? [], [productType]);
  const variantAttributes = useMemo(
    () => ensureWeightVariantAttribute(productType?.attributes.filter((attr) => attr.variant) ?? []),
    [productType],
  );
  const isEditing = Boolean(defaultValues?.id || defaultValues?._id);

  const { fields: variantFields, append, remove } = useFieldArray({ control, name: 'variants' });
  const variantFieldIds = useMemo(() => variantFields.map((field) => field.id).join('|'), [variantFields]);

  const handleBulkOfferApply = (updatedVariants: BulkVariant[]) => {
    updatedVariants.forEach((variant, index) => {
      const offer = variant.offer;
      const hasOffer = Boolean(offer && (offer.amount > 0 || offer.label || offer.startsAt || offer.endsAt));

      setValue(`variants.${index}.offerEnabled`, hasOffer, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      setValue(`variants.${index}.offerAmount`, offer?.amount ?? 0, { shouldDirty: true, shouldTouch: true, shouldValidate: true });
      setValue(`variants.${index}.offerLabel`, offer?.label ?? '', { shouldDirty: true, shouldTouch: true });
      setValue(
        `variants.${index}.offerStartsAt`,
        offer?.startsAt ? formatDateObjectToInput(offer.startsAt) : '',
        { shouldDirty: true, shouldTouch: true, shouldValidate: true },
      );
      setValue(
        `variants.${index}.offerEndsAt`,
        offer?.endsAt ? formatDateObjectToInput(offer.endsAt) : '',
        { shouldDirty: true, shouldTouch: true, shouldValidate: true },
      );
    });

    clearErrors('variants');
    setOfferDialogOpen(false);
  };

  useEffect(() => {
    reset(obj || buildDefaultValues(defaultValues ?? undefined, productTypes));
    setFormError(null);
  }, [defaultValues, productTypes, reset]);

  useEffect(() => {
    if (!productTypeId) {
      previousProductTypeIdRef.current = productTypeId;
      return;
    }

    const previousTypeId = previousProductTypeIdRef.current;
    if (previousTypeId === productTypeId) {
      previousProductTypeIdRef.current = productTypeId;
      return;
    }

    const nextProductType = productTypes.find((type) => type.id === productTypeId);
    if (!nextProductType) {
      previousProductTypeIdRef.current = productTypeId;
      return;
    }

    if (isEditing) {
      toast.warning('نوع محصول تغییر کرد. ویژگی‌ها و واریانت‌ها بر اساس نوع جدید بازنشانی شدند، لطفاً بررسی کنید.');
    }

    const currentValues = methods.getValues();
    const nextGlobalAttributes = nextProductType.attributes.filter((attr) => !attr.variant);
    const nextVariantAttributes = ensureWeightVariantAttribute(
      nextProductType.attributes.filter((attr) => attr.variant),
    );

    const nextAttributeValues: AttributeRecord = {};
    nextGlobalAttributes.forEach((attr) => {
      const existing = (currentValues.attributeValues as AttributeRecord | undefined)?.[attr.key];
      nextAttributeValues[attr.key] =
        existing !== undefined ? existing : attributeDefaultValue(attr);
    });

    const nextVariants = (currentValues.variants ?? []).map((variant) => {
      const existingAttributes = (variant.attributeValues ?? {}) as AttributeRecord;
      const updatedAttributes: AttributeRecord = {};
      nextVariantAttributes.forEach((attr) => {
        const existing = existingAttributes[attr.key];
        updatedAttributes[attr.key] =
          existing !== undefined ? existing : attributeDefaultValue(attr);
      });
      return {
        ...variant,
        attributeValues: updatedAttributes,
      };
    });

    if (nextVariants.length === 0) {
      nextVariants.push(createEmptyVariant(nextVariantAttributes));
    }

    previousProductTypeIdRef.current = productTypeId;

    methods.reset(
      {
        ...currentValues,
        productTypeId,
        attributeValues: nextAttributeValues,
        variants: nextVariants,
      },
      {
        keepDirty: false,
        keepTouched: false,
      },
    );
  }, [productTypeId, productTypes, methods, isEditing]);

  useEffect(() => {
    if (!productType) return;

    const attributeValues: AttributeRecord = {};
    globalAttributes.forEach((attr) => {
      attributeValues[attr.key] = attributeDefaultValue(attr);
    });

    methods.setValue('attributeValues', {
      ...attributeValues,
      ...methods.getValues('attributeValues'),
    });
  }, [productType, globalAttributes, methods]);

  useEffect(() => {
    variantFields.forEach((_, index) => {
      variantAttributes.forEach((attr) => {
        const path = `variants.${index}.attributeValues.${attr.key}`;
        const currentValue = methods.getValues(path as never);
        if (currentValue === undefined) {
          methods.setValue(path as FieldPath<ProductFormValues>, attributeDefaultValue(attr));
        }
      });
    });
  }, [variantAttributes, variantFieldIds, methods, variantFields]);

  async function onSubmit(values: ProductFormValues) {
    setFormError(null);
    clearErrors();

    const selectedProductType = productTypes.find((item) => item.id === values.productTypeId);
    if (!selectedProductType) {
      setFormError('نوع محصول انتخاب شده معتبر نیست.');
      return;
    }

    const globalAttributeResult = buildAttributePayload(
      values.attributeValues ?? {},
      selectedProductType.attributes.filter((attr) => !attr.variant),
      (field, message) => {
        setError(field as keyof ProductFormValues, { type: 'manual', message });
      },
      'attributeValues',
    );

    let hasError = !globalAttributeResult.success;

    const variantAttributeDefs = ensureWeightVariantAttribute(
      selectedProductType.attributes.filter((attr) => attr.variant),
    );

    const variantsPayload = values.variants.map((variant, index) => {
      const attributeResult = buildAttributePayload(
        variant.attributeValues ?? {},
        variantAttributeDefs,
        (field, message) => {
          setError(field as keyof ProductFormValues, { type: 'manual', message });
        },
        `variants.${index}.attributeValues`,
      );

      if (!attributeResult.success) {
        hasError = true;
      }

      const mediaIds = Array.isArray(variant.mediaIds)
        ? Array.from(new Set(variant.mediaIds.map((id) => id.trim()).filter(Boolean)))
        : [];

      const offerEnabled = variant.offerEnabled && variant.offerAmount !== undefined;

      const offer = offerEnabled
        ? {
          amount: variant.offerAmount ?? 0,
          startsAt: trimmedOrUndefined(variant.offerStartsAt),
          endsAt: trimmedOrUndefined(variant.offerEndsAt),
          label: trimmedOrUndefined(variant.offerLabel),
        }
        : undefined;

      return {
        sku: variant.sku.trim(),
        attributeValues: attributeResult.data,
        price: {
          model: variant.priceModel,
          amount: variant.priceAmount ?? 0,
          unitOfMeasure: trimmedOrUndefined(variant.priceUnit),
        },
        inventory: {
          trackingUnit: variant.inventoryTracking,
          quantity: variant.inventoryQuantity ?? 0,
          lowStockThreshold: variant.inventoryLowStock,
        },
        minimumOrderQuantity: variant.minimumOrderQuantity,
        maximumOrderQuantity: variant.maximumOrderQuantity,
        barcode: trimmedOrUndefined(variant.barcode),
        mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
        offer,
        active: variant.active,
      };
    });

    if (hasError) {
      setFormError('لطفاً خطاهای مشخص‌شده در فرم را برطرف کنید.');
      return;
    }

    const payload = {
      productTypeId: values.productTypeId,
      title: values.title.trim(),
      slug: values.slug.trim(),
      description: trimmedOrUndefined(values.description),
      brand: trimmedOrUndefined(values.brand),
      seoTitle: trimmedOrUndefined(values.seoTitle),
      seoDescription: trimmedOrUndefined(values.seoDescription),
      status: values.status,
      showInCart: values.showInCart,
      attributeValues: globalAttributeResult.data,
      categories: values.categories ?? [],
      variants: variantsPayload,
      ...(obj?.dgkImport ? { dgkImport: obj.dgkImport } : {}),
    };

    const isUpdate = Boolean(defaultValues?.id || defaultValues?._id);
    const id = defaultValues?.id ?? defaultValues?._id;
    const url = isUpdate ? `/api/catalog/products/${id}` : '/api/catalog/products';
    const method = isUpdate ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new Error(message || 'ذخیره محصول با خطا مواجه شد');
      }

      toast.success('محصول با موفقیت ذخیره شد');
      router.push('/admin/catalog/products');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ذخیره محصول با خطا مواجه شد';
      setFormError(message);
    }
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Stack spacing={3}>


          <Form methods={methods as any} onSubmit={handleSubmit(onSubmit as any)}>

            <Stack gap={2} alignItems="center" justifyContent="space-between" direction="row">
              <Typography variant="h4">{defaultValues ? 'ویرایش محصول' : 'ایجاد محصول جدید'}</Typography>
              <Button type="submit" variant="contained" disabled={isSubmitting} startIcon={isSubmitting ? <CircularProgress size={20} /> : null}>
                ذخیره محصول
              </Button>
            </Stack>

            {formError && <Alert severity="error" action={<Button
              onClick={() => {
                setLlmProductDialog(true)
              }}
            >
              حل مشکل با هوش مصنوعی
            </Button>}>{formError}</Alert>}

            <Stack spacing={3} sx={{ my: 4 }}>

              <CardHeader title="اطلاعات اصلی" subheader="جزئیات عمومی محصول را تکمیل کنید" action={
                <Field.Switch name="showInCart" label="نمایش در صفحه سبد خرید" />} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Field.Select
                    name="productTypeId"
                    label="نوع محصول"
                    required
                    fullWidth
                  >
                    {productTypes.map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        {type.name}
                      </MenuItem>
                    ))}
                  </Field.Select>
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <Field.Select name="status" label="وضعیت" fullWidth>
                    {STATUS_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Field.Select>
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>

                  <Field.MultiSelect
                    name="categories"
                    label="دسته‌بندی‌ها"
                    options={categories.map((category) => ({
                      value: category.id,
                      label: `${category.name}`,
                    }))}
                    checkbox
                    chip
                    fullWidth
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Field.Text name="title" label="عنوان" required fullWidth />
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <Field.Text name="slug" label="شناسه یکتا" required fullWidth helperText="برای استفاده در URL" />
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                  <Field.Text name="brand" label="برند" fullWidth />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Field.Text name="description" label="توضیحات" fullWidth multiline minRows={3} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Stack direction="row" gap={2} alignItems="center" flexWrap="wrap">
                    <Orderly
                      buttonProps={{
                        variant: "contained",
                        children: "SEO",
                        startIcon: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16">
                          <path fill="currentColor" d="M15.545 6.558a9.4 9.4 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.7 7.7 0 0 1 5.352 2.082l-2.284 2.284A4.35 4.35 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.8 4.8 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301c1.078 0 2.004-.276 2.722-.764h-.003a3.7 3.7 0 0 0 1.599-2.431H8v-3.08z"></path>
                        </svg>
                      }}>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12 }}>
                          <Field.Text name="seoTitle" label="عنوان سئو" fullWidth />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <Field.Text name="seoDescription" label="توضیحات سئو" fullWidth multiline minRows={3} />
                        </Grid>
                      </Grid>
                    </Orderly>


                    {!!globalAttributes.length && <Orderly
                      buttonProps={{
                        variant: "contained",
                        children: "ویژگی‌های عمومی",
                        startIcon: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16">
                          <g fill="currentColor">
                            <path d="M6.5 0A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0zm3 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5z"></path>
                            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1A2.5 2.5 0 0 1 9.5 5h-3A2.5 2.5 0 0 1 4 2.5zm6.854 7.354l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 0 1 .708-.708L7.5 10.793l2.646-2.647a.5.5 0 0 1 .708.708"></path>
                          </g>
                        </svg>
                      }}>
                      <AttributeFields attributes={globalAttributes} namePrefix="attributeValues" />
                    </Orderly>}

                    <Orderly
                      mountChildrenOnOpen
                      buttonProps={{
                        variant: "contained",
                        children: "واریانت‌ها",
                        startIcon: <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 16 16">
                          <g fill="currentColor">
                            <path d="M6.5 0A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0zm3 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5z"></path>
                            <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1A2.5 2.5 0 0 1 9.5 5h-3A2.5 2.5 0 0 1 4 2.5zm6.854 7.354l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 0 1 .708-.708L7.5 10.793l2.646-2.647a.5.5 0 0 1 .708.708"></path>
                          </g>
                        </svg>
                      }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Button
                          variant='contained'
                          color='secondary'
                          onClick={() => setWizard(true)}
                          startIcon={<svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                            <path fill="currentColor" fillRule="evenodd" d="M12 1c6.075 0 11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12S5.925 1 12 1m5.493 7.13a1 1 0 0 0-1.008.013L12 10.833V9a1 1 0 0 0-1.514-.857l-5 3a1 1 0 0 0 0 1.714l5 3A1 1 0 0 0 12 15v-1.834l4.485 2.691A1 1 0 0 0 18 15V9a1 1 0 0 0-.507-.87M16 13.234L13.944 12L16 10.766zM7.944 12L10 13.234v-2.468z" clipRule="evenodd"></path>
                          </svg>}
                        >
                          جادوگر واریانت
                        </Button>
                        <Button variant="outlined" onClick={() => setOfferDialogOpen(true)}>
                          اعمال تخفیف درصدی روی همه واریانت‌ها
                        </Button>
                      </Stack>

                      <VariantWizard
                        open={wizard}
                        onClose={() => setWizard(false)}
                        PRICE_MODEL_OPTIONS={PRICE_MODEL_OPTIONS}
                        productType={productType}
                        variantAttributes={variantAttributes}
                        append={append}
                        remove={remove}
                      />

                      <Stack gap={1} direction="row" alignItems="center" flexWrap="wrap" sx={{ mt: 2 }}>

                        {variantFields.map((field, index) => {
                          const variantValue = variantsWatch?.[index];
                          const basePrice = Number(variantValue?.priceAmount ?? 0);
                          const offerAmount = variantValue?.offerEnabled ? Number(variantValue?.offerAmount ?? 0) : 0;
                          const hasOfferPreview = Boolean(variantValue?.offerEnabled) && basePrice > 0 && offerAmount >= 0;
                          const discountedPrice = Math.max(0, basePrice - offerAmount);

                          const variants = productType?.attributes.filter(x => x.variant);

                          const label = variants?.map(x => field.attributeValues[x.key] ? `${x.label}: ${field.attributeValues[x.key]}` : false).filter(x => x).join(" | ")

                          const offerEnabled = !!field.offerEnabled;
                          return (
                            <Orderly
                              key={field.id}
                              mountChildrenOnOpen
                              buttonProps={{
                                children: label || field.sku || `واریانت ${index + 1}`,
                                variant: "contained"
                              }}
                            >
                              <VariantFull
                                PRICE_MODEL_OPTIONS={PRICE_MODEL_OPTIONS}
                                UNIT_OPTIONS={UNIT_OPTIONS as any}
                                basePrice={basePrice}
                                discountedPrice={discountedPrice}
                                hasOfferPreview={hasOfferPreview}
                                index={index}
                                variantAttributes={variantAttributes}
                                offerEnabled={offerEnabled}
                                onDelete={() => { remove(index) }}
                              />
                            </Orderly>
                          );
                        })}

                        <Button
                          type="button"
                          variant="outlined"
                          startIcon={
                            <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                              <path fill="currentColor" d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2s10 4.477 10 10" opacity={0.5}></path>
                              <path fill="currentColor" d="M12.75 9a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V15a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25z"></path>
                            </svg>
                          }
                          onClick={() => append(createEmptyVariant(variantAttributes))}
                        >
                          افزودن واریانت جدید
                        </Button>
                      </Stack>

                    </Orderly>


                    <Button
                      variant='contained'
                      onClick={() => setLlmProductDialog(true)}
                      startIcon={<svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                        <path fill="currentColor" d="M10.941 9.753h-.017a18 18 0 0 1-.288 1.04l-.56 1.663h1.719l-.557-1.656c-.127-.373-.212-.714-.297-1.047m9.181 3.773a3.42 3.42 0 0 0-.295-2.984q.255-1.446-.605-1.981q.186-1.617-.528-2.093a1.35 1.35 0 0 0-.683-1.324a1.694 1.694 0 0 0-1.5-1.652q-.435-.972-2.18-1.029q-1.616-1.017-2.595.2q-.045-.318-.625-.446a3.73 3.73 0 0 0-2.5.477a3 3 0 0 1-.407.177q-1.95.891-2.041 1.911a1.67 1.67 0 0 0-.632 1.678a1.26 1.26 0 0 0-.478 1.44a1.53 1.53 0 0 0-.648 1.448a1.53 1.53 0 0 0-.32 1.159a1.54 1.54 0 0 0-.3 1.817a2.62 2.62 0 0 0 .156 1.782a3.82 3.82 0 0 0 1.012 2.742a8 8 0 0 1 .769 1.574a8 8 0 0 0 1.108 1.254q.684 1.248 1.505 1.125a1.47 1.47 0 0 0 1.713.666q1.056.815 1.453-.208q.378-.535.666-.034q.659 1.51 3.044.077a1.69 1.69 0 0 0 1.705-1.055a1.377 1.377 0 0 0 1.176-1.6a2.5 2.5 0 0 0 .372-.536q1.365-.352 1.5-2.258a2.17 2.17 0 0 0 .158-2.327M12.06 2.9q.854-1.116 2.065-.061l.037-.013q1.309-.452 2.179 1.038q1.023.143 1.4 1.506a.98.98 0 0 1 .519 1.159l.251.311a2.52 2.52 0 0 1 .371 1.894v.013a1.08 1.08 0 0 0-1 .294l-.278-.441a1.23 1.23 0 0 0-.891-.281V8.15a2.65 2.65 0 0 0-1.718-2.48a1 1 0 0 1 .735-.158q-.222-.026-.329-.484a.4.4 0 0 1-.173-.5q-.659-1.132-.709-.5a1.02 1.02 0 0 1 .156.674q.558.33.45.519l-.482.348a2.7 2.7 0 0 0-.574-.063h-.71q-.024-.03-.051-.06q-.9-.774-.761-1.194q-.069-.754.917-.951q.531-.165-.1-.26q-1.248.236-1.159 1.367l-.5.069A2.06 2.06 0 0 1 12.06 2.9m2.435 7.117a.445.445 0 0 1-.449-.46a.456.456 0 0 1 .466-.469a.465.465 0 1 1-.017.929m.39.7v4.127h-.746v-4.128Zm-2.047-5.326a.2.2 0 0 0-.059.112h-.925a9 9 0 0 0-.175-.908l.484-.069q-.145.645.675.865M7.125 3.862l.209.021q.02-.12.424-.423l.069.077L7.368 4H7.02Zm-.243.316c.155-.006.406-.012.763-.018q.037 0 .934-.882h.294a.2.2 0 1 1 0 .138h-.285l-.874.891l-.935.014Zm-.245.354h1.5l.45-.42l.274.007a.245.245 0 1 1 0 .113h-.255l-.433.441l-1.612-.019q.036-.06.076-.122m-.221.337l2.672-.008L10.795 3.2h.712l-.03.147h-.648L9.148 4.991l-2.8-.026Zm4.6.492h.483v.127l-.435-.006l-.019.019h-.18Zm-.281-.351l-.514.493h-.173l.657-.629h.709v.13Zm-4.619.352l3.257-.006l.05-.045q.09-.093 1-.909l.995.008v.116h-.993L9.377 5.5l-3.315-.02c.016-.037.033-.08.054-.118m-.174.487l2.873-.007a3 3 0 0 0-.226.143l-2.675-.006a2 2 0 0 1 .028-.13m-.424 1.268a6 6 0 0 1 .607-.666h-.239v-.132l2.327-.012a2 2 0 0 0-.117.128l-1.794.015l-.724.732l.026 1.875q.077.068.839.763v.233l.675.632l.009.934l.338.336v.15l-.438-.434l-.017-.971l-.675-.623v-.24l-.84-.752Zm1.467 10.03v-.173h.126v.173Zm.126.057v.376h-.124v-.38Zm-.137-2.626v-.164h.144v.164Zm-.826-2.312v-.553l-.4-.414a.2.2 0 0 1-.1.031a.131.131 0 1 1 .158-.128a.1.1 0 0 1-.008.042l.412.4v.562c.687.681 1.1 1.093 1.26 1.252v.811h-.084l.008-.291h.04l.012-.427Zm.75 2.148v.164h-.162v-.164Zm-.161-.141v-.291h.158v.291Zm-.052.141v.164h-.164v-.164Zm-.223.164H6.32v-.164h.141Zm-.2-.6v.291h-.2v-.291h.086a2 2 0 0 0 .032-.3a.143.143 0 0 1-.2-.133a.144.144 0 1 1 .287 0a.15.15 0 0 1-.047.107a6 6 0 0 0-.021.33Zm-.362.881v.149h-.157v-.149h.091a.9.9 0 0 1 .227-.319v-.13h.2v.164h-.153a1 1 0 0 0-.213.285Zm-.156 1.446v-.175h.151v.177Zm.156.058v.159h-.157v-.158Zm-.156-.291v-.15h.151v.151Zm0-.208v-.141h.151v.142Zm0-.2v-.158h.151v.159Zm0-.216V15.3h.151v.151Zm0-.207v-.171h.151v.176Zm1.076-5.237v-.376a1.54 1.54 0 0 1-.825-.698l.1-.024a1.5 1.5 0 0 0 .131.187h.226v.09h-.146a1.4 1.4 0 0 0 .3.236l.006-.238h-.117V9.09h.48v.089h-.234v.308a1.4 1.4 0 0 0 .506.128v-.44h-.219v-.09h.447v.088h-.089v.443l.083-.005v1.53l-.019-1.123h-.134v-.266h-.13v.266H7.05v.214l.281.309c.017.58.039.926.039.926l.1.1v.125q-.197-.21-.205-.2a3.2 3.2 0 0 0-.043-.935a3 3 0 0 1-.269-.311v-.233Zm.275-1.79a.129.129 0 1 0 0 .254h.03l.077.083a.3.3 0 0 1-.107.019a.23.23 0 1 1 0-.458a.25.25 0 0 1 .244.175h.127v.1h-.125a.23.23 0 0 1-.1.141l-.077-.073a.13.13 0 0 0 .076-.111a.14.14 0 0 0-.145-.13m-.757-.2h-.075c-.178 0-.3.005-.356.01c0 .052-.008.1-.008.158a1.4 1.4 0 0 0 .089.5c.69-.008 1.2-.009 1.453-.009a.2.2 0 0 1 .024-.083v.21l-.013-.031c-.755 0-1.269.012-1.421.016q.02.042.042.083l-.1.028a1.5 1.5 0 0 1-.178-.715a1.538 1.538 0 0 1 2.078-1.443a2.63 2.63 0 0 0-.405 1.274q-.732-.003-1.131.001Zm1.189 8.961v.173h-.148v-.173Zm0 .231v.375h-.149V17.2Zm-.142-2.628v-.164h.08v.164Zm-.052-.164v.164h-.164v-.164Zm-.17 2.79h.164v.375h-.04c.049.115.1.3.143.375h.536l.058.077q-.234-.01-.617-.012a1.5 1.5 0 0 1-.162-.436h-.083ZM4.781 9.009l.679.722v.411c.162.172.265.282.32.348l.08.1c.16.006.42.007.42.007a2.6 2.6 0 0 1 .377.441c.02.612.024.87.024.87q.426.439.78.8v.109c-.57-.571-.868-.865-.868-.865c-.023-.605-.017-.893-.017-.893a6 6 0 0 0-.335-.385a4 4 0 0 1-.418 0l-.011-.01l-.09-.092a6 6 0 0 1-.233-.252l-.146-.153l.009-.394l-.623-.618Zm.875 7.747h-.354v-.171h.354Zm0-.447h-.354v-.174h.354Zm0-.441h-.354v-.082a3 3 0 0 1-.227-.034a.089.089 0 1 1-.087-.107a.09.09 0 0 1 .086.069q.07.015.228.038v-.022h.354Zm0-.415h-.354v-.087c-.1-.017-.165-.028-.21-.037a.1.1 0 1 1 .008-.041l.2.033V15.3h.354Zm0-.441h-.354v-.149h.354Zm-.044-.639l-.1-.057h-.359l-.307.354a2.7 2.7 0 0 0-.549 0l-.013-.584l.06-.06a.94.94 0 0 1-.3-.736q-.042-.774.113-.938q.058-.05-.083-.4a1 1 0 0 1 .07-.882a.7.7 0 0 1 .315-.437h.007v-.007a.53.53 0 0 1 .029-.65l.346.2l-.009 1.436l.839.8l-.576-.012a.28.28 0 0 0-.307-.238a.246.246 0 1 0 0 .476a.3.3 0 0 0 .3-.182l.593.011l-.008.584h-.332a.245.245 0 0 0-.245-.162a.211.211 0 1 0 0 .415a.24.24 0 0 0 .249-.179h.34q-.013.645-.012.649l-.334-.009a.27.27 0 0 0-.269-.171a.23.23 0 1 0 .277.227l.334.009v.333l.311.311l-.112.117Zm.9 3.483a.11.11 0 0 1 .092-.109v-.167h-.083v-.331l-.053-.015v.346h-.162v-.377h.069a1 1 0 0 1-.137-.065v.009h-.182v-.138a1 1 0 0 1-.214-.253h-.1v-.172h.153v.163a2 2 0 0 0 .223.227h.119v.094l.067.046v-.14h.159v.173h-.101q.05.03.1.056l.053.025V17.2h.157v.377h-.026v.17a.11.11 0 1 1-.14.106Zm.9 1.929v-.943H6.83a.2.2 0 0 1-.184-.182v-.212c.008-.135.066-.2.173-.181h.746a.45.45 0 0 1 .136.155a2 2 0 0 0 .323 0l.108-.1l.152-.006a2.7 2.7 0 0 0 .53.393h-.245a.157.157 0 0 1-.173.121v.426h-.11l.007-.428q-.216-.027-.234-.186h-.437a.24.24 0 0 0-.1-.27h-.675q-.11-.017-.112.115v.151a.22.22 0 0 0 .24.1a3.3 3.3 0 0 0 .549-.037c.009.585.007.93.007.93l.354-.009v-.938l.13-.018v.956l.26.009v-.273h.12v.284h.29v-.138l.39.009l-.013.44l-.377-.008v-.165Zm1.5 1.239a.238.238 0 1 1 0-.476a.23.23 0 0 1 .156.059l-.071.073a.136.136 0 1 0 .051.106a.13.13 0 0 0-.015-.062l.078-.069a.238.238 0 0 1-.2.369Zm1.413.346q.11-.212-.173-.191q.002.04-.026-.1q.401-.061.355.311Zm1-.2l-1.1-1.05a.2.2 0 0 1-.058.007a.2.2 0 0 1-.111-.031l.063-.082a.11.11 0 1 0-.061-.1a.1.1 0 0 0 .024.068l-.067.078a.2.2 0 0 1-.059-.146a.212.212 0 1 1 .423 0a.2.2 0 0 1-.035.116l1.07 1.054Zm.147-.342a.216.216 0 0 1-.216-.216a.2.2 0 0 1 .04-.125q-.27-.29-1.455-1.449q.08.009.163.012l1.354 1.378a.2.2 0 0 1 .114-.032a.216.216 0 0 1 0 .432m.379-.614l-.233.008l.008-.588h.329a5 5 0 0 1-.116.577Zm.111-7.176H9.924l-.594 1.808h-.763L10.509 9.1h.89l1.95 5.746h-.789Zm6.472 4.834a.8.8 0 0 1-.485-.917q.114-1-.813-.8q1.048 1.139-.519 1.505q.4.4.986-.311a2.1 2.1 0 0 0 .476.821l-.294.415a1.02 1.02 0 0 1-.969 1.229q-.116.151.017-.139q-.094-.632-.657-.622a.83.83 0 0 1-.9.017q-.617-.262-.743.277a2.1 2.1 0 0 1-1.315.813a1.16 1.16 0 0 0 1.47-.485q-.273-.738.865-.086q1.095-.373 1.107.484a1.89 1.89 0 0 1-1.487.865q-.3.617-1.973.658a1.214 1.214 0 0 1-1.141-1.367a1.14 1.14 0 0 0-.015-1.18h2.034a2.646 2.646 0 0 0 2.645-2.559l.024-.032l-.024-.006v-1.905a1.16 1.16 0 0 0 .515-.346a.95.95 0 0 1 .692-.069q.481 1.307-.64 1.211q.417.441.744-.052a1.66 1.66 0 0 1 1.609.467a3 3 0 0 1-1.221 2.111Zm1.314-2.336a1.41 1.41 0 0 0-1.487-.519q.426-.294.069-.917q-.617-.242-.727-.553a1.88 1.88 0 0 0 .139-1.488q.276.1.346-.1q-.21-.265-.485.052a2.3 2.3 0 0 1-.346 1.643a2.2 2.2 0 0 1-.532.584v-3.585a1.44 1.44 0 0 1 1.055.239a.92.92 0 0 0-.934-.38l.087-.415q-.103.114-.208.22V9.145a1.4 1.4 0 0 0 .29-.48l.554.017q.106 0 .311.45c.988-.859.583.374 1.052-.215l-.043-.117q.043.02.085.043l.021-.022v-.009q.214.009.323.424a2.94 2.94 0 0 1 .138 1.557q.726.63 0 1.194l.415.086a3.3 3.3 0 0 1-.121 1.557a2.02 2.02 0 0 1-.014 1.903Z"></path>
                      </svg>}>
                      هوش مصنوعی
                    </Button>

                    <Tooltip title="اعمال قیمت روی همه تنوع ها">
                      <Orderly
                        buttonProps={{
                          children: "هنگام سازی قیمت",
                          variant: "contained"
                        }}
                        dialogProps={{
                          maxWidth: 'sm'
                        }}
                      >
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Box flex="1 1 auto">
                            <TextField
                              variant='standard'
                              value={price.toLocaleString("IR-fa")}
                              label="قیمت"
                              fullWidth
                              onChange={e => setPrice(parseInt(e.target.value.replace(/\D/g, '')))}
                              helperText="قیمت به تومان"
                            />
                          </Box>
                          <Button variant='contained' onClick={() => {
                            variantFields.map((_, i) => setValue(`variants.${i}.priceAmount`, price));
                            toast.success("قیمت با موفقیت روی همه واریانت ها اعمال شد.")
                          }}>
                            اعمال
                          </Button>
                        </Stack>
                      </Orderly>
                    </Tooltip>

                  </Stack>
                </Grid>
              </Grid>
            </Stack>
            <AIProductChatDialog
              schema={productSchema}
              createEmptyVariant={() => append(createEmptyVariant(variantAttributes))}
              categories={categories}
              productTypes={productTypes}
              title='ذخیره محصول با هوش مصنوعی'
              open={llmProductDialog}
              onClose={() => setLlmProductDialog(false)}
              onTypeUpdate={async obj => {
                try {
                  const url = `/api/catalog/product-types/${methods.watch("productTypeId")}`;
                  const method = 'PATCH';

                  const response = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(obj),
                  });

                  if (!response.ok) {
                    let message = response.statusText || 'خطا در ذخیره نوع محصول';
                    try {
                      const data = (await response.json()) as { error?: string };
                      if (data?.error) message = data.error;
                    } catch {
                      // swallow json parse errors
                    }
                    setFormError(message);
                    toast.error(message);
                    setLlmProductDialog(true);
                    return;
                  }

                  toast.success('نوع محصول با موفقیت به‌روزرسانی شد.');
                  await mutate('/api/catalog/product-types')
                } catch (err) {
                  const message = err instanceof Error ? err.message : 'خطایی رخ داد';
                  toast.error(message);
                }
              }}
              formError={formError}
              append={append}
              remove={remove}
            />
          </Form>
        </Stack>

        <OfferBulkDialog
          open={offerDialogOpen}
          variants={dialogVariants}
          onClose={() => setOfferDialogOpen(false)}
          onApply={handleBulkOfferApply}
        />


      </Box>
    </Container>
  );
}

export default function ProductSave() {
  const searchParams = useSearchParams();
  const obj = (searchParams?.get('obj') ?? '').trim();
  const draft = (searchParams?.get('draft') ?? '').trim();
  const productId = (searchParams?.get('id') ?? '').trim();
  const hasProductId = productId.length > 0;

  const {
    data: productTypesData,
    error: productTypesError,
    isLoading: productTypesLoading,
  } = useSWR<ProductTypesApiResponse>('/api/catalog/product-types', (url) => fetcher<ProductTypesApiResponse>(url), {
    revalidateOnFocus: false,
    keepPreviousData: true,
    revalidateIfStale: true
  });

  const {
    data: categoriesData,
    error: categoriesError,
    isLoading: categoriesLoading,
  } = useSWR<CategoriesApiResponse>('/api/catalog/categories', (url) => fetcher<CategoriesApiResponse>(url), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const {
    data: productData,
    error: productError,
    isLoading: productLoading,
  } = useSWR<ProductApiResponse>(hasProductId ? `/api/catalog/products/${productId}` : null, (url) => fetcher<ProductApiResponse>(url), {
    revalidateOnFocus: false,
  });

  const productTypes = useMemo(() => {
    if (!productTypesData?.productTypes) {
      return [] as ProductTypeOption[];
    }
    return productTypesData.productTypes
      .map((item) => normalizeProductTypeResponse(item))
      .filter((item) => item.id.length > 0);
  }, [productTypesData]);

  const categories = useMemo(() => {
    if (!categoriesData?.categories) {
      return [] as CategoryOption[];
    }
    return categoriesData.categories
      .map((category) => {
        const id = typeof category.id === 'string'
          ? category.id
          : typeof category._id === 'string'
            ? category._id
            : '';
        const name = typeof category.name === 'string' ? category.name : '';
        const path = typeof category.path === 'string' ? category.path : name;
        return { id, name, path } satisfies CategoryOption;
      })
      .filter((category) => category.id.length > 0);
  }, [categoriesData]);

  const defaultProduct = useMemo(() => {
    return normalizeProductResponse(productData?.product ?? null);
  }, [productData]);

  const importedObject = useMemo(() => {
    if (draft && typeof window !== 'undefined') {
      try {
        const rawDraft = window.localStorage.getItem(draft);
        if (rawDraft) return JSON.parse(rawDraft);
      } catch {
        return undefined;
      }
    }

    if (!obj) return undefined;
    try {
      return JSON.parse(obj);
    } catch {
      return undefined;
    }
  }, [draft, obj]);
  const loading = productTypesLoading || categoriesLoading || (hasProductId && productLoading);

  const errorMessage = (productTypesError || categoriesError || productError)?.message;

  if (loading) {
    return (
      <Splash />
    );
  }

  if (errorMessage) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">{errorMessage}</Alert>
      </Box>
    );
  }

  if (productTypes.length === 0) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="warning">برای ایجاد محصول نیاز است ابتدا نوع محصول تعریف کنید.</Alert>
      </Box>
    );
  }

  return <ProductSaveForm defaultValues={defaultProduct} productTypes={productTypes} categories={categories} obj={importedObject} />;
}
