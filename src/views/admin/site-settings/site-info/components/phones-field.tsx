'use client';

import { Button, Grid, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { RHFTextField } from '@/components/hook-form';
import type { SiteInfoFormValues } from '../site-info-form';

interface PhonesFieldProps {
  disabled?: boolean;
}

export default function PhonesField({ disabled }: PhonesFieldProps) {
  const { control } = useFormContext<SiteInfoFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'phones' });

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" fontWeight={600}>
          شماره‌های تماس
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => append({ label: '', number: '' })}
          disabled={disabled}
        >
          افزودن شماره
        </Button>
      </Stack>

      <Stack spacing={2}>
        {fields.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            هنوز شماره‌ای ثبت نشده است.
          </Paper>
        ) : (
          fields.map((field, index) => (
            <Paper key={field.id} variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="flex-start">
                <Grid size={{ xs: 12, md: 5 }}>
                  <RHFTextField
                    name={`phones.${index}.label`}
                    label="عنوان"
                    fullWidth
                    placeholder="مثال: پشتیبانی"
                    disabled={disabled}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <RHFTextField
                    name={`phones.${index}.number`}
                    label="شماره تماس"
                    placeholder="شماره تماس را وارد کنید"
                    fullWidth
                    disabled={disabled}
                    inputProps={{ dir: 'ltr' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 1 }} display="flex" justifyContent="flex-end">
                  <IconButton
                    aria-label="حذف شماره"
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
