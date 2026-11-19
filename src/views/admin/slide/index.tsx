'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import useSWR from 'swr';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { toast } from 'sonner';

import { Form, Field } from '@/components/hook-form';
import Splash from '@/components/splash';

type SlideListItem = {
  id: string;
  mediaId?: string;
  mediaDesktopId?: string;
  mediaMobileId?: string;
  href: string;
  createdAt?: string;
};

type SlideResponse = {
  data?: SlideListItem[];
};

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const slideFormSchema = z.object({
  mediaDesktopId: z
    .string()
    .trim()
    .min(1, 'تصویر دسکتاپ الزامی است')
    .regex(objectIdRegex, 'شناسه تصویر دسکتاپ معتبر نیست'),
  mediaMobileId: z
    .string()
    .trim()
    .refine((value) => !value || objectIdRegex.test(value), {
      message: 'شناسه تصویر موبایل معتبر نیست',
    })
    .optional(),
  href: z
    .string()
    .trim()
    .min(1, 'لینک الزامی است')
    .refine((value) => value.startsWith('/') || /^https?:\/\//i.test(value), {
      message: 'لینک باید با / شروع شود یا آدرس کامل باشد',
    }),
});

type SlideFormValues = z.infer<typeof slideFormSchema>;

const fetcher = async (url: string): Promise<SlideResponse> => {
  const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!response.ok) {
    const message = (await response.text().catch(() => '')) || response.statusText;
    throw new Error(message || 'خطا در دریافت اسلایدها');
  }
  return response.json();
};

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function renderPreview(mediaId?: string) {
  if (!mediaId) {
    return <Typography variant="caption" color="text.secondary">—</Typography>;
  }

  return (
    <Box
      sx={{
        width: 120,
        height: 70,
        borderRadius: 1,
        overflow: 'hidden',
        bgcolor: 'background.default',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Box
        component="img"
        src={`/api/media/${mediaId}`}
        alt="Slide preview"
        sx={{ width: '100%', height: '100%', objectFit: "contain" }}
      />
    </Box>
  );
}

export default function SlideAdminView() {
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { data, error, isLoading, mutate } = useSWR('/api/slides', fetcher);

  const methods = useForm<SlideFormValues>({
    resolver: zodResolver(slideFormSchema),
    defaultValues: { mediaDesktopId: '', mediaMobileId: '', href: '' },
  });

  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const slides = useMemo<SlideListItem[]>(() => data?.data ?? [], [data?.data]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const mobileId = values.mediaMobileId?.trim();
    const payload: {
      mediaDesktopId: string;
      mediaMobileId?: string;
      href: string;
    } = {
      mediaDesktopId: values.mediaDesktopId.trim(),
      href: values.href.trim(),
    };

    if (mobileId) {
      payload.mediaMobileId = mobileId;
    }

    try {
      const response = await fetch('/api/slides', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = (await response.text().catch(() => '')) || response.statusText;
        throw new Error(message || 'ثبت اسلاید با خطا مواجه شد');
      }

      toast.success('اسلاید ثبت شد.');
      reset({ mediaDesktopId: '', mediaMobileId: '', href: '' });
      mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ثبت اسلاید با خطا مواجه شد';
      setFormError(message);
      toast.error(message);
    }
  });

  if (isLoading) {
    return <Splash />;
  }

  if (error) {
    const message = error instanceof Error ? error.message : 'خطا در دریافت اسلایدها';
    return <Alert severity="error">{message}</Alert>;
  }

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('آیا از حذف این اسلاید مطمئن هستید؟');
    if (!confirmed) return;

    setDeletingId(id);
    setFormError(null);
    try {
      const response = await fetch(`/api/slides/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const message = (await response.text().catch(() => '')) || response.statusText;
        throw new Error(message || 'حذف اسلاید با خطا مواجه شد');
      }

      toast.success('اسلاید حذف شد.');
      mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حذف اسلاید با خطا مواجه شد';
      setFormError(message);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Typography variant="h4">اسلایدها</Typography>

      {formError && <Alert severity="error">{formError}</Alert>}

      <Form methods={methods} onSubmit={onSubmit}>
        <Card>
          <CardHeader title="اسلاید جدید" subheader="بنر دسکتاپ الزامی است. موبایل اختیاری است و در صورت خالی بودن از تصویر دسکتاپ استفاده می‌شود." />
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Field.UploadImage
                  name="mediaDesktopId"
                  label="تصویر بنر دسکتاپ *"
                  helperText="تصویر مناسب نسبت 16:6"
                  scope="gallery"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Field.UploadImage
                  name="mediaMobileId"
                  label="تصویر بنر موبایل (اختیاری)"
                  helperText="تصویر مناسب نسبت 16:9 - در صورت خالی بودن، بنر دسکتاپ استفاده می‌شود"
                  scope="gallery"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Field.Text name="href" label="لینک مقصد *" fullWidth helperText="مثال: /store یا https://example.com" />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={2} sx={{ mt: 2 }}>
          {isSubmitting && <CircularProgress size={24} />}
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            ذخیره اسلاید
          </Button>
        </Stack>
      </Form>

      <Card>
        <CardHeader title="لیست اسلایدها" />
        <CardContent>
          {slides.length === 0 ? (
            <Typography color="text.secondary">هنوز اسلایدی ثبت نشده است.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>دسکتاپ</TableCell>
                  <TableCell>موبایل</TableCell>
                  <TableCell>لینک</TableCell>
                  <TableCell align="right">تاریخ ثبت</TableCell>
                  <TableCell align="right">عملیات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {slides.map((slide) => {
                  const desktopPreview = slide.mediaDesktopId || slide.mediaId;
                  const mobilePreview = slide.mediaMobileId || slide.mediaDesktopId || slide.mediaId;

                  return (
                    <TableRow key={slide.id}>
                      <TableCell>{renderPreview(desktopPreview)}</TableCell>
                      <TableCell>{renderPreview(mobilePreview)}</TableCell>
                      <TableCell>
                        <Box component="a" href={slide.href} target="_blank" rel="noreferrer">
                          {slide.href}
                        </Box>
                      </TableCell>
                      <TableCell align="right">{formatDate(slide.createdAt)}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          aria-label="حذف"
                          color="error"
                          onClick={() => handleDelete(slide.id)}
                          disabled={deletingId === slide.id}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
