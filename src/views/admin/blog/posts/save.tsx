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
  Divider,
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

type BlogPostStatus = 'draft' | 'published' | 'archived';

const STATUS_OPTIONS: Array<{ value: BlogPostStatus; label: string; description: string }> = [
  { value: 'draft', label: 'پیش‌نویس', description: 'مقاله برای ادامه ویرایش محفوظ می‌ماند و منتشر نخواهد شد.' },
  { value: 'published', label: 'منتشر شده', description: 'مقاله در وبلاگ نمایش داده می‌شود.' },
  { value: 'archived', label: 'آرشیوشده', description: 'برای استناد داخلی نگهداری می‌شود و در وب‌سایت نمایش داده نمی‌شود.' },
];

export interface BlogCategoryOption {
  id: string;
  name: string;
  path: string;
  depth: number;
}

export interface BlogPostSeoDTO {
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  noindex?: boolean | null;
  ogImageId?: string | null;
  jsonLd?: unknown;
}

export interface BlogPostDTO {
  id?: string;
  title: string;
  slug: string;
  status: BlogPostStatus;
  excerpt?: string | null;
  content: string;
  coverImageId?: string | null;
  categories?: string[];
  tags?: string[];
  authorId?: string | null;
  publishedAt?: string | null;
  seo?: BlogPostSeoDTO | null;
}

interface BlogPostSaveProps {
  defaultValues?: BlogPostDTO | null;
  categories: BlogCategoryOption[];
}

const postFormSchema = z.object({
  title: z.string().trim().min(1, 'عنوان نوشته الزامی است'),
  slug: z
    .string()
    .trim()
    .min(1, 'اسلاگ نوشته را وارد کنید')
    .regex(slugRegex, 'اسلاگ باید با حروف کوچک انگلیسی، اعداد و خط‌تیره ساخته شود'),
  status: z.enum(['draft', 'published', 'archived']),
  excerpt: z.string().trim().max(600, 'حداکثر ۶۰۰ کاراکتر').optional().or(z.literal('')),
  content: z.string().min(1, 'محتوای مقاله را وارد کنید'),
  coverImageId: z
    .string()
    .trim()
    .regex(objectIdRegex, 'شناسه تصویر نامعتبر است')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  categories: z.array(z.string()).optional().default([]),
  tags: z.string().optional(),
  authorId: z
    .string()
    .trim()
    .regex(objectIdRegex, 'شناسه نویسنده نامعتبر است')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  publishedAt: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).valueOf()), 'تاریخ انتشار معتبر نیست'),
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
    .regex(objectIdRegex, 'شناسه تصویر نامعتبر است')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  jsonLd: z.string().optional(),
});

type PostFormValues = z.infer<typeof postFormSchema>;

function slugify(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s/-]+/g, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : `post-${Date.now().toString(36)}`;
}

function formatDateTimeInput(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return '';
  const offset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.valueOf() - offset).toISOString().slice(0, 16);
}

function parseDateInput(value?: string | null): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return undefined;
  return parsed.toISOString();
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

function trimmed(value?: string | null): string | undefined {
  if (value == null) return undefined;
  const next = value.trim();
  return next.length > 0 ? next : undefined;
}

function buildDefaultValues(dto?: BlogPostDTO | null): PostFormValues {
  return {
    title: dto?.title ?? '',
    slug: dto?.slug ?? '',
    status: dto?.status ?? 'draft',
    excerpt: dto?.excerpt ?? '',
    content: dto?.content ?? '<p></p>',
    coverImageId: dto?.coverImageId ?? '',
    categories: dto?.categories ?? [],
    tags: dto?.tags?.join(', ') ?? '',
    authorId: dto?.authorId ?? '',
    publishedAt: formatDateTimeInput(dto?.publishedAt ?? undefined),
    seoTitle: dto?.seo?.title ?? '',
    seoDescription: dto?.seo?.description ?? '',
    canonical: dto?.seo?.canonical ?? '',
    noindex: dto?.seo?.noindex ?? false,
    ogImageId: dto?.seo?.ogImageId ?? '',
    jsonLd: formatJson(dto?.seo?.jsonLd),
  };
}

export default function BlogPostSave({ defaultValues = null, categories }: BlogPostSaveProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const methods = useForm<any>({
    resolver: zodResolver(postFormSchema),
    defaultValues: buildDefaultValues(defaultValues),
  });

  const {
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = methods;

  const titleValue = watch('title');
  const statusValue = watch('status');

  const isEditing = useMemo(() => Boolean(defaultValues?.id), [defaultValues?.id]);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: `${'—'.repeat(category.depth)} ${category.name}`,
      })),
    [categories]
  );

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
      title: values.title.trim(),
      slug: values.slug.trim().toLowerCase(),
      status: values.status,
      content: values.content,
    };

    const excerpt = trimmed(values.excerpt);
    if (excerpt !== undefined) {
      payload.excerpt = excerpt;
    }

    const categoriesPayload = Array.isArray(values.categories) ? values.categories.filter(Boolean) : [];
    if (categoriesPayload.length > 0) {
      payload.categories = categoriesPayload;
    } else if (isEditing) {
      payload.categories = [];
    }

    const tagsArray =
      typeof values.tags === 'string'
        ? values.tags
          .split(',')
          .map((tag: string) => tag.trim())
          .filter((tag: string) => tag.length > 0)
        : [];
    if (tagsArray.length > 0) {
      payload.tags = tagsArray;
    } else if (isEditing) {
      payload.tags = [];
    }

    const coverImageId = trimmed(values.coverImageId);
    if (coverImageId) {
      payload.coverImageId = coverImageId;
    } else if (isEditing) {
      payload.coverImageId = null;
    }

    const authorId = trimmed(values.authorId);
    if (authorId) {
      payload.authorId = authorId;
    } else if (isEditing) {
      payload.authorId = null;
    }

    const publishedAt = parseDateInput(values.publishedAt);
    if (publishedAt) {
      payload.publishedAt = publishedAt;
    }

    const seo: Record<string, unknown> = {};
    const seoTitle = trimmed(values.seoTitle);
    if (seoTitle !== undefined) {
      seo.title = seoTitle;
    }
    const seoDescription = trimmed(values.seoDescription);
    if (seoDescription !== undefined) {
      seo.description = seoDescription;
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
    } else if (isEditing) {
      seo.ogImageId = null;
    }
    if (jsonLd !== undefined) {
      seo.jsonLd = jsonLd;
    }
    if (Object.keys(seo).length > 0) {
      payload.seo = seo;
    }

    if (publishedAt === undefined && values.status === 'published' && !isEditing) {
      payload.publishedAt = new Date().toISOString();
    }

    const url = isEditing ? `/api/blog/posts/${defaultValues?.id}` : '/api/blog/posts';
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
        throw new Error(message || 'ذخیره نوشته با خطا مواجه شد.');
      }

      toast.success(isEditing ? 'نوشته با موفقیت به‌روزرسانی شد.' : 'نوشته جدید ایجاد شد.');
      router.push('/admin/blog/posts');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ذخیره نوشته با خطا مواجه شد.';
      setFormError(message);
    }
  });

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stack spacing={1}>
          <Typography variant="h4" fontWeight={800}>
            {isEditing ? `ویرایش نوشته «${defaultValues?.title ?? ''}»` : 'افزودن نوشته جدید'}
          </Typography>
          <Typography variant="body2" color="text.secondary" maxWidth={720}>
            برای تولید محتوای حرفه‌ای، عنوان جذاب، خلاصه دقیق و دسته‌بندی صحیح را در کنار محتوای کامل و سئوی مناسب
            تنظیم کنید.
          </Typography>
        </Stack>

        {formError && (
          <Alert severity="error" onClose={() => setFormError(null)}>
            {formError}
          </Alert>
        )}

        <Form methods={methods} onSubmit={onSubmit}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Stack spacing={3}>
                <Card variant="outlined" sx={{ borderRadius: 4 }}>
                  <CardHeader title="اطلاعات پایه نوشته" subheader="عنوان، اسلاگ و دسته‌بندی نوشته را مشخص کنید." />
                  <CardContent>
                    <Stack spacing={2.5}>
                      <Field.Text name="title" label="عنوان نوشته *" />
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        alignItems={{ xs: 'stretch', sm: 'flex-end' }}
                      >
                        <Field.Text name="slug" label="اسلاگ *" helperText="از حروف کوچک انگلیسی، اعداد و - استفاده کنید." />
                        <IconButton
                          aria-label="ساخت اسلاگ"
                          onClick={() => setValue('slug', slugify(titleValue ?? ''), { shouldDirty: true, shouldValidate: true })}
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
                      <Field.Text
                        name="excerpt"
                        label="خلاصه نوشته"
                        helperText="حداکثر ۶۰۰ کاراکتر؛ در فهرست‌ها و پیش‌نمایش‌ها نمایش داده می‌شود."
                        multiline
                        minRows={3}
                      />
                      <Field.MultiSelect
                        name="categories"
                        label="دسته‌بندی‌ها"
                        options={categoryOptions}
                        placeholder="حداقل یک دسته انتخاب کنید"
                        chip
                        checkbox
                      />
                      <Field.Text name="tags" label="برچسب‌ها" helperText="برچسب‌ها را با ویرگول (،) جدا کنید." />
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderRadius: 4 }}>
                  <CardHeader
                    title="محتوای نوشته"
                    subheader="از ساختار منظم، تیترهای مرتبط و لینک‌های داخلی برای بهبود تجربه کاربری استفاده کنید."
                  />
                  <CardContent>
                    <Field.Editor name="content" minHeight={320} />
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderRadius: 4 }}>
                  <CardHeader
                    title="تنظیمات سئو و متا"
                    subheader="برای بهبود نمایش در موتورهای جستجو و شبکه‌های اجتماعی اطلاعات زیر را تکمیل کنید."
                  />
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
                      <Divider />
                      <Field.UploadImage
                        name="coverImageId"
                        label="تصویر شاخص نوشته"
                        helperText="شناسه تصویر موجود در گالری رسانه"
                      />
                      <Field.UploadImage
                        name="ogImageId"
                        label="تصویر OpenGraph"
                        helperText="شناسه تصویر برای اشتراک‌گذاری در شبکه‌های اجتماعی"
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

            <Grid size={{ xs: 12, lg: 4 }}>
              <Stack spacing={3}>
                <Card variant="outlined" sx={{ borderRadius: 4 }}>
                  <CardHeader
                    title="وضعیت انتشار"
                    subheader="وضعیت نمایش نوشته و تاریخ انتشار را مشخص کنید."
                  />
                  <CardContent>
                    <Stack spacing={2}>
                      <Field.Select name="status" label="وضعیت نوشته" fullWidth>
                        {STATUS_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Field.Select>
                      <Typography variant="body2" color="text.secondary">
                        {STATUS_OPTIONS.find((option) => option.value === statusValue)?.description}
                      </Typography>
                      <Divider />
                      <Field.JalaliDate
                        name="publishedAt"
                        label="تاریخ و ساعت انتشار"
                        withTime
                        helperText="در صورت خالی بودن، زمان انتشار بر اساس وضعیت تعیین می‌شود."
                      />
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined" sx={{ borderRadius: 4 }}>
                  <CardHeader title="سایر تنظیمات" />
                  <CardContent>
                    <Stack spacing={2}>
                      <Field.Text
                        name="authorId"
                        label="شناسه نویسنده"
                        helperText="شناسه کاربر نویسنده (اختیاری)"
                      />
                    </Stack>
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
                        {isEditing ? 'ذخیره تغییرات' : 'انتشار نوشته'}
                      </Button>
                      <Button
                        type="button"
                        variant="outlined"
                        color="inherit"
                        onClick={() => router.push('/admin/blog/posts')}
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
