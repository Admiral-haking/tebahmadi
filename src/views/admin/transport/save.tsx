'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
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
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Form, Field } from '@/components/hook-form';
import { PROVINCE_NAMES, deriveProvinceCityFromRegion, getCitiesByProvinceName, isCityInProvince } from '@/utils/location';

const pricingRowSchema = z.object({
  destRegion: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  basePrice: z.string().trim().min(1, 'قیمت پایه را وارد کنید'),
  baseWeightLimit: z.string().trim().min(1, 'حد وزن پایه را وارد کنید'),
  baseWeightUnit: z.enum(['g', 'kg']),
  overageStepWeight: z.string().trim().min(1, 'گام اضافه وزن را وارد کنید'),
  overageStepUnit: z.enum(['g', 'kg']),
  overageStepPrice: z.string().trim().min(1, 'قیمت هر گام اضافه را وارد کنید'),
  maxWeight: z.string().trim().optional(),
  label: z.string().optional(),
});

const transportFormSchema = z.object({
  name: z.string().trim().min(1, 'نام روش الزامی است'),
  isActive: z.boolean().optional(),
  pricingRows: z.array(pricingRowSchema).min(1, 'حداقل یک ردیف قیمت لازم است'),
}).superRefine((data, ctx) => {
  data.pricingRows.forEach((row, index) => {
    const basePrice = Number(row.basePrice);
    if (Number.isNaN(basePrice) || basePrice < 0) {
      ctx.addIssue({
        path: ['pricingRows', index, 'basePrice'],
        code: z.ZodIssueCode.custom,
        message: 'قیمت پایه معتبر نیست',
      });
    }
    const baseLimit = Number(row.baseWeightLimit);
    if (Number.isNaN(baseLimit) || baseLimit <= 0) {
      ctx.addIssue({
        path: ['pricingRows', index, 'baseWeightLimit'],
        code: z.ZodIssueCode.custom,
        message: 'وزن پایه باید بزرگ‌تر از صفر باشد',
      });
    }
    const stepWeight = Number(row.overageStepWeight);
    if (Number.isNaN(stepWeight) || stepWeight <= 0) {
      ctx.addIssue({
        path: ['pricingRows', index, 'overageStepWeight'],
        code: z.ZodIssueCode.custom,
        message: 'گام اضافه وزن باید بزرگ‌تر از صفر باشد',
      });
    }
    const stepPrice = Number(row.overageStepPrice);
    if (Number.isNaN(stepPrice) || stepPrice < 0) {
      ctx.addIssue({
        path: ['pricingRows', index, 'overageStepPrice'],
        code: z.ZodIssueCode.custom,
        message: 'قیمت گام اضافه معتبر نیست',
      });
    }
    if (row.maxWeight) {
      const maxWeight = Number(row.maxWeight);
      if (Number.isNaN(maxWeight) || maxWeight <= 0) {
        ctx.addIssue({
          path: ['pricingRows', index, 'maxWeight'],
          code: z.ZodIssueCode.custom,
          message: 'حداکثر وزن باید مثبت باشد',
        });
      }
    }
  });
});

type TransportFormValues = z.infer<typeof transportFormSchema>;

type TransportDTO = {
  id?: string;
  name: string;
  isActive?: boolean;
  pricingRows: Array<{
    destRegion?: string;
    basePrice: number;
    baseWeightLimit: number;
    baseWeightUnit: 'g' | 'kg';
    overageStepWeight: number;
    overageStepUnit: 'g' | 'kg';
    overageStepPrice: number;
    maxWeight?: number;
    label?: string;
  }>;
};

interface TransportSaveProps {
  defaultValues?: TransportDTO | null;
}

function buildDefaultValues(dto?: TransportDTO | null): TransportFormValues {
  return {
    name: dto?.name ?? '',
    isActive: dto?.isActive ?? true,
    pricingRows: (dto?.pricingRows ?? []).map((row) => {
      const { province, city } = deriveProvinceCityFromRegion(row.destRegion);
      return {
        destRegion: row.destRegion ?? '',
        state: province,
        city,
        basePrice: String(row.basePrice),
        baseWeightLimit: String(row.baseWeightLimit),
        baseWeightUnit: row.baseWeightUnit,
        overageStepWeight: String(row.overageStepWeight),
        overageStepUnit: row.overageStepUnit,
        overageStepPrice: String(row.overageStepPrice),
        maxWeight: row.maxWeight != null ? String(row.maxWeight) : '',
        label: row.label ?? '',
      };
    }),
  };
}

function createEmptyPricingRow(): TransportFormValues['pricingRows'][number] {
  return {
    destRegion: '',
    state: '',
    city: '',
    basePrice: '',
    baseWeightLimit: '',
    baseWeightUnit: 'kg',
    overageStepWeight: '',
    overageStepUnit: 'kg',
    overageStepPrice: '',
    maxWeight: '',
    label: '',
  };
}

export default function TransportSaveView({ defaultValues = null }: TransportSaveProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = useMemo(() => Boolean(defaultValues?.id), [defaultValues?.id]);

  const methods = useForm<TransportFormValues>({
    resolver: zodResolver(transportFormSchema),
    defaultValues: buildDefaultValues(defaultValues ?? undefined),
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting },
  } = methods;

  const { fields, append, remove } = useFieldArray({ control, name: 'pricingRows' });

  const pricingRowsWatch = useWatch({ control, name: 'pricingRows' }) as TransportFormValues['pricingRows'];

  const cityOptionsByIndex = useMemo(
    () => (pricingRowsWatch ?? []).map((row) => getCitiesByProvinceName(row?.state)),
    [pricingRowsWatch]
  );

  useEffect(() => {
    (pricingRowsWatch ?? []).forEach((row, index) => {
      if (!row) {
        return;
      }
      const stateName = row.state ?? '';
      const cityName = row.city ?? '';

      if (!stateName && cityName) {
        setValue(`pricingRows.${index}.city`, '', { shouldValidate: true });
        return;
      }

      if (stateName && cityName && !isCityInProvince(cityName, stateName)) {
        setValue(`pricingRows.${index}.city`, '', { shouldValidate: true });
      }
    });
  }, [pricingRowsWatch, setValue]);

  useEffect(() => {
    reset(buildDefaultValues(defaultValues ?? undefined));
    setFormError(null);
  }, [defaultValues, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    const payload = {
      name: values.name.trim(),
      isActive: values.isActive ?? true,
      pricingRows: values.pricingRows.map((row) => {
        const normalizedState = row.state?.trim() ?? '';
        const normalizedCity = row.city?.trim() ?? '';
        const fallbackRegion = row.destRegion?.trim() ?? '';
        const destRegion = (normalizedCity || normalizedState || fallbackRegion).trim();

        return {
          destRegion: destRegion || undefined,
          basePrice: Number(row.basePrice.trim()),
          baseWeightLimit: Number(row.baseWeightLimit.trim()),
          baseWeightUnit: row.baseWeightUnit,
          overageStepWeight: Number(row.overageStepWeight.trim()),
          overageStepUnit: row.overageStepUnit,
          overageStepPrice: Number(row.overageStepPrice.trim()),
          maxWeight: row.maxWeight ? Number(row.maxWeight.trim()) : undefined,
          label: row.label?.trim() || undefined,
        };
      }),
    };

    const url = isEditing ? `/api/transport/${defaultValues?.id}` : '/api/transport';
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
        throw new Error(message || 'ذخیره تنظیمات حمل و نقل با خطا مواجه شد');
      }

      toast.success(isEditing ? 'روش حمل و نقل به‌روزرسانی شد.' : 'روش حمل و نقل جدید ایجاد شد.');
      router.push('/admin/transport');
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ذخیره تنظیمات با خطا مواجه شد';
      setFormError(message);
      toast.error(message);
    }
  });

  return (
    <Box sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h4">{isEditing ? 'ویرایش روش حمل و نقل' : 'روش حمل و نقل جدید'}</Typography>

        {formError && <Alert severity="error">{formError}</Alert>}

        <Form methods={methods as any} onSubmit={onSubmit}>
          <Stack spacing={3}>
            <Card>
              <CardHeader title="اطلاعات اصلی" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Field.Text name="name" label="نام روش *" fullWidth />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography>وضعیت</Typography>
                      <Switch
                        checked={!!methods.watch('isActive')}
                        onChange={(event) => methods.setValue('isActive', event.target.checked)}
                      />
                      <Typography color="text.secondary">
                        {methods.watch('isActive') ? 'فعال' : 'غیرفعال'}
                      </Typography>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="ردیف‌های قیمت‌گذاری"
                action={
                  <Button type="button" variant="outlined" onClick={() => append(createEmptyPricingRow())}>
                    افزودن ردیف جدید
                  </Button>
                }
              />
              <CardContent>
                <Stack spacing={2}>
                  {fields.length === 0 ? (
                    <Typography color="text.secondary">هنوز ردیفی ثبت نشده است.</Typography>
                  ) : null}

                  {fields.map((field, index) => (
                    <Card key={field.id} variant="outlined">
                      <CardHeader
                        title={`ردیف ${index + 1}`}
                        action={
                          fields.length > 1 ? (
                            <IconButton aria-label="remove pricing row" onClick={() => remove(index)}>
                              <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
                                <path
                                  fill="currentColor"
                                  d="m12 13.414l4.95 4.95l1.414-1.414L13.414 12l4.95-4.95l-1.414-1.414L12 10.586L7.05 5.636L5.636 7.05L10.586 12l-4.95 4.95l1.414 1.414z"
                                />
                              </svg>
                            </IconButton>
                          ) : null
                        }
                      />
                      <CardContent>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <Field.Autocomplete
                              name={`pricingRows.${index}.state`}
                              label="استان"
                              options={PROVINCE_NAMES}
                              fullWidth
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <Field.Autocomplete
                              name={`pricingRows.${index}.city`}
                              label="شهر"
                              options={cityOptionsByIndex[index] ?? []}
                              disabled={!pricingRowsWatch?.[index]?.state}
                              fullWidth
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 4 }}>
                            <Field.Text
                              name={`pricingRows.${index}.label`}
                              label="عنوان نمایش"
                              placeholder="مثال: سفارشی ۲ روزه"
                              fullWidth
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Field.Text
                              name={`pricingRows.${index}.basePrice`}
                              label="قیمت پایه (تومان)"
                              inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
                              fullWidth
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            <Field.Text
                              name={`pricingRows.${index}.baseWeightLimit`}
                              label="حد وزن پایه"
                              inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
                              fullWidth
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            <Field.Select name={`pricingRows.${index}.baseWeightUnit`} label="واحد وزن">
                              <MenuItem value="kg">کیلوگرم</MenuItem>
                              <MenuItem value="g">گرم</MenuItem>
                            </Field.Select>
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            <Field.Text
                              name={`pricingRows.${index}.overageStepWeight`}
                              label="گام اضافه وزن"
                              inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
                              fullWidth
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 3 }}>
                            <Field.Select name={`pricingRows.${index}.overageStepUnit`} label="واحد گام">
                              <MenuItem value="kg">کیلوگرم</MenuItem>
                              <MenuItem value="g">گرم</MenuItem>
                            </Field.Select>
                          </Grid>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Field.Text
                              name={`pricingRows.${index}.overageStepPrice`}
                              label="قیمت هر گام اضافه (تومان)"
                              inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
                              fullWidth
                            />
                          </Grid>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Field.Text
                              name={`pricingRows.${index}.maxWeight`}
                              label="حداکثر وزن (اختیاری)"
                              placeholder="اگر خالی باشد محدودیتی اعمال نمی‌شود"
                              inputProps={{ inputMode: 'numeric', dir: 'ltr' }}
                              fullWidth
                            />
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  ))}
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
