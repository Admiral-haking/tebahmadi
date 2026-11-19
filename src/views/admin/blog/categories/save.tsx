'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { Form, Field } from '@/components/hook-form';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const slugRegex = /^[a-z0-9]+(?:[a-z0-9-\/]*[a-z0-9])?$/;

export interface BlogCategoryOption {
  id: string;
  name: string;
  path: string;
  depth: number;
}

export interface BlogCategorySeoDTO {
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  noindex?: boolean | null;
  ogImageId?: string | null;
  jsonLd?: unknown;
}

export interface BlogCategoryDTO {
  id?: string;
  name: string;
  slug: string;
  parentId?: string | null;
  position?: number | null;
  isActive: boolean;
  seo?: BlogCategorySeoDTO | null;
}

interface BlogCategorySaveProps {
  defaultValues?: BlogCategoryDTO | null;
  categories: BlogCategoryOption[];
  excludedParentIds: string[];
}

const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'نام دسته الزامی است')
    .max(200, 'حداکثر ۲۰۰ کاراکتر'),
  slug: z
    .string()
    .trim()
    .min(1, 'اسلاگ دسته را وارد کنید')
    .regex(slugRegex, 'اسلاگ باید با حروف کوچک انگلیسی، اعداد و خط‌تیره ساخته شود'),
  parentId: z
    .string()
    .trim()
    .regex(objectIdRegex, 'شناسه نامعتبر است')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  position: z
    .number({ error: 'مقدار نامعتبر است' })
    .int('باید عدد صحیح باشد')
    .nonnegative('نمی‌تواند منفی باشد')
    .optional(),
  isActive: z.boolean().default(true),
  seoTitle: z.string().trim().max(160, 'حداکثر ۱۶۰ کاراکتر').optional().default(''),
  seoDescription: z.string().trim().max(320, 'حداکثر ۳۲۰ کاراکتر').optional().default(''),
  canonical: z
    .string()
    .trim()
    .url('آدرس canonical معتبر نیست')
    .optional()
    .or(z.literal('')),
  noindex: z.boolean().default(false),
  ogImageId: z
    .string()
    .trim()
    .regex(objectIdRegex, 'شناسه تصویر باید ۲۴ کاراکتر هگز باشد')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  jsonLd: z.string().optional(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

function slugify(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s/-]+/g, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : `category-${Date.now().toString(36)}`;
}

function formatJson(value: unknown): string {
  if (!value) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function parseJson(value?: string): unknown | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error('ساختار JSON-LD معتبر نیست');
  }
}

function normalizeParentId(value: string | null | undefined): string | null {
  if (!value || value.trim().length === 0) return null;
  return value.trim();
}

function trimmed(value?: string | null): string | undefined {
  if (value == null) return undefined;
  const next = value.trim();
  return next.length > 0 ? next : undefined;
}

function buildDefaultValues(dto?: BlogCategoryDTO | null): CategoryFormValues {
  return {
    name: dto?.name ?? '',
    slug: dto?.slug ?? '',
    parentId: dto?.parentId ?? '',
    position: dto?.position ?? undefined,
    isActive: dto?.isActive ?? true,
    seoTitle: dto?.seo?.title ?? '',
    seoDescription: dto?.seo?.description ?? '',
    canonical: dto?.seo?.canonical ?? '',
    noindex: dto?.seo?.noindex ?? false,
    ogImageId: dto?.seo?.ogImageId ?? '',
    jsonLd: formatJson(dto?.seo?.jsonLd),
  };
}

export default function BlogCategorySave({
  defaultValues = null,
  categories,
  excludedParentIds,
}: BlogCategorySaveProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const methods = useForm<any>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: buildDefaultValues(defaultValues),
  });

  const {
    handleSubmit,
    watch,
    formState: { isSubmitting },
    setValue,
  } = methods;

  const nameValue = watch('name');
  const isEditing = useMemo(() => Boolean(defaultValues?.id), [defaultValues?.id]);

  const filteredParentOptions = useMemo(() => {
    if (!excludedParentIds.length) return categories;
    const blocked = new Set(excludedParentIds);
    return categories.filter((item) => !blocked.has(item.id));
  }, [categories, excludedParentIds]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    let jsonLd: unknown;

    try {
      jsonLd = parseJson(values.jsonLd);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ساختار JSON-LD معتبر نیست';
      setFormError(message);
      return;
    }

    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      slug: values.slug.trim().toLowerCase(),
      parentId: normalizeParentId(values.parentId ?? null),
      isActive: values.isActive,
    };

    if (typeof values.position === 'number') {
      payload.position = values.position;
    }

    const seo: Record<string, unknown> = {};
    const title = trimmed(values.seoTitle);
    if (title !== undefined) {
      seo.title = title;
    }
    const description = trimmed(values.seoDescription);
    if (description !== undefined) {
      seo.description = description;
    }
    const canonical = trimmed(values.canonical);
    if (canonical !== undefined) {
      seo.canonical = canonical;
    }
    if (typeof values.noindex === 'boolean') {
      seo.noindex = values.noindex;
    }
    const ogImageId = trimmed(values.ogImageId);
    if (ogImageId) {
      seo.ogImageId = ogImageId;
    }
    if (jsonLd !== undefined) {
      seo.jsonLd = jsonLd;
    }

    if (Object.keys(seo).length > 0) {
      payload.seo = seo;
    }

    const url = isEditing ? `/api/blog/categories/${defaultValues?.id}` : '/api/blog/categories';
    const method = isEditing ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 409) {
          setFormError('این اسلاگ قبلاً استفاده شده است.');
          return;
        }
        const message = (await response.text().catch(() => '')) || response.statusText;
        throw new Error(message || 'ذخیره دسته با خطا مواجه شد.');
      }

      toast.success('دسته وبلاگ با موفقیت ذخیره شد.');
      router.push('/admin/blog/categories');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ذخیره دسته با خطا مواجه شد.';
      setFormError(message);
    }
  });

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h4" fontWeight={800}>
            {isEditing ? `ویرایش دسته «${defaultValues?.name ?? ''}»` : 'افزودن دسته جدید'}
          </Typography>
          <Typography variant="body2" color="text.secondary" maxWidth={640}>
            ساختار دسته‌بندی منظم به کاربران و موتورهای جستجو کمک می‌کند محتوای وبلاگ را سریع‌تر پیدا کنند. با
            تعیین والد، اسلاگ مناسب و اطلاعات سئو، مسیر دسترسی به موضوعات را بهینه کنید.
          </Typography>
        </Stack>

        {formError && (
          <Alert severity="error" onClose={() => setFormError(null)}>
            {formError}
          </Alert>
        )}

        <Form methods={methods} onSubmit={onSubmit}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={3}>
                <Card variant="outlined" sx={{ borderRadius: 4 }}>
                  <CardHeader
                    title="اطلاعات پایه"
                    subheader="نام، اسلاگ و موقعیت دسته را مشخص کنید. اسلاگ در مسیر URL استفاده خواهد شد."
                  />
                  <CardContent>
                    <Stack spacing={2.5}>
                      <Field.Text name="name" label="عنوان دسته *" />
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
                      >
                        <Field.Text name="slug" label="اسلاگ *" helperText="از حروف کوچک انگلیسی، اعداد و - استفاده کنید." />
                        <IconButton
                          aria-label="ساخت اسلاگ"
                          onClick={() => setValue('slug', slugify(nameValue ?? ''), { shouldDirty: true, shouldValidate: true })}
                          sx={{
                            alignSelf: 'flex-end',
                            mb: { sm: 0.5 },
                            bgcolor: "var(--mui-palette-background-default)",
                            border: 1,
                            borderColor: 'divider',
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24">
                            <path
                              fill="currentColor"
                              d="M12 2a7 7 0 0 1 7 7a7 7 0 0 1-1.2 3.95l4.125 4.124l-1.414 1.415l-4.125-4.125A7 7 0 1 1 12 2m0 2a5 5 0 1 0 0 10a5 5 0 0 0 0-10"
                            ></path>
                          </svg>
                        </IconButton>
                      </Stack>
                      <Field.Select name="parentId" label="دسته والد">
                        <MenuItem value="">بدون والد (سطح اول)</MenuItem>
                        {filteredParentOptions.map((option) => (
                          <MenuItem key={option.id} value={option.id}>
                            {'—'.repeat(option.depth)} {option.name}
                          </MenuItem>
                        ))}
                      </Field.Select>
                      <Field.Text
                        name="position"
                        label="اولویت نمایش"
                        type="number"
                        helperText="اعداد کوچکتر در ابتدا نمایش داده می‌شوند."
                      />
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderRadius: 4 }}>
                  <CardHeader title="تنظیمات سئو" subheader="متا دیتا و تصویر پیش‌نمایش شبکه‌های اجتماعی را تنظیم کنید." />
                  <CardContent>
                    <Stack spacing={2.5}>
                      <Field.Text name="seoTitle" label="عنوان سئو" helperText="حداکثر ۱۶۰ کاراکتر" />
                      <Field.Text
                        name="seoDescription"
                        label="توضیحات متا"
                        multiline
                        minRows={3}
                        helperText="حداکثر ۳۲۰ کاراکتر؛ در نتیجه‌های جستجو نمایش داده می‌شود."
                      />
                      <Field.Text
                        name="canonical"
                        label="آدرس canonical"
                        helperText="در صورت وجود آدرس مرجع، آن را وارد کنید."
                      />
                      <Field.Switch name="noindex" label="عدم ایندکس توسط موتورهای جستجو (noindex)" />
                      <Field.UploadImage
                        name="ogImageId"
                        label="تصویر OpenGraph"
                        helperText="شناسه تصویر موجود در گالری رسانه (اختیاری)"
                      />
                      <Field.Text
                        name="jsonLd"
                        label="اسکیما (JSON-LD)"
                        multiline
                        minRows={6}
                        helperText="ساختار JSON-LD معتبر را وارد کنید."
                      />
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={3}>
                <Card variant="outlined" sx={{ borderRadius: 4 }}>
                  <CardHeader title="وضعیت نمایش" subheader="فعال بودن دسته، نمایش آن را در وبلاگ مشخص می‌کند." />
                  <CardContent>
                    <Field.Switch name="isActive" label="دسته فعال باشد" />
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderRadius: 4 }}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={isSubmitting}
                        sx={{ borderRadius: 3, py: 1.25 }}
                        startIcon={
                          isSubmitting ? <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} /> : null
                        }
                      >
                        {isEditing ? 'ذخیره تغییرات' : 'ایجاد دسته'}
                      </Button>
                      <Button
                        type="button"
                        variant="outlined"
                        color="inherit"
                        onClick={() => router.push('/admin/blog/categories')}
                        sx={{ borderRadius: 3 }}
                      >
                        انصراف
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>
          </Grid>
        </Form>
      </Stack>
    </Box>
  );
}
