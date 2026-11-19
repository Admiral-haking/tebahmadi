'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, FormHelperText, Paper, Stack, Typography } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import { uploadMedia } from '@/media/client/uploadMedia';
import type { AvatarVariantIds } from '@/types';
import type { SiteInfoFormValues } from '../site-info-form';

interface LogoFieldProps {
  disabled?: boolean;
}

export default function LogoField({ disabled }: LogoFieldProps) {
  const { control } = useFormContext<SiteInfoFormValues>();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  const handleSelectFile = () => {
    if (disabled || uploading) {
      return;
    }
    inputRef.current?.click();
  };

  const removeLogo = (onChange: (value: AvatarVariantIds | null) => void) => {
    setUploadError(null);
    setLocalPreview(null);
    onChange(null);
  };

  return (
    <Controller
      control={control}
      name={"logo" as any}
      render={({ field, fieldState: { error } }) => {
        const value: any = field.value;

        const previewUrl = useMemo(() => {
          if (localPreview) {
            return localPreview;
          }
          if (value?.thumbId) {
            return `/api/media/${value.thumbId}`;
          }
          if (value?.originalId) {
            return `/api/media/${value.originalId}`;
          }
          return null;
        }, [localPreview, value?.originalId, value?.thumbId]);

        const effectiveHelper = error?.message ?? uploadError ?? undefined;

        const handleFiles = async (fileList: FileList | null) => {
          const file = fileList?.item(0);
          if (!file) {
            return;
          }
          const localUrl = URL.createObjectURL(file);
          setLocalPreview(localUrl);
          setUploadError(null);
          setUploading(true);
          try {
            const media = await uploadMedia({ file, scope: 'attachment' });
            const nextValue: AvatarVariantIds = {
              originalId: media.originalId,
              mobileId: media.mobileId ?? media.originalId,
              thumbId: media.thumbId ?? media.originalId,
              groupId: media.groupId,
            };
            field.onChange(nextValue);
            setLocalPreview(null);
          } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'آپلود ناموفق بود');
            setLocalPreview(null);
          } finally {
            URL.revokeObjectURL(localUrl);
            setUploading(false);
          }
        };

        return (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Box
                  sx={{
                    width: 140,
                    height: 140,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    bgcolor: 'background.default',
                  }}
                >
                  {previewUrl ? (
                    <Box
                      component="img"
                      src={previewUrl}
                      alt="لوگو سایت"
                      sx={{ width: '100%', height: '100%', objectFit: 'contain', p: 1 }}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary" textAlign="center" px={2}>
                      هنوز لوگویی انتخاب نشده است
                    </Typography>
                  )}
                </Box>

                <Stack spacing={1} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
                  <Typography variant="h6" fontWeight={600}>
                    لوگوی سایت
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    پیشنهادی: تصویر با پس‌زمینه شفاف و حداقل عرض 320 پیکسل بارگذاری کنید.
                  </Typography>

                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" onClick={handleSelectFile} disabled={disabled || uploading}>
                      {uploading ? 'در حال بارگذاری...' : 'انتخاب لوگو'}
                    </Button>
                    {value ? (
                      <Button
                        variant="text"
                        color="secondary"
                        onClick={() => removeLogo(field.onChange)}
                        disabled={disabled || uploading}
                      >
                        حذف لوگو
                      </Button>
                    ) : null}
                  </Stack>

                  {uploading ? <CircularProgress size={20} /> : null}
                </Stack>
              </Stack>

              {(effectiveHelper || error) && (
                <FormHelperText error={!!(error || uploadError)}>{effectiveHelper}</FormHelperText>
              )}

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                disabled={disabled || uploading}
                onChange={(event) => {
                  void handleFiles(event.target.files);
                  event.target.value = '';
                }}
              />
            </Stack>
          </Paper>
        );
      }}
    />
  );
}
