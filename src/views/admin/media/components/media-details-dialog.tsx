"use client";

import { useMemo } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { toast } from 'sonner';
import type { MediaListItem } from '../types';

const SCOPE_LABELS: Record<string, string> = {
  gallery: 'گالری',
  attachment: 'ضمیمه',
  avatar: 'آواتار',
};

const KIND_LABELS: Record<string, string> = {
  image: 'تصویر',
  file: 'فایل',
};

interface InfoRow {
  label: string;
  value?: string;
  copyable?: boolean;
}

interface MediaDetailsDialogProps {
  open: boolean;
  item: MediaListItem | null;
  onClose: () => void;
}

function formatDateTime(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function MediaDetailsDialog({ open, item, onClose }: MediaDetailsDialogProps) {
  const previewUrl = useMemo(() => {
    if (!item) return undefined;
    if (item.kind !== 'image') return undefined;
    if (item.thumbId) return `/api/media/${item.thumbId}`;
    if (item.mobileId) return `/api/media/${item.mobileId}`;
    return `/api/media/${item.originalId}`;
  }, [item]);

  const originalUrl = item ? `/api/media/${item.originalId}` : undefined;
  const downloadUrl = item ? `${originalUrl}?download=1` : undefined;

  const infoRows: InfoRow[] = useMemo(() => {
    if (!item) {
      return [];
    }
    const rows: InfoRow[] = [
      { label: 'شناسه رسانه', value: item.id, copyable: true },
      { label: 'شناسه گروه', value: item.groupId, copyable: true },
      { label: 'نوع رسانه', value: KIND_LABELS[item.kind] ?? item.kind },
      { label: 'محدوده ذخیره‌سازی', value: SCOPE_LABELS[item.scope] ?? item.scope },
      { label: 'نوع فایل', value: item.contentType },
      { label: 'شناسه فایل اصلی', value: item.originalId, copyable: true },
    ];

    if (item.mobileId) {
      rows.push({ label: 'شناسه نسخه موبایل', value: item.mobileId, copyable: true });
    }

    if (item.thumbId) {
      rows.push({ label: 'شناسه تصویر بندانگشتی', value: item.thumbId, copyable: true });
    }

    if (item.ownerUserId) {
      rows.push({ label: 'شناسه مالک', value: item.ownerUserId, copyable: true });
    }

    rows.push({ label: 'تاریخ ایجاد', value: formatDateTime(item.createdAt) });
    rows.push({ label: 'آخرین بروزرسانی', value: formatDateTime(item.updatedAt) });

    if (previewUrl) {
      rows.push({ label: 'آدرس پیش‌نمایش', value: previewUrl, copyable: true });
    }

    if (originalUrl) {
      rows.push({ label: 'آدرس فایل اصلی', value: originalUrl, copyable: true });
    }

    if (downloadUrl) {
      rows.push({ label: 'لینک دانلود مستقیم', value: downloadUrl, copyable: true });
    }

    return rows;
  }, [item, previewUrl, originalUrl, downloadUrl]);

  const handleCopy = async (value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success('در کلیپ‌بورد کپی شد.');
    } catch (err) {
      console.error('Clipboard copy failed', err);
      toast.error('امکان کپی وجود ندارد.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>جزئیات رسانه</DialogTitle>
      <DialogContent dividers>
        {item ? (
          <Stack spacing={3}>
            {previewUrl ? (
              <Box
                component="img"
                src={previewUrl}
                alt={item.filename}
                sx={{
                  width: '100%',
                  maxHeight: 360,
                  objectFit: 'contain',
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  borderRadius: 2,
                  border: 1,
                  borderColor: 'divider',
                  bgcolor: 'background.default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 6,
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  پیش‌نمایش برای این نوع رسانه در دسترس نیست.
                </Typography>
              </Box>
            )}

            <Stack spacing={1}>
              {infoRows.map((row) => (
                <Stack
                  key={row.label}
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    px: 2,
                    py: 1,
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ minWidth: 160, flexShrink: 0 }}
                  >
                    {row.label}
                  </Typography>
                  <Typography variant="body2" sx={{ flexGrow: 1, wordBreak: 'break-all' }}>
                    {row.value ?? '—'}
                  </Typography>
                  {row.copyable && row.value ? (
                    <Tooltip title="کپی">
                      <IconButton size="small" onClick={() => handleCopy(row.value)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M18 14v5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h5"
                            opacity={0.5}
                          ></path>
                          <path
                            fill="currentColor"
                            d="M21.066 2.934a3.188 3.188 0 0 0-4.514 0l-6.125 6.125a1 1 0 0 0-.254.45l-.99 3.465a.5.5 0 0 0 .621.62l3.466-.988a1 1 0 0 0 .45-.255l6.125-6.125a3.188 3.188 0 0 0 0-4.514"
                          ></path>
                        </svg>
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </Stack>
              ))}
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2">اطلاعاتی برای نمایش وجود ندارد.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        {downloadUrl ? (
          <Button
            component="a"
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
          >
            دانلود فایل
          </Button>
        ) : null}
        <Button onClick={onClose}>بستن</Button>
      </DialogActions>
    </Dialog>
  );
}
