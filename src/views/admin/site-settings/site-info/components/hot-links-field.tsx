'use client';

import { Button, Grid, IconButton, Paper, Stack, Typography } from '@mui/material';
import { useFieldArray, useFormContext } from 'react-hook-form';

import { Field } from '@/components/hook-form';

import type { SiteInfoFormValues } from '../site-info-form';

interface HotLinksFieldProps {
  disabled?: boolean;
}

const EMPTY_LINK: SiteInfoFormValues['hotLinks'][number] = { title: '', href: '', imageId: '' };

export default function HotLinksField({ disabled }: HotLinksFieldProps) {
  const { control } = useFormContext<SiteInfoFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'hotLinks',
  });

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" fontWeight={600}>
          لینک‌های برجسته
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => append({ ...EMPTY_LINK })}
          disabled={disabled}
        >
          افزودن لینک
        </Button>
      </Stack>

      <Stack spacing={2}>
        {fields.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            برای افزودن لینک ویژه، روی «افزودن لینک» کلیک کنید.
          </Paper>
        ) : (
          fields.map((field, index) => (
            <Paper key={field.id} variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="flex-start">
                <Grid size={{ xs: 12, md: 4 }}>
                  <Field.Text
                    name={`hotLinks.${index}.title`}
                    label="عنوان"
                    fullWidth
                    placeholder="مثال: پیشنهاد ویژه"
                    disabled={disabled}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Field.Text
                    name={`hotLinks.${index}.href`}
                    label="لینک"
                    placeholder="مثال: https://example.com"
                    fullWidth
                    disabled={disabled}
                    inputProps={{ dir: 'ltr' }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Field.UploadImage
                    name={`hotLinks.${index}.imageId`}
                    label="تصویر"
                    helperText="یک تصویر برای نمایش لینک انتخاب کنید"
                    multiple={false}
                    disabled={disabled}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 1 }} display="flex" justifyContent="flex-end">
                  <IconButton
                    aria-label="حذف لینک"
                    onClick={() => remove(index)}
                    disabled={disabled}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="m12 13.414l4.95 4.95l1.414-1.414L13.414 12l4.95-4.95l-1.414-1.414L12 10.586L7.05 5.636L5.636 7.05L10.586 12l-4.95 4.95l1.414 1.414z"
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
