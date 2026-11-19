"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { toast } from 'sonner';
import type { MediaScope } from '@/types';
import { uploadMedia } from '@/media/client/uploadMedia';

const DEFAULT_SCOPE: MediaScope = 'gallery';

interface ScopeOption {
  value: MediaScope;
  label: string;
}

interface MediaUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploaded: (count: number) => void;
  defaultScope?: MediaScope;
  scopeOptions: ScopeOption[];
}

export default function MediaUploadDialog({
  open,
  onClose,
  onUploaded,
  defaultScope,
  scopeOptions,
}: MediaUploadDialogProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedScope, setSelectedScope] = useState<MediaScope>(defaultScope ?? DEFAULT_SCOPE);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setUploading(false);
    }
  }, [open]);

  useEffect(() => {
    if (defaultScope) {
      setSelectedScope(defaultScope);
    } else {
      setSelectedScope(DEFAULT_SCOPE);
    }
  }, [defaultScope, open]);

  const canUpload = files.length > 0 && !uploading;

  const scopeOptionsMap = useMemo(() => {
    if (scopeOptions.length > 0) {
      return scopeOptions;
    }
    return [
      { value: 'gallery', label: 'گالری' },
      { value: 'attachment', label: 'ضمیمه' },
      { value: 'avatar', label: 'آواتار' },
    ] satisfies ScopeOption[];
  }, [scopeOptions]);

  const handleSelectFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const chosen = Array.from(fileList);
    if (!chosen.length) return;
    setFiles((prev) => {
      const existingNames = new Set(prev.map((file) => file.name));
      const merged = [...prev];
      chosen.forEach((file) => {
        if (!existingNames.has(file.name)) {
          merged.push(file);
        }
      });
      return merged;
    });
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleRemoveFile = (name: string) => {
    setFiles((prev) => prev.filter((file) => file.name !== name));
  };

  const handleUpload = async () => {
    if (!files.length) {
      return;
    }

    setUploading(true);
    let successCount = 0;

    for (const file of files) {
      try {
        await uploadMedia({ file, scope: selectedScope });
        successCount += 1;
        toast.success(`«${file.name}» با موفقیت آپلود شد.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'آپلود فایل ناموفق بود';
        toast.error(`آپلود «${file.name}» با خطا مواجه شد: ${message}`);
      }
    }

    setUploading(false);

    if (successCount > 0) {
      onUploaded(successCount);
      setFiles([]);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!uploading) {
          onClose();
        }
      }}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>آپلود رسانه جدید</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <FormControl fullWidth>
            <InputLabel id="media-scope-label">محدوده ذخیره‌سازی</InputLabel>
            <Select
              labelId="media-scope-label"
              label="محدوده ذخیره‌سازی"
              value={selectedScope}
              onChange={(event) => setSelectedScope(event.target.value as MediaScope)}
              disabled={uploading}
            >
              {scopeOptionsMap.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack spacing={1}>
            <Typography variant="subtitle2">انتخاب فایل‌ها</Typography>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => handleSelectFiles(event.target.files)}
            />
            <Button
              variant="outlined"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              انتخاب فایل
            </Button>
            <Typography variant="caption" color="text.secondary">
              حداکثر حجم هر فایل ۲۰ مگابایت است. برای تصاویر، فرمت‌های JPEG، PNG، WEBP و AVIF پشتیبانی
              می‌شوند.
            </Typography>

            {files.length > 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  mt: 1,
                }}
              >
                {files.map((file) => (
                  <Chip
                    key={file.name}
                    label={`${file.name} (${Math.ceil(file.size / 1024)} کیلوبایت)`}
                    onDelete={() => handleRemoveFile(file.name)}
                    disabled={uploading}
                  />
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                هنوز فایلی انتخاب نشده است.
              </Typography>
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            if (!uploading) {
              onClose();
            }
          }}
        >
          انصراف
        </Button>
        <Button variant="contained" onClick={handleUpload} disabled={!canUpload}>
          {uploading ? 'در حال آپلود...' : 'شروع آپلود'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
