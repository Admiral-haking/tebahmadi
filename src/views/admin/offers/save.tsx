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
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Form, Field } from '@/components/hook-form';

const offerFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(3, 'کد کوپن باید حداقل ۳ کاراکتر باشد'),
    type: z.enum(['percentage', 'absolute', 'transport']),
    amount: z.string().optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    usageLimitTotal: z.string().optional(),
    usageLimitPerUser: z.string().optional(),
    minOrderSubtotal: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const amountNumber = data.amount && data.amount.trim().length > 0 ? Number(data.amount) : undefined;
    if (data.type === 'percentage') {
      if (amountNumber === undefined) {
        ctx.addIssue({
          path: ['amount'],
          code: z.ZodIssueCode.custom,
          message: 'مقدار درصدی الزامی است',
        });
      } else if (Number.isNaN(amountNumber) || amountNumber < 0 || amountNumber > 100) {
        ctx.addIssue({
          path: ['amount'],
          code: z.ZodIssueCode.custom,
          message: 'درصد باید بین ۰ تا ۱۰۰ باشد',
        });
      }
    }
    if (data.type === 'absolute') {
      if (amountNumber === undefined) {
        ctx.addIssue({
          path: ['amount'],
          code: z.ZodIssueCode.custom,
          message: 'مقدار مبلغ الزامی است',
        });
      } else if (!Number.isInteger(amountNumber) || amountNumber < 0) {
        ctx.addIssue({
          path: ['amount'],
          code: z.ZodIssueCode.custom,
          message: 'مبلغ باید عدد صحیح مثبت باشد',
        });
      }
    }
    if (data.type === 'transport' && amountNumber !== undefined) {
      ctx.addIssue({
        path: ['amount'],
        code: z.ZodIssueCode.custom,
        message: 'برای ارسال رایگان مقدار نباید مشخص شود',
      });
    }

    const startsAt = data.startsAt ? DateTime.fromISO(data.startsAt) : null;
    const endsAt = data.endsAt ? DateTime.fromISO(data.endsAt) : null;
    if (startsAt && !startsAt.isValid) {
      ctx.addIssue({ path: ['startsAt'], code: z.ZodIssueCode.custom, message: 'تاریخ شروع معتبر نیست' });
    }
    if (endsAt && !endsAt.isValid) {
      ctx.addIssue({ path: ['endsAt'], code: z.ZodIssueCode.custom, message: 'تاریخ پایان معتبر نیست' });
    }
    if (startsAt && endsAt && startsAt > endsAt) {
      ctx.addIssue({ path: ['endsAt'], code: z.ZodIssueCode.custom, message: 'تاریخ پایان باید بعد از شروع باشد' });
    }
    const total = data.usageLimitTotal && data.usageLimitTotal.trim().length > 0 ? Number(data.usageLimitTotal) : undefined;
    const perUser =
      data.usageLimitPerUser && data.usageLimitPerUser.trim().length > 0
        ? Number(data.usageLimitPerUser)
        : undefined;
    if (perUser !== undefined && (Number.isNaN(perUser) || perUser < 0)) {
      ctx.addIssue({
        path: ['usageLimitPerUser'],
        code: z.ZodIssueCode.custom,
        message: 'مقدار باید عدد معتبر باشد',
      });
    }
    if (total !== undefined && (Number.isNaN(total) || total < 0)) {
      ctx.addIssue({
        path: ['usageLimitTotal'],
        code: z.ZodIssueCode.custom,
        message: 'مقدار باید عدد معتبر باشد',
      });
    }
    if (total != null && perUser != null && perUser > total) {
      ctx.addIssue({
        path: ['usageLimitPerUser'],
        code: z.ZodIssueCode.custom,
        message: 'محدودیت هر کاربر نمی‌تواند بیش از کل باشد',
      });
    }
  });

type OfferFormValues = z.infer<typeof offerFormSchema>;

type OfferDTO = {
  id?: string;
  code: string;
  type: 'percentage' | 'absolute' | 'transport';
  amount?: number;
  startsAt?: string;
  endsAt?: string;
  usageLimitTotal?: number;
  usageLimitPerUser?: number;
  minOrderSubtotal?: number;
  isActive?: boolean;
};

interface OfferSaveProps {
  defaultValues?: OfferDTO | null;
}

function buildDefaultValues(dto?: OfferDTO | null): OfferFormValues {
  return {
    code: dto?.code ?? '',
    type: dto?.type ?? 'percentage',
    amount: dto?.amount != null ? String(dto.amount) : '',
    startsAt: dto?.startsAt ?? '',
    endsAt: dto?.endsAt ?? '',
    usageLimitTotal: dto?.usageLimitTotal != null ? String(dto.usageLimitTotal) : '',
    usageLimitPerUser: dto?.usageLimitPerUser != null ? String(dto.usageLimitPerUser) : '',
    minOrderSubtotal: dto?.minOrderSubtotal != null ? String(dto.minOrderSubtotal) : '',
    isActive: dto?.isActive ?? true,
  };
}

function toISOOrUndefined(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const date = DateTime.fromISO(trimmed);
  return date.isValid ? date.toISO() ?? undefined : undefined;
}

function toNumberOrUndefined(value?: string): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

export default function OfferSaveView({ defaultValues = null }: OfferSaveProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = useMemo(() => Boolean(defaultValues?.id), [defaultValues?.id]);

  const methods = useForm<OfferFormValues>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: buildDefaultValues(defaultValues ?? undefined),
  });

  const {
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    reset(buildDefaultValues(defaultValues ?? undefined));
    setFormError(null);
  }, [defaultValues, reset]);

  const offerType = watch('type');

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const payload = {
      code: values.code.trim().toUpperCase(),
      type: values.type,
      amount: toNumberOrUndefined(values.amount),
      startsAt: toISOOrUndefined(values.startsAt),
      endsAt: toISOOrUndefined(values.endsAt),
      usageLimitTotal: toNumberOrUndefined(values.usageLimitTotal),
      usageLimitPerUser: toNumberOrUndefined(values.usageLimitPerUser),
      minOrderSubtotal: toNumberOrUndefined(values.minOrderSubtotal),
      isActive: values.isActive ?? true,
    };

    if (values.type === 'transport') {
      delete payload.amount;
    }

    const url = isEditing ? `/api/offers/${defaultValues?.id}` : '/api/offers';
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
        throw new Error(message || 'ذخیره کوپن با خطا مواجه شد');
      }

      toast.success(isEditing ? 'کوپن به‌روزرسانی شد.' : 'کوپن جدید ایجاد شد.');
      router.push('/admin/offers');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ذخیره کوپن با خطا مواجه شد';
      setFormError(message);
      toast.error(message);
    }
  });

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h4">{isEditing ? 'ویرایش کوپن' : 'کوپن جدید'}</Typography>

        {formError && <Alert severity="error">{formError}</Alert>}

        <Form methods={methods as any} onSubmit={onSubmit}>
          <Stack spacing={3}>
            <Card>
              <CardHeader title="اطلاعات پایه" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Field.Text name="code" label="کد کوپن *" fullWidth inputProps={{ dir: 'ltr' }} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Field.Select name="type" label="نوع تخفیف">
                      <MenuItem value="percentage">درصدی</MenuItem>
                      <MenuItem value="absolute">مبلغ ثابت</MenuItem>
                      <MenuItem value="transport">ارسال رایگان</MenuItem>
                    </Field.Select>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Field.Text
                      name="amount"
                      label={offerType === 'percentage' ? 'درصد تخفیف' : 'مبلغ (تومان)'}
                      disabled={offerType === 'transport'}
                      inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
                    />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="محدودیت‌ها" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Field.JalaliDate name="startsAt" label="تاریخ شروع" withTime fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Field.JalaliDate name="endsAt" label="تاریخ پایان" withTime fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Field.Switch name="isActive" label="فعال" />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Field.Text
                      name="usageLimitTotal"
                      label="محدودیت کل"
                      placeholder="مثال: 100"
                      inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Field.Text
                      name="usageLimitPerUser"
                      label="محدودیت هر کاربر"
                      placeholder="مثال: 1"
                      inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Field.Text
                      name="minOrderSubtotal"
                      label="حداقل مبلغ سفارش (تومان)"
                      inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
                    />
                  </Grid>
                </Grid>
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
