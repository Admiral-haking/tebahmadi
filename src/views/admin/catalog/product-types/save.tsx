'use client';

import React, { JSX, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { Form, Field } from '@/components/hook-form';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AttributeKind, ColorFamily } from '@/catalog/models/ProductType';
import AIProductTypeChatDialog from './components/llm-text';
import Orderly from '@/components/orderly';
import ColorIcon from './components/color-icon';

const ATTRIBUTE_KIND_VALUES = ['text', 'number', 'boolean', 'enum', 'multi-enum', 'json', 'color'] as const satisfies AttributeKind[];

const ATTRIBUTE_KIND_LABEL: Record<AttributeKind, string> = {
  text: 'متن',
  number: 'عدد',
  boolean: 'بلی/خیر',
  enum: 'لیست انتخابی',
  'multi-enum': 'لیست چندانتخابی',
  json: 'JSON',
  color: 'رنگ',
};

const COLOR_FAMILY_OPTIONS: Array<{ value: ColorFamily | ''; label: string }> = [
  { value: '', label: 'نامشخص' },
  { value: 'red', label: 'قرمز' },
  { value: 'orange', label: 'نارنجی' },
  { value: 'yellow', label: 'زرد' },
  { value: 'green', label: 'سبز' },
  { value: 'blue', label: 'آبی' },
  { value: 'purple', label: 'بنفش' },
  { value: 'brown', label: 'قهوه‌ای' },
  { value: 'black', label: 'مشکی' },
  { value: 'white', label: 'سفید' },
  { value: 'grey', label: 'طوسی' },
  { value: 'multi', label: 'چند رنگ' },
];

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

type AttributeFormValue = {
  key: string;
  label: string;
  kind: AttributeKind;
  required: boolean;
  variant: boolean;
  filterable: boolean;
  searchable: boolean;
  enumValuesText: string;
  min: string;
  max: string;
  regex: string;
  unit: string;
  colorValues: ColorValueFormValue[];
};

type ColorSwatchFormValue = {
  value: string;
};

type ColorValueFormValue = {
  key: string;
  name: string;
  swatches: ColorSwatchFormValue[];
  family: ColorFamily | '';
  rtlName: string;
  aliases: string;
  active: boolean;
};

type ProductTypeFormValues = {
  name: string;
  version: string;
  attributes: AttributeFormValue[];
};

type ProductTypeDTO = {
  _id?: string;
  name?: string;
  version?: number;
  attributes?: Array<{
    key: string;
    label: string;
    kind: AttributeKind;
    required?: boolean;
    variant?: boolean;
    filterable?: boolean;
    searchable?: boolean;
    enumValues?: string[];
    min?: number;
    max?: number;
    regex?: string;
    unit?: string;
    values?: Array<{
      key: string;
      name: string;
      swatches: string[];
      family?: ColorFamily;
      rtlName?: string;
      aliases?: string[];
      active?: boolean;
    }>;
  }>;
};

type ProductTypeApiResponse = {
  productType?: Record<string, unknown> | null;
};

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const message = (await response.text().catch(() => '')) || response.statusText;
    throw new Error(message || 'Failed to load product type');
  }
  return (await response.json()) as T;
}

function normalizeColorValueResponse(input: unknown): {
  key: string;
  name: string;
  swatches: string[];
  family?: ColorFamily;
  rtlName?: string;
  aliases?: string[];
  active?: boolean;
} | null {
  if (typeof input !== 'object' || input === null) {
    return null;
  }
  const value = input as Record<string, unknown>;
  const key = typeof value.key === 'string' ? value.key : '';
  const name = typeof value.name === 'string' ? value.name : '';
  const swatches = Array.isArray(value.swatches)
    ? (value.swatches as unknown[])
      .map((swatch) => String(swatch).trim())
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
  return {
    key,
    name,
    swatches,
    family,
    rtlName: typeof value.rtlName === 'string' && value.rtlName.trim().length > 0 ? value.rtlName.trim() : undefined,
    aliases,
    active: value.active === undefined ? true : Boolean(value.active),
  };
}

function normalizeAttributeResponse(input: unknown): ProductTypeDTO['attributes'][] | null {
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
    : undefined;

  const values = Array.isArray(attribute.values)
    ? (attribute.values as unknown[])
      .map(normalizeColorValueResponse)
      .filter((value): value is NonNullable<ReturnType<typeof normalizeColorValueResponse>> => value !== null)
    : undefined;

  return {
    key,
    label,
    kind,
    required: attribute.required === undefined ? undefined : Boolean(attribute.required),
    variant: attribute.variant === undefined ? undefined : Boolean(attribute.variant),
    filterable: attribute.filterable === undefined ? undefined : Boolean(attribute.filterable),
    searchable: attribute.searchable === undefined ? undefined : Boolean(attribute.searchable),
    enumValues,
    min: typeof attribute.min === 'number' ? attribute.min : undefined,
    max: typeof attribute.max === 'number' ? attribute.max : undefined,
    regex: typeof attribute.regex === 'string' ? attribute.regex : undefined,
    unit: typeof attribute.unit === 'string' ? attribute.unit : undefined,
    values,
  } as any;
}

function normalizeProductTypeResponse(input: Record<string, unknown> | null | undefined): ProductTypeDTO | null {
  if (!input) {
    return null;
  }

  const attributes: any[] = Array.isArray(input.attributes)
    ? (input.attributes as unknown[])
      .map(normalizeAttributeResponse)
      .filter((attribute): attribute is NonNullable<ReturnType<typeof normalizeAttributeResponse>> => attribute !== null)
    : [];

  return {
    _id: typeof input._id === 'string' ? input._id : typeof input.id === 'string' ? input.id : undefined,
    name: typeof input.name === 'string' ? input.name : undefined,
    version: typeof input.version === 'number' ? input.version : undefined,
    attributes,
  };
}

const colorSwatchSchema = z
  .object({
    value: z
      .string()
      .trim()
      .min(1, 'کد رنگ الزامی است')
      .regex(/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/, 'کد رنگ باید در قالب هگز باشد'),
  })
  .superRefine((swatch, ctx) => {
    if (!swatch.value.startsWith('#')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'کد رنگ باید با # شروع شود',
        path: ['value'],
      });
    }
  });

const colorValueFormSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1, 'شناسه رنگ الزامی است')
      .max(100, 'حداکثر ۱۰۰ کاراکتر')
      .regex(/^[a-z0-9-]+$/, 'شناسه فقط شامل حروف کوچک، اعداد و خط تیره باشد'),
    name: z.string().trim().min(1, 'نام رنگ الزامی است').max(200, 'حداکثر ۲۰۰ کاراکتر'),
    swatches: z
      .array(colorSwatchSchema)
      .min(1, 'حداقل یک کد رنگ لازم است')
      .max(6, 'حداکثر ۶ کد رنگ پشتیبانی می‌شود'),
    family: z
      .enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'brown', 'black', 'white', 'grey', 'multi'])
      .optional()
      .or(z.literal('')),
    rtlName: z.string().trim().max(200).optional().default(''),
    aliases: z.string().trim().max(500).optional().default(''),
    active: z.boolean().optional().default(true),
  })
  .superRefine((color, ctx) => {
    const uniqueSwatches = new Set(color.swatches.map((swatch) => swatch.value.toLowerCase()));
    if (uniqueSwatches.size !== color.swatches.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'کدهای رنگ تکراری مجاز نیست',
        path: ['swatches'],
      });
    }
  });

const attributeSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1, 'شناسه ویژگی الزامی است')
      .max(100, 'شناسه ویژگی حداکثر باید ۱۰۰ کاراکتر باشد')
      .regex(/^[a-zA-Z0-9_]+$/, 'شناسه فقط باید شامل حروف انگلیسی، اعداد و آندرلاین باشد'),
    label: z
      .string()
      .trim()
      .min(1, 'برچسب ویژگی الزامی است')
      .max(200, 'برچسب ویژگی حداکثر باید ۲۰۰ کاراکتر باشد'),
    kind: z.enum(ATTRIBUTE_KIND_VALUES),
    required: z.boolean().optional(),
    variant: z.boolean().optional(),
    filterable: z.boolean().optional(),
    searchable: z.boolean().optional(),
    enumValuesText: z.string().optional(),
    min: z.string().optional(),
    max: z.string().optional(),
    regex: z.string().optional(),
    unit: z.string().optional(),
    colorValues: z.array(colorValueFormSchema).optional().default([]),
  })
  .superRefine((attr, ctx) => {
    const isEnum = attr.kind === 'enum' || attr.kind === 'multi-enum';
    const enumValues = (attr.enumValuesText ?? '').split('\n').map((v) => v.trim()).filter(Boolean);
    if (isEnum && enumValues.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'برای ویژگی‌های لیستی حداقل یک گزینه لازم است',
        path: ['enumValuesText'],
      });
    }

    const min = (attr.min ?? '').trim();
    const max = (attr.max ?? '').trim();

    if (min && Number.isNaN(Number(min))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'حداقل باید عددی باشد',
        path: ['min'],
      });
    }

    if (max && Number.isNaN(Number(max))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'حداکثر باید عددی باشد',
        path: ['max'],
      });
    }

    if (min && max && !Number.isNaN(Number(min)) && !Number.isNaN(Number(max)) && Number(min) > Number(max)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'حداقل نمی‌تواند از حداکثر بیشتر باشد',
        path: ['min'],
      });
    }

    if (attr.kind === 'color') {
      const colorValues = attr.colorValues ?? [];
      if (colorValues.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'حداقل یک رنگ باید تعریف شود',
          path: ['colorValues'],
        });
      }
      const seen = new Set<string>();
      colorValues.forEach((color, index) => {
        const key = color.key.trim().toLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'شناسه رنگ تکراری است',
            path: ['colorValues', index, 'key'],
          });
        }
        seen.add(key);
      });
    }
  });

const productTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'نام نوع محصول الزامی است')
    .max(200, 'نام باید حداکثر ۲۰۰ کاراکتر باشد'),
  version: z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      const raw = (val ?? '').trim();
      if (!raw) return;
      if (!/^\d+$/.test(raw)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'نسخه باید عدد صحیح مثبت باشد', path: [] });
      }
    }),
  attributes: z.array(attributeSchema),
});

function buildDefaultValues(productType?: ProductTypeDTO | null): ProductTypeFormValues {
  return {
    name: productType?.name ?? '',
    version: productType?.version != null ? String(productType.version) : '',
    attributes: (productType?.attributes ?? []).map((attr) => ({
      key: attr.key ?? '',
      label: attr.label ?? '',
      kind: attr.kind ?? 'text',
      required: Boolean(attr.required),
      variant: Boolean(attr.variant),
      filterable: Boolean(attr.filterable),
      searchable: Boolean(attr.searchable),
      enumValuesText: (attr.enumValues ?? []).join('\n'),
      min: attr.min != null ? String(attr.min) : '',
      max: attr.max != null ? String(attr.max) : '',
      regex: attr.regex ?? '',
      unit: attr.unit ?? '',
      colorValues:
        attr.kind === 'color'
          ? (attr.values ?? []).map((value) => ({
            key: value.key ?? '',
            name: value.name ?? '',
            swatches: (value.swatches ?? ['#FFFFFF']).map((swatch) => ({ value: swatch })),
            family: value.family ?? '',
            rtlName: value.rtlName ?? '',
            aliases: (value.aliases ?? []).join('\n'),
            active: value.active ?? true,
          }))
          : [],
    })),
  };
}

function createEmptyAttribute(kind?: AttributeKind): AttributeFormValue {
  return {
    key: '',
    label: '',
    kind: kind || 'text',
    required: false,
    variant: false,
    filterable: false,
    searchable: false,
    enumValuesText: '',
    min: '',
    max: '',
    regex: '',
    unit: '',
    colorValues: [],
  };
}

function createEmptyColorValue(): ColorValueFormValue {
  return {
    key: '',
    name: '',
    swatches: [{ value: '#FFFFFF' }],
    family: '',
    rtlName: '',
    aliases: '',
    active: true,
  };
}

interface ProductTypeSaveFormProps {
  defaultValues?: ProductTypeDTO | null;
  productTypesData: any
}

type ColorValuesEditorProps = {
  control: Control<ProductTypeFormValues>;
  attributeIndex: number;
};

type ColorValueItemProps = {
  control: Control<ProductTypeFormValues>;
  attributeIndex: number;
  colorIndex: number;
  onRemove: () => void;
  canRemove: boolean;
};

function ProductTypeSaveForm({ defaultValues = null, productTypesData }: ProductTypeSaveFormProps): JSX.Element {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const [llm, setLLM] = useState(false)

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const methods = useForm<ProductTypeFormValues>({
    resolver: zodResolver(productTypeSchema as any),
    defaultValues: buildDefaultValues(defaultValues ?? undefined),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const attributeValues = useWatch({ control, name: 'attributes' });
  const { fields, append, remove } = useFieldArray({ control, name: 'attributes' });

  useEffect(() => {
    reset(buildDefaultValues(defaultValues ?? undefined));
    setFormError(null);
  }, [defaultValues, reset]);

  const isUpdate = useMemo(() => Boolean(defaultValues?._id), [defaultValues?._id]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const payload: Record<string, unknown> = {
      name: values.name.trim(),
    };

    const versionRaw = values.version.trim();
    if (versionRaw) {
      payload.version = Number(versionRaw);
    }

    payload.attributes = values.attributes.map((attr) => {
      const base: Record<string, unknown> = {
        key: attr.key?.trim(),
        label: attr.label?.trim(),
        kind: attr.kind,
      };

      if (attr.required) base.required = true;
      if (attr.variant) base.variant = true;
      if (attr.filterable) base.filterable = true;
      if (attr.searchable) base.searchable = true;

      if (attr.kind === 'enum' || attr.kind === 'multi-enum') {
        const enumValues = attr.enumValuesText
          .split('\n')
          .map((value) => value?.trim())
          .filter((value) => value.length > 0);
        if (enumValues.length > 0) {
          base.enumValues = enumValues;
        }
      }

      if (attr.kind === 'color') {
        base.values = attr.colorValues.map((color) => {
          const swatches = color.swatches
            .map((swatch) => swatch.value?.trim())
            .filter((swatch) => swatch.length > 0);
          const aliases = color.aliases
            .split('\n')
            .map((alias) => alias?.trim())
            .filter((alias) => alias.length > 0);
          return {
            key: color.key?.trim(),
            name: color.name?.trim(),
            swatches,
            family: color.family || undefined,
            rtlName: color.rtlName?.trim() || undefined,
            aliases: aliases.length > 0 ? aliases : undefined,
            active: color.active,
          };
        });
      }

      const minRaw = attr.min?.trim();
      const maxRaw = attr.max?.trim();
      if (minRaw) base.min = Number(minRaw);
      if (maxRaw) base.max = Number(maxRaw);

      if (attr.regex?.trim()) base.regex = attr.regex.trim();
      if (attr.unit?.trim()) base.unit = attr.unit.trim();

      return base;
    });

    try {
      const url = isUpdate ? `/api/catalog/product-types/${defaultValues!._id}` : '/api/catalog/product-types';
      const method = isUpdate ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
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
        return;
      }

      toast.success(isUpdate ? 'نوع محصول با موفقیت به‌روزرسانی شد.' : 'نوع محصول جدید ایجاد شد.');
      router.push('/admin/catalog/product-types');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطایی رخ داد';
      setFormError(message);
      toast.error(message);
    }
  });

  return (
    <Container maxWidth="lg" sx={{ my: 8 }}>
      <Form methods={methods as any} onSubmit={onSubmit}>
        <Stack gap={2}>

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h4">{isUpdate ? 'ویرایش نوع محصول' : 'ایجاد نوع محصول'}</Typography>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
            >
              {isSubmitting ? 'در حال ذخیره...' : isUpdate ? 'ذخیره تغییرات' : 'ایجاد نوع محصول'}
            </Button>
          </Stack>

          {formError ? <Alert severity="error">{formError}</Alert> : null}




          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Field.Text name="name" label="نام نوع محصول *" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Field.Text
                name="version"
                label="نسخه"
                inputProps={{ inputMode: 'numeric', pattern: '\\d*', dir: 'ltr' }}
                helperText="در صورت خالی بودن مقدار ۱ در نظر گرفته می‌شود"
              />
            </Grid>
          </Grid>

          <Stack gap={1} direction="row" flexWrap="wrap">
            {fields.length === 0 ? (
              <Typography color="text.secondary">هنوز هیچ ویژگی‌ای اضافه نشده است.</Typography>
            ) : null}

            {fields.map((field, index) => {
              const current = attributeValues?.[index];
              const kind = current?.kind ?? 'text';
              const showEnumValues = kind === 'enum' || kind === 'multi-enum';
              const showNumericFields = kind === 'number';
              const showRegex = kind === 'text';
              const showColorValues = kind === 'color';

              return (
                <Orderly
                  key={field.id}
                  buttonProps={{
                    variant: "contained",
                    children: field.label || `ویژگی #${index + 1}`
                  }}>
                  <Box
                  >
                    <Stack spacing={2}>
                      <Stack direction="row" alignItems="center" justifyContent="end">
                        <Button color='error' variant='contained' onClick={() => remove(index)}>
                          حذف
                        </Button>
                      </Stack>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Field.Text name={`attributes.${index}.key`} label="شناسه ویژگی *" inputProps={{ dir: 'ltr' }} />
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                          <Field.Text name={`attributes.${index}.label`} label="برچسب ویژگی *" />
                        </Grid>
                      </Grid>

                      {showEnumValues ? (
                        <Field.Text
                          name={`attributes.${index}.enumValuesText`}
                          label="گزینه‌ها"
                          multiline
                          minRows={3}
                          maxRows={12}
                          helperText="هر گزینه را در یک خط جداگانه وارد کنید"
                        />
                      ) : null}

                      {showNumericFields ? (
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <Field.Text
                              name={`attributes.${index}.min`}
                              label="حداقل"
                              inputProps={{ inputMode: 'decimal', dir: 'ltr' }}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <Field.Text
                              name={`attributes.${index}.max`}
                              label="حداکثر"
                              inputProps={{ inputMode: 'decimal', dir: 'ltr' }}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <Field.Text name={`attributes.${index}.unit`} label="واحد اندازه‌گیری" />
                          </Grid>
                        </Grid>
                      ) : null}

                      {showRegex ? (
                        <Field.Text
                          name={`attributes.${index}.regex`}
                          label="الگوی مجاز (Regex)"
                          helperText="در صورت نیاز، الگوی مجاز برای مقدار را وارد کنید"
                          inputProps={{ dir: 'ltr' }}
                        />
                      ) : null}

                      {showColorValues ? (
                        <ColorValuesEditor control={control} attributeIndex={index} />
                      ) : null}

                      <Divider />

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <Field.Switch name={`attributes.${index}.required`} label="فیلد اجباری" />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <Field.Switch name={`attributes.${index}.variant`} label="مؤلفۀ متغیر" />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <Field.Switch name={`attributes.${index}.filterable`} label="قابل فیلتر" />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <Field.Switch name={`attributes.${index}.searchable`} label="قابل جستجو" />
                        </Grid>
                      </Grid>
                    </Stack>
                  </Box>
                </Orderly>
              );
            })}

            <Button
              variant="outlined"
              id="attribute-add-button"
              aria-controls={open ? 'attribute-add-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={open ? 'true' : undefined}
              onClick={handleClick}>
              افزودن ویژگی
            </Button>
            <Menu
              id="attribute-add-menu"
              aria-labelledby="attribute-add-button"
              anchorEl={anchorEl}
              open={open}
              onClose={handleClose}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
            >
              {ATTRIBUTE_KIND_VALUES.map(x => <MenuItem
                key={x}
                onClick={() => {
                  handleClose();
                  append(createEmptyAttribute(x))
                }}>
                {ATTRIBUTE_KIND_LABEL[x]}
              </MenuItem>)}
            </Menu>
            <Box flex="1 1 auto" />
            <Button
              variant='contained'
              onClick={() => setLLM(true)}
              startIcon={<svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                <path fill="currentColor" d="M10.941 9.753h-.017a18 18 0 0 1-.288 1.04l-.56 1.663h1.719l-.557-1.656c-.127-.373-.212-.714-.297-1.047m9.181 3.773a3.42 3.42 0 0 0-.295-2.984q.255-1.446-.605-1.981q.186-1.617-.528-2.093a1.35 1.35 0 0 0-.683-1.324a1.694 1.694 0 0 0-1.5-1.652q-.435-.972-2.18-1.029q-1.616-1.017-2.595.2q-.045-.318-.625-.446a3.73 3.73 0 0 0-2.5.477a3 3 0 0 1-.407.177q-1.95.891-2.041 1.911a1.67 1.67 0 0 0-.632 1.678a1.26 1.26 0 0 0-.478 1.44a1.53 1.53 0 0 0-.648 1.448a1.53 1.53 0 0 0-.32 1.159a1.54 1.54 0 0 0-.3 1.817a2.62 2.62 0 0 0 .156 1.782a3.82 3.82 0 0 0 1.012 2.742a8 8 0 0 1 .769 1.574a8 8 0 0 0 1.108 1.254q.684 1.248 1.505 1.125a1.47 1.47 0 0 0 1.713.666q1.056.815 1.453-.208q.378-.535.666-.034q.659 1.51 3.044.077a1.69 1.69 0 0 0 1.705-1.055a1.377 1.377 0 0 0 1.176-1.6a2.5 2.5 0 0 0 .372-.536q1.365-.352 1.5-2.258a2.17 2.17 0 0 0 .158-2.327M12.06 2.9q.854-1.116 2.065-.061l.037-.013q1.309-.452 2.179 1.038q1.023.143 1.4 1.506a.98.98 0 0 1 .519 1.159l.251.311a2.52 2.52 0 0 1 .371 1.894v.013a1.08 1.08 0 0 0-1 .294l-.278-.441a1.23 1.23 0 0 0-.891-.281V8.15a2.65 2.65 0 0 0-1.718-2.48a1 1 0 0 1 .735-.158q-.222-.026-.329-.484a.4.4 0 0 1-.173-.5q-.659-1.132-.709-.5a1.02 1.02 0 0 1 .156.674q.558.33.45.519l-.482.348a2.7 2.7 0 0 0-.574-.063h-.71q-.024-.03-.051-.06q-.9-.774-.761-1.194q-.069-.754.917-.951q.531-.165-.1-.26q-1.248.236-1.159 1.367l-.5.069A2.06 2.06 0 0 1 12.06 2.9m2.435 7.117a.445.445 0 0 1-.449-.46a.456.456 0 0 1 .466-.469a.465.465 0 1 1-.017.929m.39.7v4.127h-.746v-4.128Zm-2.047-5.326a.2.2 0 0 0-.059.112h-.925a9 9 0 0 0-.175-.908l.484-.069q-.145.645.675.865M7.125 3.862l.209.021q.02-.12.424-.423l.069.077L7.368 4H7.02Zm-.243.316c.155-.006.406-.012.763-.018q.037 0 .934-.882h.294a.2.2 0 1 1 0 .138h-.285l-.874.891l-.935.014Zm-.245.354h1.5l.45-.42l.274.007a.245.245 0 1 1 0 .113h-.255l-.433.441l-1.612-.019q.036-.06.076-.122m-.221.337l2.672-.008L10.795 3.2h.712l-.03.147h-.648L9.148 4.991l-2.8-.026Zm4.6.492h.483v.127l-.435-.006l-.019.019h-.18Zm-.281-.351l-.514.493h-.173l.657-.629h.709v.13Zm-4.619.352l3.257-.006l.05-.045q.09-.093 1-.909l.995.008v.116h-.993L9.377 5.5l-3.315-.02c.016-.037.033-.08.054-.118m-.174.487l2.873-.007a3 3 0 0 0-.226.143l-2.675-.006a2 2 0 0 1 .028-.13m-.424 1.268a6 6 0 0 1 .607-.666h-.239v-.132l2.327-.012a2 2 0 0 0-.117.128l-1.794.015l-.724.732l.026 1.875q.077.068.839.763v.233l.675.632l.009.934l.338.336v.15l-.438-.434l-.017-.971l-.675-.623v-.24l-.84-.752Zm1.467 10.03v-.173h.126v.173Zm.126.057v.376h-.124v-.38Zm-.137-2.626v-.164h.144v.164Zm-.826-2.312v-.553l-.4-.414a.2.2 0 0 1-.1.031a.131.131 0 1 1 .158-.128a.1.1 0 0 1-.008.042l.412.4v.562c.687.681 1.1 1.093 1.26 1.252v.811h-.084l.008-.291h.04l.012-.427Zm.75 2.148v.164h-.162v-.164Zm-.161-.141v-.291h.158v.291Zm-.052.141v.164h-.164v-.164Zm-.223.164H6.32v-.164h.141Zm-.2-.6v.291h-.2v-.291h.086a2 2 0 0 0 .032-.3a.143.143 0 0 1-.2-.133a.144.144 0 1 1 .287 0a.15.15 0 0 1-.047.107a6 6 0 0 0-.021.33Zm-.362.881v.149h-.157v-.149h.091a.9.9 0 0 1 .227-.319v-.13h.2v.164h-.153a1 1 0 0 0-.213.285Zm-.156 1.446v-.175h.151v.177Zm.156.058v.159h-.157v-.158Zm-.156-.291v-.15h.151v.151Zm0-.208v-.141h.151v.142Zm0-.2v-.158h.151v.159Zm0-.216V15.3h.151v.151Zm0-.207v-.171h.151v.176Zm1.076-5.237v-.376a1.54 1.54 0 0 1-.825-.698l.1-.024a1.5 1.5 0 0 0 .131.187h.226v.09h-.146a1.4 1.4 0 0 0 .3.236l.006-.238h-.117V9.09h.48v.089h-.234v.308a1.4 1.4 0 0 0 .506.128v-.44h-.219v-.09h.447v.088h-.089v.443l.083-.005v1.53l-.019-1.123h-.134v-.266h-.13v.266H7.05v.214l.281.309c.017.58.039.926.039.926l.1.1v.125q-.197-.21-.205-.2a3.2 3.2 0 0 0-.043-.935a3 3 0 0 1-.269-.311v-.233Zm.275-1.79a.129.129 0 1 0 0 .254h.03l.077.083a.3.3 0 0 1-.107.019a.23.23 0 1 1 0-.458a.25.25 0 0 1 .244.175h.127v.1h-.125a.23.23 0 0 1-.1.141l-.077-.073a.13.13 0 0 0 .076-.111a.14.14 0 0 0-.145-.13m-.757-.2h-.075c-.178 0-.3.005-.356.01c0 .052-.008.1-.008.158a1.4 1.4 0 0 0 .089.5c.69-.008 1.2-.009 1.453-.009a.2.2 0 0 1 .024-.083v.21l-.013-.031c-.755 0-1.269.012-1.421.016q.02.042.042.083l-.1.028a1.5 1.5 0 0 1-.178-.715a1.538 1.538 0 0 1 2.078-1.443a2.63 2.63 0 0 0-.405 1.274q-.732-.003-1.131.001Zm1.189 8.961v.173h-.148v-.173Zm0 .231v.375h-.149V17.2Zm-.142-2.628v-.164h.08v.164Zm-.052-.164v.164h-.164v-.164Zm-.17 2.79h.164v.375h-.04c.049.115.1.3.143.375h.536l.058.077q-.234-.01-.617-.012a1.5 1.5 0 0 1-.162-.436h-.083ZM4.781 9.009l.679.722v.411c.162.172.265.282.32.348l.08.1c.16.006.42.007.42.007a2.6 2.6 0 0 1 .377.441c.02.612.024.87.024.87q.426.439.78.8v.109c-.57-.571-.868-.865-.868-.865c-.023-.605-.017-.893-.017-.893a6 6 0 0 0-.335-.385a4 4 0 0 1-.418 0l-.011-.01l-.09-.092a6 6 0 0 1-.233-.252l-.146-.153l.009-.394l-.623-.618Zm.875 7.747h-.354v-.171h.354Zm0-.447h-.354v-.174h.354Zm0-.441h-.354v-.082a3 3 0 0 1-.227-.034a.089.089 0 1 1-.087-.107a.09.09 0 0 1 .086.069q.07.015.228.038v-.022h.354Zm0-.415h-.354v-.087c-.1-.017-.165-.028-.21-.037a.1.1 0 1 1 .008-.041l.2.033V15.3h.354Zm0-.441h-.354v-.149h.354Zm-.044-.639l-.1-.057h-.359l-.307.354a2.7 2.7 0 0 0-.549 0l-.013-.584l.06-.06a.94.94 0 0 1-.3-.736q-.042-.774.113-.938q.058-.05-.083-.4a1 1 0 0 1 .07-.882a.7.7 0 0 1 .315-.437h.007v-.007a.53.53 0 0 1 .029-.65l.346.2l-.009 1.436l.839.8l-.576-.012a.28.28 0 0 0-.307-.238a.246.246 0 1 0 0 .476a.3.3 0 0 0 .3-.182l.593.011l-.008.584h-.332a.245.245 0 0 0-.245-.162a.211.211 0 1 0 0 .415a.24.24 0 0 0 .249-.179h.34q-.013.645-.012.649l-.334-.009a.27.27 0 0 0-.269-.171a.23.23 0 1 0 .277.227l.334.009v.333l.311.311l-.112.117Zm.9 3.483a.11.11 0 0 1 .092-.109v-.167h-.083v-.331l-.053-.015v.346h-.162v-.377h.069a1 1 0 0 1-.137-.065v.009h-.182v-.138a1 1 0 0 1-.214-.253h-.1v-.172h.153v.163a2 2 0 0 0 .223.227h.119v.094l.067.046v-.14h.159v.173h-.101q.05.03.1.056l.053.025V17.2h.157v.377h-.026v.17a.11.11 0 1 1-.14.106Zm.9 1.929v-.943H6.83a.2.2 0 0 1-.184-.182v-.212c.008-.135.066-.2.173-.181h.746a.45.45 0 0 1 .136.155a2 2 0 0 0 .323 0l.108-.1l.152-.006a2.7 2.7 0 0 0 .53.393h-.245a.157.157 0 0 1-.173.121v.426h-.11l.007-.428q-.216-.027-.234-.186h-.437a.24.24 0 0 0-.1-.27h-.675q-.11-.017-.112.115v.151a.22.22 0 0 0 .24.1a3.3 3.3 0 0 0 .549-.037c.009.585.007.93.007.93l.354-.009v-.938l.13-.018v.956l.26.009v-.273h.12v.284h.29v-.138l.39.009l-.013.44l-.377-.008v-.165Zm1.5 1.239a.238.238 0 1 1 0-.476a.23.23 0 0 1 .156.059l-.071.073a.136.136 0 1 0 .051.106a.13.13 0 0 0-.015-.062l.078-.069a.238.238 0 0 1-.2.369Zm1.413.346q.11-.212-.173-.191q.002.04-.026-.1q.401-.061.355.311Zm1-.2l-1.1-1.05a.2.2 0 0 1-.058.007a.2.2 0 0 1-.111-.031l.063-.082a.11.11 0 1 0-.061-.1a.1.1 0 0 0 .024.068l-.067.078a.2.2 0 0 1-.059-.146a.212.212 0 1 1 .423 0a.2.2 0 0 1-.035.116l1.07 1.054Zm.147-.342a.216.216 0 0 1-.216-.216a.2.2 0 0 1 .04-.125q-.27-.29-1.455-1.449q.08.009.163.012l1.354 1.378a.2.2 0 0 1 .114-.032a.216.216 0 0 1 0 .432m.379-.614l-.233.008l.008-.588h.329a5 5 0 0 1-.116.577Zm.111-7.176H9.924l-.594 1.808h-.763L10.509 9.1h.89l1.95 5.746h-.789Zm6.472 4.834a.8.8 0 0 1-.485-.917q.114-1-.813-.8q1.048 1.139-.519 1.505q.4.4.986-.311a2.1 2.1 0 0 0 .476.821l-.294.415a1.02 1.02 0 0 1-.969 1.229q-.116.151.017-.139q-.094-.632-.657-.622a.83.83 0 0 1-.9.017q-.617-.262-.743.277a2.1 2.1 0 0 1-1.315.813a1.16 1.16 0 0 0 1.47-.485q-.273-.738.865-.086q1.095-.373 1.107.484a1.89 1.89 0 0 1-1.487.865q-.3.617-1.973.658a1.214 1.214 0 0 1-1.141-1.367a1.14 1.14 0 0 0-.015-1.18h2.034a2.646 2.646 0 0 0 2.645-2.559l.024-.032l-.024-.006v-1.905a1.16 1.16 0 0 0 .515-.346a.95.95 0 0 1 .692-.069q.481 1.307-.64 1.211q.417.441.744-.052a1.66 1.66 0 0 1 1.609.467a3 3 0 0 1-1.221 2.111Zm1.314-2.336a1.41 1.41 0 0 0-1.487-.519q.426-.294.069-.917q-.617-.242-.727-.553a1.88 1.88 0 0 0 .139-1.488q.276.1.346-.1q-.21-.265-.485.052a2.3 2.3 0 0 1-.346 1.643a2.2 2.2 0 0 1-.532.584v-3.585a1.44 1.44 0 0 1 1.055.239a.92.92 0 0 0-.934-.38l.087-.415q-.103.114-.208.22V9.145a1.4 1.4 0 0 0 .29-.48l.554.017q.106 0 .311.45c.988-.859.583.374 1.052-.215l-.043-.117q.043.02.085.043l.021-.022v-.009q.214.009.323.424a2.94 2.94 0 0 1 .138 1.557q.726.63 0 1.194l.415.086a3.3 3.3 0 0 1-.121 1.557a2.02 2.02 0 0 1-.014 1.903Z"></path>
              </svg>}>
              هوش مصنوعی
            </Button>
          </Stack>
        </Stack>


        <AIProductTypeChatDialog
          title='ذخیره نوع محصول با هوش مصنوعی'
          open={llm}
          onClose={() => setLLM(false)}
          append={append}
          remove={remove}
          createEmptyAttribute={() => append(createEmptyAttribute())}
          schema={productTypeSchema}
          productTypesData={productTypesData}
        />


      </Form>
    </Container>
  );
}

function ColorValuesEditor({ control, attributeIndex }: ColorValuesEditorProps): JSX.Element {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `attributes.${attributeIndex}.colorValues` as const,
  });

  return (
    <Stack gap={1} direction="row" flexWrap="wrap">
      {fields.length === 0 ? (
        <Typography color="text.secondary">برای این ویژگی هنوز رنگی تعریف نشده است.</Typography>
      ) : null}

      {fields.map((field, colorIndex) => (
        <Orderly
          key={field.id}
          buttonProps={{
            variant: "contained",
            children: field.rtlName || field.name || field.key || `رنگ ${colorIndex + 1}`,
            startIcon: <ColorIcon swatches={field.swatches.map(x => x.value)} />
          }}
        >
          <ColorValueItem
            control={control}
            attributeIndex={attributeIndex}
            colorIndex={colorIndex}
            onRemove={() => remove(colorIndex)}
            canRemove={fields.length > 1}
          />
        </Orderly>
      ))}

      <Button
        type="button"
        variant="outlined"
        onClick={() => append(createEmptyColorValue())}
        startIcon={
          <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 5c.414 0 .75.336.75.75V11.25H18c.414 0 .75.336.75.75s-.336.75-.75.75h-5.25V18c0 .414-.336.75-.75.75s-.75-.336-.75-.75v-5.25H6c-.414 0-.75-.336-.75-.75s.336-.75.75-.75h5.25V5.75c0-.414.336-.75.75-.75"
            />
          </svg>
        }
      >
        افزودن رنگ جدید
      </Button>
    </Stack>
  );
}

function ColorValueItem({ control, attributeIndex, colorIndex, onRemove, canRemove }: ColorValueItemProps): JSX.Element {
  const swatchName = `attributes.${attributeIndex}.colorValues.${colorIndex}.swatches` as const;
  const { fields: swatchFields, append, remove } = useFieldArray({ control, name: swatchName });

  const swatchLimitReached = swatchFields.length >= 6;

  return (
    <Box
    >
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography fontWeight={600}>رنگ #{colorIndex + 1}</Typography>
          <Stack direction="row">
            <Field.Switch
              name={`attributes.${attributeIndex}.colorValues.${colorIndex}.active`}
              label="فعال"
            />
            <Button color='error' variant='contained' aria-label="remove color" onClick={onRemove} disabled={!canRemove}>
              حذف
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Field.Text
              name={`attributes.${attributeIndex}.colorValues.${colorIndex}.key`}
              label="شناسه رنگ *"
              inputProps={{ dir: 'ltr' }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Field.Text name={`attributes.${attributeIndex}.colorValues.${colorIndex}.name`} label="نام نمایش" />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Field.Select
              name={`attributes.${attributeIndex}.colorValues.${colorIndex}.family`}
              label="خانواده رنگ"
            >
              {COLOR_FAMILY_OPTIONS.map((option) => (
                <MenuItem key={option.value || 'unset'} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Field.Select>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Field.Text
              name={`attributes.${attributeIndex}.colorValues.${colorIndex}.rtlName`}
              label="نام جایگزین (RTL)"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>

          </Grid>
        </Grid>

        <Field.Text
          name={`attributes.${attributeIndex}.colorValues.${colorIndex}.aliases`}
          label="نام‌های مستعار"
          multiline
          minRows={2}
          helperText="هر نام را در خط جداگانه وارد کنید"
        />

        <Stack spacing={1}>
          <Typography variant="subtitle2">کدهای رنگ</Typography>
          <Stack spacing={1}>
            {swatchFields.map((swatch, swatchIndex) => (
              <Stack key={swatch.id} direction="row" spacing={1} alignItems="center">
                <Field.Text
                  name={`attributes.${attributeIndex}.colorValues.${colorIndex}.swatches.${swatchIndex}.value`}
                  label={`کد ${swatchIndex + 1}`}
                  inputProps={{ dir: 'ltr', placeholder: '#FFFFFF' }}
                  type='color'
                />
                <IconButton
                  aria-label="remove swatch"
                  onClick={() => remove(swatchIndex)}
                  disabled={swatchFields.length <= 1}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M6 6h12v2H6zm1 4h10l-.7 9.1A1 1 0 0 1 15.305 20h-6.61a1 1 0 0 1-.995-.9zM10 4h4v2h-4z"
                    />
                  </svg>
                </IconButton>
              </Stack>
            ))}
          </Stack>

          <Button
            type="button"
            variant="text"
            onClick={() => append({ value: '#FFFFFF' })}
            disabled={swatchLimitReached}
            sx={{ alignSelf: 'flex-start' }}
          >
            افزودن کد رنگ
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function ProductTypeSaveView(): JSX.Element {
  const searchParams = useSearchParams();
  const id = (searchParams?.get('id') ?? '').trim();
  const hasId = id.length > 0;

  const {
    data,
    error,
    isLoading,
  } = useSWR<ProductTypeApiResponse>(hasId ? `/api/catalog/product-types/${id}` : null, (url) => fetcher<ProductTypeApiResponse>(url), {
    revalidateOnFocus: false,
  });


  const {
    data: productTypesData,
    isLoading: productTypesLoading,
  } = useSWR<any>('/api/catalog/product-types', (url) => fetcher<any>(url), {
    revalidateOnFocus: false,
    keepPreviousData: true,
    revalidateIfStale: true
  });

  const defaultValues = useMemo(() => normalizeProductTypeResponse(data?.productType ?? null), [data]);

  if (isLoading && hasId && !data) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (productTypesLoading) {
    return (
      <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="error">{error.message}</Alert>
      </Box>
    );
  }

  return <ProductTypeSaveForm defaultValues={defaultValues} productTypesData={productTypesData} />;
}
