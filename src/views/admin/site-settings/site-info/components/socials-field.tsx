'use client';

import { Button, Grid, IconButton, MenuItem, Paper, Stack, Typography } from '@mui/material';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { RHFSelect, RHFTextField } from '@/components/hook-form';
import type { SiteInfoFormValues } from '../site-info-form';
import { PLATFORM_ALIAS } from '@/layout/components/socials';

interface SocialsFieldProps {
  disabled?: boolean;
}

export default function SocialsField({ disabled }: SocialsFieldProps) {
  const { control } = useFormContext<SiteInfoFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'socials' });

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6" fontWeight={600}>
          شبکه‌های اجتماعی
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={() => append({ platform: '', url: '' })}
          disabled={disabled}
        >
          افزودن لینک
        </Button>
      </Stack>

      <Stack spacing={2}>
        {fields.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
            لینک شبکه اجتماعی ثبت نشده است.
          </Paper>
        ) : (
          fields.map((field, index) => (
            <Paper key={field.id} variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="flex-start">
                <Grid size={{ xs: 12, md: 4 }}>
                  <RHFSelect
                    name={`socials.${index}.platform`}
                    label="پلتفرم"
                    fullWidth
                    disabled={disabled}
                    children={
                      Object.keys(PLATFORM_ALIAS).map(x => <MenuItem value={x} key={x}>{x}</MenuItem>)
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 7 }}>
                  <RHFTextField
                    name={`socials.${index}.url`}
                    label="آدرس لینک"
                    placeholder="https://"
                    disabled={disabled}
                    fullWidth
                    inputProps={{ dir: 'ltr' }}
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
