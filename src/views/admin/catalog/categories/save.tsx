'use client';

import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Grid,
  Stack,
  Typography,
  MenuItem,
  Container,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';

import type { CategorySchema } from '@/catalog/models/Category';
import { slugSchema } from '@/catalog/validation/sharedSchemas';
import { Form, Field } from '@/components/hook-form';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export type CategoryDTO = Pick<
  CategorySchema,
  'name' | 'slug' | 'position' | 'isActive' | 'seoTitle' | 'seoDescription'
> & {
  id?: string;
  parentId?: string | null;
  imageId?: string | null;
  mediaId?: string | null;
  productTypeId?: string | null;
};

export type CategoryOption = {
  id: string;
  name: string;
  path: string;
  depth: number;
};

export type ProductTypeOption = {
  id: string;
  name: string;
};

type CategoryFormValues = {
  name: string;
  slug: string;
  parentId: string | '' | null;
  position?: number;
  isActive: boolean;
  seoTitle: string;
  seoDescription: string;
  imageId?: string | null;
  mediaId: string | '' | null;
  productTypeId: string | '' | null;
};

interface CategorySaveProps {
  defaultValues?: CategoryDTO | null;
  categories: CategoryOption[];
  excludedParentIds?: string[];
  productTypes: ProductTypeOption[];
}

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'نام دسته‌بندی الزامی است').max(200, 'حداکثر ۲۰۰ کاراکتر'),
  slug: slugSchema,
  parentId: z
    .string()
    .min(1)
    .regex(objectIdRegex, 'شناسه نامعتبر است')
    .or(z.literal(''))
    .or(z.null())
    .optional()
    .default(''),
  position: z
    .number({ error: 'مقدار نامعتبر است' })
    .int('باید عدد صحیح باشد')
    .nonnegative('نمی‌تواند منفی باشد')
    .optional(),
  isActive: z.boolean().default(true),
  seoTitle: z.string().trim().max(200, 'حداکثر ۲۰۰ کاراکتر').optional().default(''),
  seoDescription: z.string().trim().max(500, 'حداکثر ۵۰۰ کاراکتر').optional().default(''),
  imageId: z
    .string()
    .trim()
    .regex(objectIdRegex, 'شناسه تصویر نامعتبر است')
    .optional()
    .or(z.literal(''))
    .or(z.null())
    .optional(),
  mediaId: z
    .string()
    .trim()
    .regex(objectIdRegex, 'شناسه رسانه نامعتبر است')
    .optional()
    .or(z.literal(''))
    .or(z.null())
    .optional()
    .default(''),
  productTypeId: z
    .string()
    .trim()
    .min(1, 'شناسه نامعتبر است')
    .regex(objectIdRegex, 'شناسه نامعتبر است')
    .or(z.literal(''))
    .or(z.null())
    .optional()
    .default(''),
}).superRefine((values, ctx) => {
  const isRoot = !values.parentId || `${values.parentId}`.trim().length === 0;
  const hasProductType = !!(values.productTypeId && `${values.productTypeId}`.trim().length > 0);
  if (isRoot && !hasProductType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['productTypeId'],
      message: 'انتخاب نوع محصول برای دسته‌بندی ریشه الزامی است',
    });
  }
});

function buildDefaultValues(category?: Partial<CategoryDTO> | null): CategoryFormValues {
  return {
    name: category?.name ?? '',
    slug: category?.slug ?? '',
    parentId: category?.parentId ?? '',
    position: category?.position ?? undefined,
    isActive: category?.isActive ?? true,
    seoTitle: category?.seoTitle ?? '',
    seoDescription: category?.seoDescription ?? '',
    imageId: category?.imageId ?? null,
    mediaId: category?.mediaId ?? '',
    productTypeId: category?.productTypeId ?? '',
  };
}

function normalizeParentId(value: string | '' | null | undefined): string | null {
  if (!value || value.toString().trim().length === 0) return null;
  return value;
}

function normalizeProductTypeId(value: string | '' | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.toString().trim();
  if (!trimmed) {
    return null;
  }
  return trimmed;
}

function trimmed(value?: string | null): string | undefined {
  if (value == null) return undefined;
  const next = value.trim();
  return next.length > 0 ? next : undefined;
}

export default function CategorySave({
  defaultValues = null,
  categories,
  excludedParentIds = [],
  productTypes,
}: CategorySaveProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const parentId = searchParams?.get("parentId");

  const filteredParentOptions = useMemo(() => {
    if (!excludedParentIds.length) return categories;
    const excluded = new Set(excludedParentIds);
    return categories.filter((category) => !excluded.has(category.id));
  }, [categories, excludedParentIds]);

  const methods = useForm<any>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: buildDefaultValues(defaultValues ?? { parentId }),
  });

  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    reset(buildDefaultValues(defaultValues ?? undefined));
    setFormError(null);
  }, [defaultValues, reset]);

  const isEditing = Boolean(defaultValues?.id);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const parentId = normalizeParentId(values.parentId);
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      slug: values.slug.trim(),
      parentId,
      isActive: values.isActive,
    };

    if (values.position != null) {
      payload.position = values.position;
    }

    const seoTitle = trimmed(values.seoTitle);
    if (seoTitle !== undefined) {
      payload.seoTitle = seoTitle;
    }

    const seoDescription = trimmed(values.seoDescription);
    if (seoDescription !== undefined) {
      payload.seoDescription = seoDescription;
    }

    if (typeof values.imageId === 'string') {
      const imageId = trimmed(values.imageId);
      if (imageId) {
        payload.imageId = imageId;
      }
    }

    if (values.mediaId === null) {
      payload.mediaId = null;
    } else if (typeof values.mediaId === 'string') {
      const mediaId = trimmed(values.mediaId);
      if (mediaId) {
        payload.mediaId = mediaId;
      } else if (values.mediaId === '') {
        payload.mediaId = null;
      }
    }

    const productTypeId = normalizeProductTypeId(values.productTypeId);
    if (productTypeId !== undefined) {
      payload.productTypeId = productTypeId;
    }

    const url = isEditing ? `/api/catalog/categories/${defaultValues?.id}` : '/api/catalog/categories';
    const method = isEditing ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text().catch(() => '');
        throw new Error(message || 'ذخیره دسته‌بندی با خطا مواجه شد');
      }

      toast.success('دسته‌بندی با موفقیت ذخیره شد');
      router.push('/admin/catalog/categories');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ذخیره دسته‌بندی با خطا مواجه شد';
      setFormError(message);
    }
  });

  useEffect(() => {
    methods.setValue("parentId", parentId)
  }, [parentId])

  return (
    <Container maxWidth="lg">

      <Form methods={methods} onSubmit={onSubmit}>
        <Box sx={{ py: 4 }}>
          <Stack gap={3}>
            <Stack direction="row" gap={1}>
              <Typography variant="h4">{isEditing ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید'}</Typography>
              <Box flex="1 1 auto" />
              <Field.Switch name="isActive" label="فعال" />
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
              >
                ذخیره دسته‌بندی
              </Button>
            </Stack>
            {formError && <Alert severity="error">{formError}</Alert>}

            <Stack gap={3}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field.Text name="name" label="نام" required fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Field.Text
                    name="slug"
                    label="شناسه یکتا"
                    helperText="برای استفاده در URL"
                    required
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Field.Select
                    name="productTypeId"
                    label="نوع محصول مرتبط"
                    fullWidth
                    helperText="اگر مقداری انتخاب نشود، نوع محصول از والد ارث‌بری می‌شود."
                  >
                    <MenuItem value="">ارث‌بری از والد</MenuItem>
                    {productTypes.map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        {type.name}
                      </MenuItem>
                    ))}
                  </Field.Select>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Field.Text name="position" label="ترتیب نمایش" type="number" fullWidth />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Field.Select name="parentId" label="والد" fullWidth>
                    <MenuItem value="">بدون والد</MenuItem>
                    {filteredParentOptions.map((option) => (
                      <MenuItem key={option.id} value={option.id} sx={{ pl: option.depth * 2 }}>
                        {option.name}
                      </MenuItem>
                    ))}
                  </Field.Select>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Field.Text name="seoTitle" label="عنوان سئو" fullWidth />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Field.Text
                    name="seoDescription"
                    label="توضیح سئو"
                    multiline
                    minRows={3}
                    fullWidth
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Field.UploadImage
                    name="imageId"
                    label="تصویر دسته‌بندی"
                    helperText="در صورت نیاز تصویر مناسبی برای این دسته‌بندی بارگذاری کنید"
                  />
                </Grid>


                <Grid size={{ xs: 12, md: 6 }}>
                  <Field.UploadImage
                    name="mediaId"
                    label="آیکون دسته‌بندی"
                    helperText="یک تصویر آیکونی برای نمایش در بخش‌های مختلف انتخاب کنید"
                  />
                </Grid>
              </Grid>
            </Stack>
          </Stack>
        </Box>

      </Form>
    </Container>
  );
}
