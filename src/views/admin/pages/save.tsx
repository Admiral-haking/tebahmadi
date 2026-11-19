'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Form, Field } from '@/components/hook-form';

type PageStatus = 'draft' | 'published' | 'archived';

const STATUS_OPTIONS: Array<{ value: PageStatus; label: string; description: string }> = [
  { value: 'draft', label: 'پیش‌نویس', description: 'برای ادامه ویرایش در آینده نگهداری می‌شود.' },
  { value: 'published', label: 'منتشر شده', description: 'صفحه در وب‌سایت قابل مشاهده خواهد بود.' },
  { value: 'archived', label: 'آرشیوشده', description: 'برای استناد داخلی نگهداری می‌شود و منتشر نمی‌شود.' },
];

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const slugRegex = /^[a-z0-9]+(?:[a-z0-9\-/]*[a-z0-9])?$/;

const pageFormSchema = z.object({
  title: z.string().trim().min(1, 'عنوان صفحه الزامی است'),
  slug: z
    .string()
    .trim()
    .min(1, 'اسلاگ صفحه را وارد کنید')
    .regex(slugRegex, 'اسلاگ باید با حروف کوچک، اعداد و خط‌تیره ایجاد شود'),
  status: z.enum(['draft', 'published', 'archived']),
  content: z.string().min(1, 'لطفاً محتوای صفحه را وارد کنید'),
  publishedAt: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(new Date(value).valueOf()), 'تاریخ انتشار معتبر نیست'),
  seoTitle: z.string().trim().max(120, 'حداکثر ۱۲۰ کاراکتر').optional(),
  seoDescription: z.string().trim().max(320, 'حداکثر ۳۲۰ کاراکتر').optional(),
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

type PageFormValues = z.infer<typeof pageFormSchema>;

type PageSeoDTO = {
  title?: string | null;
  description?: string | null;
  canonical?: string | null;
  noindex?: boolean | null;
  ogImageId?: string | null;
  jsonLd?: unknown;
};

export type PageDTO = {
  id?: string;
  title: string;
  slug: string;
  status: PageStatus;
  content: string;
  publishedAt?: string | null;
  seo?: PageSeoDTO | null;
};

interface PagesSaveProps {
  pageId?: string | null;
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

function parseJson(value: string | undefined): unknown | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error('ساختار JSON-LD معتبر نیست');
  }
}

function slugify(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s/-]+/g, '')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length > 0) return base;
  return `page-${Date.now().toString(36)}`;
}

function buildDefaultValues(dto?: PageDTO | null): PageFormValues {
  return {
    title: dto?.title ?? '',
    slug: dto?.slug ?? '',
    status: dto?.status ?? 'draft',
    content: dto?.content ?? '<p></p>',
    publishedAt: formatDateTimeInput(dto?.publishedAt ?? undefined),
    seoTitle: dto?.seo?.title ?? '',
    seoDescription: dto?.seo?.description ?? '',
    canonical: dto?.seo?.canonical ?? '',
    noindex: dto?.seo?.noindex ?? false,
    ogImageId: dto?.seo?.ogImageId ?? '',
    jsonLd: formatJson(dto?.seo?.jsonLd),
  };
}

export default function PagesSaveView({ pageId }: PagesSaveProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(Boolean(pageId));
  const [loadError, setLoadError] = useState<string | null>(null);

  const methods = useForm<any>({
    resolver: zodResolver(pageFormSchema),
    defaultValues: buildDefaultValues(),
  });

  const {
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = methods;

  const isEditing = useMemo(() => Boolean(pageId), [pageId]);

  useEffect(() => {
    let active = true;

    async function loadPage(id: string) {
      setLoadingInitial(true);
      setLoadError(null);
      setFormError(null);
      try {
        const response = await fetch(`/api/pages/${id}`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });
        if (!response.ok) {
          const message = (await response.text().catch(() => '')) || response.statusText;
          throw new Error(message || 'دریافت اطلاعات صفحه با خطا مواجه شد');
        }
        const json = await response.json();
        const data = json?.data;
        const seo = data?.seo
          ? {
            title: data.seo.title ?? '',
            description: data.seo.description ?? '',
            canonical: data.seo.canonical ?? '',
            noindex: data.seo.noindex ?? false,
            ogImageId: data.seo.ogImageId ? String(data.seo.ogImageId) : '',
            jsonLd: data.seo.jsonLd ?? null,
          }
          : null;

        const mapped: PageDTO = {
          id: data?._id ?? data?.id ?? id,
          title: data?.title ?? '',
          slug: data?.slug ?? '',
          content: data?.content ?? '<p></p>',
          status: (data?.status ?? 'draft') as PageStatus,
          publishedAt: data?.publishedAt ?? null,
          seo,
        };
        if (!active) return;
        reset(buildDefaultValues(mapped), { keepDefaultValues: false });
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'دریافت اطلاعات صفحه با خطا مواجه شد';
        setLoadError(message);
        reset(buildDefaultValues(), { keepDefaultValues: false });
      } finally {
        if (active) {
          setLoadingInitial(false);
        }
      }
    }

    if (pageId) {
      loadPage(pageId);
    } else {
      setLoadError(null);
      setFormError(null);
      reset(buildDefaultValues(), { keepDefaultValues: false });
      setLoadingInitial(false);
    }

    return () => {
      active = false;
    };
  }, [pageId, reset]);

  const titleValue = watch('title');

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    let jsonLd: unknown | undefined;
    try {
      jsonLd = parseJson(values.jsonLd);
    } catch (error) {
      setFormError((error as Error).message);
      return;
    }

    const payload: Record<string, unknown> = {
      title: values.title.trim(),
      slug: values.slug.trim(),
      status: values.status,
      content: values.content,
    };

    const publishedAt = parseDateInput(values.publishedAt);
    if (publishedAt) {
      payload.publishedAt = publishedAt;
    }

    const seoPayload: Record<string, unknown> = {
      title: values.seoTitle?.trim() || undefined,
      description: values.seoDescription?.trim() || undefined,
      canonical: values.canonical?.trim() || undefined,
      noindex: values.noindex ?? undefined,
      ogImageId: values.ogImageId?.trim() || undefined,
      jsonLd,
    };

    Object.keys(seoPayload).forEach((key) => {
      if (seoPayload[key] === undefined || seoPayload[key] === '') {
        delete seoPayload[key];
      }
    });

    if (Object.keys(seoPayload).length > 0) {
      payload.seo = seoPayload;
    }

    const url = isEditing && pageId ? `/api/pages/${pageId}` : '/api/pages';
    const method = isEditing ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = (await response.text().catch(() => '')) || response.statusText;
        if (response.status === 409) {
          throw new Error('این اسلاگ قبلاً استفاده شده است. لطفاً اسلاگ دیگری انتخاب کنید.');
        }
        throw new Error(text || 'ذخیره صفحه با خطا مواجه شد');
      }

      toast.success(isEditing ? 'صفحه با موفقیت به‌روزرسانی شد.' : 'صفحه جدید ثبت شد.');
      router.push('/admin/pages');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ذخیره صفحه با خطا مواجه شد';
      setFormError(message);
      toast.error(message);
    }
  });

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <div>
            <Typography variant="h4" fontWeight={800}>
              {isEditing ? 'ویرایش صفحه' : 'ایجاد صفحه جدید'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              عنوان، محتوا و تنظیمات سئو صفحه را تنظیم کنید و در صورت لزوم وضعیت انتشار را تغییر دهید.
            </Typography>
          </div>
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" color="inherit" onClick={() => router.back()}>
              بازگشت
            </Button>
            <Button
              variant="contained"
              onClick={onSubmit}
              disabled={isSubmitting || loadingInitial}
              startIcon={isSubmitting ? <CircularProgress size={18} /> : null}
            >
              {isEditing ? 'ذخیره تغییرات' : 'انتشار صفحه'}
            </Button>
          </Stack>
        </Stack>

        {formError && <Alert severity="error">{formError}</Alert>}
        {loadError && <Alert severity="error">{loadError}</Alert>}

        <Box sx={{ position: 'relative' }}>
          <Box sx={{ pointerEvents: loadingInitial ? 'none' : 'auto', opacity: loadingInitial ? 0.5 : 1 }}>
            <Form methods={methods} onSubmit={onSubmit}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Stack spacing={3}>
                    <Card>
                      <CardHeader
                        title="اطلاعات صفحه"
                        subheader="عنوان و اسلاگ صفحه را مشخص کنید. برای تولید خودکار اسلاگ می‌توانید از دکمه تبدیل استفاده کنید."
                      />
                      <CardContent>
                        <Stack spacing={2}>
                          <Field.Text name="title" label="عنوان صفحه *" fullWidth />
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
                            <Field.Text name="slug" label="اسلاگ *" fullWidth helperText="از حروف کوچک انگلیسی، اعداد و - استفاده کنید." />
                            <IconButton
                              aria-label="ساخت اسلاگ"
                              onClick={() => setValue('slug', slugify(titleValue ?? ''), { shouldValidate: true, shouldDirty: true })}
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
                                  d="M17.657 6.343a8 8 0 1 0 0 11.314A8 8 0 0 0 17.657 6.343M16.243 16.95a6 6 0 1 1 0-8.486a6 6 0 0 1 0 8.487m-1.414-6.364l-4.95 4.95l-1.414-1.414l4.95-4.95z"
                                ></path>
                              </svg>
                            </IconButton>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader title="محتوای صفحه" subheader="محتوا را با استفاده از ویرایشگر غنی وارد کنید." />
                      <CardContent>
                        <Field.Editor name="content" minHeight={260} helperText="برای ساختاردهی بهتر از عناوین، لیست‌ها و لینک‌ها استفاده کنید." />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader title="تنظیمات سئو و متا" subheader="برای بهبود سئو و پیش‌نمایش در شبکه‌های اجتماعی اطلاعات زیر را تکمیل کنید." />
                      <CardContent>
                        <Stack spacing={2.5}>
                          <Field.Text name="seoTitle" label="عنوان سئو" helperText="حداکثر ۱۲۰ کاراکتر" fullWidth />
                          <Field.Text
                            name="seoDescription"
                            label="توضیحات متا"
                            helperText="حداکثر ۳۲۰ کاراکتر؛ در نتیجه‌های جستجو نمایش داده می‌شود"
                            fullWidth
                            multiline
                            minRows={3}
                          />
                          <Field.Text
                            name="canonical"
                            label="آدرس canonical"
                            helperText="در صورت وجود آدرس مرجع، آن را وارد کنید"
                            fullWidth
                          />
                          <Field.Switch name="noindex" label="عدم ایندکس توسط موتورهای جستجو (noindex)" />
                          <Divider />
                          <Field.UploadImage
                            name="ogImageId"
                            label="شناسه تصویر OpenGraph"
                            helperText="شناسه تصویرِ بارگذاری‌شده در گالری رسانه (اختیاری)"
                          />
                          <Field.Text
                            name="jsonLd"
                            label="اسکیما (JSON-LD)"
                            fullWidth
                            multiline
                            minRows={6}
                            helperText="ساختار JSON-LD معتبر را وارد کنید"
                          />
                        </Stack>
                      </CardContent>
                    </Card>
                  </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                  <Stack spacing={3}>
                    <Card>
                      <CardHeader title="وضعیت انتشار" subheader="وضعیت صفحه را مشخص کنید و در صورت نیاز تاریخ انتشار را تنظیم کنید." />
                      <CardContent>
                        <Stack spacing={2}>
                          <Field.Select name="status" label="وضعیت" fullWidth>
                            {STATUS_OPTIONS.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Field.Select>
                          <Typography variant="body2" color="text.secondary">
                            {STATUS_OPTIONS.find((option) => option.value === watch('status'))?.description}
                          </Typography>
                          <Divider />
                          <Field.JalaliDate
                            name="publishedAt"
                            label="تاریخ انتشار"
                            withTime
                            fullWidth
                            helperText="در صورت خالی بودن و انتشار فوری، تاریخ فعلی ثبت می‌شود."
                          />
                        </Stack>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader title="راهنما" />
                      <CardContent>
                        <Stack spacing={1.5}>
                          <Typography variant="subtitle2">پیشنهادها</Typography>
                          <Typography variant="body2" color="text.secondary">
                            • برای صفحات حساس از اسلاگ واضح و کوتاه استفاده کنید.
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            • از توضیحات متا جذاب با کلیدواژه‌های اصلی بهره ببرید.
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            • در صورت انتشار، محتوای صفحه را مجدداً بازبینی کنید تا از نمایش صحیح در سایت مطمئن شوید.
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Stack>
                </Grid>
              </Grid>
            </Form>
          </Box>
          {loadingInitial && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CircularProgress size={32} />
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
