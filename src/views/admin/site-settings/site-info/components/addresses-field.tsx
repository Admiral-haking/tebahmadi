'use client';

import { Button, Grid, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { RHFTextField } from '@/components/hook-form';
import type { SiteInfoFormValues } from '../site-info-form';

interface AddressesFieldProps {
  disabled?: boolean;
}

export default function AddressesField({ disabled }: AddressesFieldProps) {
  const { control } = useFormContext<SiteInfoFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'addresses' });

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" fontWeight={600}>
          آدرس‌ها
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => append({ label: '', address: '' })}
          disabled={disabled}
        >
          افزودن آدرس
        </Button>
      </Stack>

      <Stack spacing={2}>
        {fields.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            هیچ آدرسی ثبت نشده است.
          </Paper>
        ) : (
          fields.map((field, index) => (
            <Paper key={field.id} variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="flex-start">
                <Grid size={{ xs: 12, md: 4 }}>
                  <RHFTextField
                    name={`addresses.${index}.label`}
                    label="عنوان"
                    fullWidth
                    placeholder="مثال: دفتر مرکزی"
                    disabled={disabled}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 7 }}>
                  <RHFTextField
                    name={`addresses.${index}.address`}
                    label="آدرس کامل"
                    multiline
                    fullWidth
                    minRows={2}
                    disabled={disabled}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 1 }} display="flex" justifyContent="flex-end">
                  <IconButton
                    aria-label="حذف آدرس"
                    onClick={() => remove(index)}
                    disabled={disabled}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M8 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1h4v2H4V4zm1 4h2v10H9zm4 0h2v10h-2z"
                      />
                    </svg>
                  </IconButton>
                </Grid>
              </Grid>
            </Paper>
          ))
        )}
      </Stack>
    </Stack>
  );
}
