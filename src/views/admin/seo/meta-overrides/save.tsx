'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
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
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Form, Field } from '@/components/hook-form';

const metaOverrideSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'مسیر الزامی است')
    .regex(/^\//, 'مسیر باید با / شروع شود'),
  title: z.string().optional(),
  description: z.string().optional(),
  canonical: z.string().url('آدرس canonical معتبر نیست').optional().or(z.literal('')),
  noindex: z.boolean().optional(),
  ogImageId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'شناسه تصویر باید شناسه معتبر باشد')
    .optional()
    .or(z.literal(''))
    .or(z.null()),
  jsonLd: z.string().optional(),
});

type MetaOverrideFormValues = z.infer<typeof metaOverrideSchema>;

type MetaOverrideDTO = {
  id?: string;
  slug: string;
  seo?: {
    title?: string;
    description?: string;
    canonical?: string;
    noindex?: boolean;
    ogImageId?: string;
    jsonLd?: unknown;
  };
};

interface MetaOverrideSaveProps {
  defaultValues?: MetaOverrideDTO | null;
}

function buildDefaultValues(dto?: MetaOverrideDTO | null): MetaOverrideFormValues {
  return {
    slug: dto?.slug ?? '',
    title: dto?.seo?.title ?? '',
    description: dto?.seo?.description ?? '',
    canonical: dto?.seo?.canonical ?? '',
    noindex: dto?.seo?.noindex ?? false,
    ogImageId: dto?.seo?.ogImageId ?? null,
    jsonLd: dto?.seo?.jsonLd ? formatJson(dto.seo.jsonLd) : '',
  };
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function parseJsonLd(input: string): unknown {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new Error('ساختار JSON-LD معتبر نیست');
  }
}

export default function MetaOverrideSaveView({ defaultValues = null }: MetaOverrideSaveProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = useMemo(() => Boolean(defaultValues?.id), [defaultValues?.id]);

  const methods = useForm<MetaOverrideFormValues>({
    resolver: zodResolver(metaOverrideSchema),
    defaultValues: buildDefaultValues(defaultValues ?? undefined),
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

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    let jsonLd: unknown | undefined;
    try {
      if (values.jsonLd) {
        jsonLd = parseJsonLd(values.jsonLd);
      }
    } catch (error) {
      setFormError((error as Error).message);
      return;
    }

    const ogImageId = typeof values.ogImageId === 'string' ? values.ogImageId.trim() : undefined;

    const seoPayload: Record<string, unknown> = {
      title: values.title?.trim() || undefined,
      description: values.description?.trim() || undefined,
      canonical: values.canonical?.trim() || undefined,
      noindex: values.noindex ?? undefined,
      ogImageId,
      jsonLd,
    };

    if (!seoPayload.title) delete seoPayload.title;
    if (!seoPayload.description) delete seoPayload.description;
    if (!seoPayload.canonical) delete seoPayload.canonical;
    if (!seoPayload.ogImageId) delete seoPayload.ogImageId;
    if (!seoPayload.jsonLd) delete seoPayload.jsonLd;
    if (seoPayload.noindex === undefined) delete seoPayload.noindex;

    const payload: Record<string, unknown> = {
      slug: values.slug.trim(),
    };

    if (Object.keys(seoPayload).length > 0) {
      payload.seo = seoPayload;
    }

    const url = isEditing ? `/api/seo/meta-overrides/${defaultValues?.id}` : '/api/seo/meta-overrides';
    const method = isEditing ? 'PATCH' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text().catch(() => '') || response.statusText;
        throw new Error(message || 'ذخیره تنظیمات سئو با خطا مواجه شد');
      }

      toast.success(isEditing ? 'تنظیمات سئو به‌روزرسانی شد.' : 'تنظیمات سئو ثبت شد.');
      router.push('/admin/seo/meta-overrides');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ذخیره تنظیمات سئو با خطا مواجه شد';
      setFormError(message);
      toast.error(message);
    }
  });

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h4">{isEditing ? 'ویرایش Meta Override' : 'ثبت Meta Override جدید'}</Typography>

        {formError && <Alert severity="error">{formError}</Alert>}

        <Form methods={methods as any} onSubmit={onSubmit}>
          <Stack spacing={3}>
            <Card>
              <CardHeader title="اطلاعات اصلی" subheader="مسیر و توضیحات سئو را وارد کنید" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Field.Text name="slug" label="مسیر *" helperText="مثال: /landing" fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Field.Switch name="noindex" label="عدم ایندکس (noindex)" />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Field.Text name="title" label="عنوان" fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Field.Text name="canonical" label="Canonical" fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Field.Text name="description" label="توضیحات" multiline minRows={3} fullWidth />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="تنظیمات پیشرفته" />
              <CardContent>
                <Stack spacing={2}>
                  <Field.UploadImage
                    name="ogImageId"
                    label="تصویر OG"
                    helperText="تصویر مناسب برای اشتراک‌گذاری در شبکه‌های اجتماعی بارگذاری کنید"
                    multiple={false}
                  />
                  <Field.Text
                    name="jsonLd"
                    label="JSON-LD"
                    multiline
                    minRows={6}
                    helperText="اسکریپت JSON-LD را به صورت JSON معتبر وارد کنید"
                    fullWidth
                  />
                </Stack>
              </CardContent>
            </Card>

            <Stack direction="row" justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
              >
                ذخیره
              </Button>
            </Stack>
          </Stack>
        </Form>
      </Stack>
    </Box>
  );
}
