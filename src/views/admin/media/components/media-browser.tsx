"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import AppPagination from '@/components/search/pagination';
import MediaUploadDialog from './media-upload-dialog';
import MediaDetailsDialog from './media-details-dialog';
import type { FilterKind, FilterScope, MediaFilterState, MediaListItem } from '../types';
import type { MediaScope } from '@/types';

const SCOPE_LABELS: Record<FilterScope, string> = {
  all: 'همه محدوده‌ها',
  gallery: 'گالری',
  attachment: 'ضمیمه',
  avatar: 'آواتار',
};

const KIND_LABELS: Record<FilterKind, string> = {
  all: 'همه انواع',
  image: 'تصویر',
  file: 'فایل',
};

const MEDIA_SCOPE_OPTIONS: { value: MediaScope; label: string }[] = [
  { value: 'gallery', label: 'گالری' },
  { value: 'attachment', label: 'ضمیمه' },
  { value: 'avatar', label: 'آواتار' },
];

interface MediaBrowserProps {
  items: MediaListItem[];
  filters: MediaFilterState;
  total: number;
  page: number;
  pages: number;
  pageSize: number;
}

function getPreviewUrl(item: MediaListItem): string | null {
  if (item.kind !== 'image') {
    return null;
  }
  if (item.thumbId) {
    return `/api/media/${item.thumbId}`;
  }
  if (item.mobileId) {
    return `/api/media/${item.mobileId}`;
  }
  return `/api/media/${item.originalId}`;
}

function formatRelative(newItemsLength: number, total: number, page: number, pageSize: number): string {
  if (total === 0) {
    return 'هیچ رسانه‌ای یافت نشد.';
  }
  const start = (page - 1) * pageSize + 1;
  const end = start + newItemsLength - 1;
  return `نمایش ${start.toLocaleString('fa-IR')} تا ${end.toLocaleString('fa-IR')} از مجموع ${total.toLocaleString(
    'fa-IR',
  )} رسانه`;
}

function MediaCard({
  item,
  onCopy,
  onDelete,
  onOpenDetails,
  deleting,
}: {
  item: MediaListItem;
  onCopy: (item: MediaListItem) => void;
  onDelete: (item: MediaListItem) => void;
  onOpenDetails: (item: MediaListItem) => void;
  deleting: boolean;
}) {
  const previewUrl = getPreviewUrl(item);
  const downloadUrl = `/api/media/${item.originalId}?download=1`;
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          pt: '70%',
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        {previewUrl ? (
          <Box
            component="img"
            src={previewUrl}
            alt={item.filename}
            loading="lazy"
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width={48} height={48} viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M19 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5a2 2 0 0 0-2-2m0 16H5V5h14zM13 7h-2v6h6v-2h-4z"
                opacity={0.5}
              ></path>
              <path
                fill="currentColor"
                d="M13 13V7h-2v6zm0 0H7v2h6z"
              ></path>
            </svg>
          </Box>
        )}
      </Box>
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip label={SCOPE_LABELS[item.scope]} size="small" />
            <Chip label={KIND_LABELS[item.kind]} size="small" color={item.kind === 'image' ? 'primary' : 'default'} />
          </Stack>
          <Tooltip title={item.filename}>
            <Typography variant="subtitle1" noWrap>
              {item.filename}
            </Typography>
          </Tooltip>
          <Typography variant="body2" color="text.secondary">
            نوع فایل: {item.contentType}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            شناسه: {item.id}
          </Typography>
        </Stack>
      </CardContent>
      <Divider />
      <CardActions sx={{ justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1}>
          <Tooltip title="جزئیات">
            <IconButton aria-label="جزئیات رسانه" onClick={() => onOpenDetails(item)}>
              <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 7a1.25 1.25 0 1 1 0-2.5A1.25 1.25 0 0 1 12 7m1 11.25a1 1 0 0 1-2 0V11a1 1 0 0 1 2 0z"
                ></path>
                <path
                  fill="currentColor"
                  d="M12 22A10 10 0 1 1 12 2a10 10 0 0 1 0 20m0-2a8 8 0 1 0 0-16a8 8 0 0 0 0 16"
                  opacity={0.5}
                ></path>
              </svg>
            </IconButton>
          </Tooltip>
          <Tooltip title="کپی لینک">
            <IconButton aria-label="کپی لینک" onClick={() => onCopy(item)}>
              <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M9 9a5 5 0 0 1 8.66-3.54l.88.88a1 1 0 0 1-1.42 1.42l-.88-.88A3 3 0 0 0 11 9a3 3 0 0 0 4.24 2.83a1 1 0 0 1 1.1 1.66A5 5 0 0 1 9 9m6 6a5 5 0 0 1-8.66 3.54l-.88-.88a1 1 0 0 1 1.42-1.42l.88.88A3 3 0 0 0 13 15a3 3 0 0 0-4.24-2.83a1 1 0 0 1-1.1-1.66A5 5 0 0 1 15 15"
                  opacity={0.5}
                ></path>
                <path
                  fill="currentColor"
                  d="M19 11.5a1 1 0 0 1-1-1V9a6 6 0 0 0-12 0v1.5a1 1 0 0 1-2 0V9a8 8 0 0 1 16 0v1.5a1 1 0 0 1-1 1M6 12.5v3a1 1 0 0 1-2 0v-3a1 1 0 0 1 2 0m16 0v3a1 1 0 0 1-2 0v-3a1 1 0 0 1 2 0"
                ></path>
              </svg>
            </IconButton>
          </Tooltip>
          <Tooltip title="دانلود فایل">
            <IconButton
              aria-label="دانلود فایل"
              component="a"
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 15a1 1 0 0 1-.71-.29l-3-3a1 1 0 0 1 1.42-1.42L11 11.59V5a1 1 0 0 1 2 0v6.59l1.29-1.3a1 1 0 1 1 1.42 1.42l-3 3A1 1 0 0 1 12 15"
                ></path>
                <path
                  fill="currentColor"
                  d="M19 21H5a3 3 0 0 1-3-3v-3a1 1 0 0 1 2 0v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3a1 1 0 1 1 2 0v3a3 3 0 0 1-3 3"
                  opacity={0.5}
                ></path>
              </svg>
            </IconButton>
          </Tooltip>
        </Stack>
        <Tooltip title="حذف رسانه">
          <span>
            <IconButton
              aria-label="حذف رسانه"
              onClick={() => onDelete(item)}
              disabled={deleting}
              color="error"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M4 7h16v13a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"
                  opacity={0.5}
                ></path>
                <path
                  fill="currentColor"
                  d="M21 4a1 1 0 0 1-1 1h-1.09l-1.07 1.6A1 1 0 0 1 17 7H7a1 1 0 0 1-.84-.45L5.09 5H4a1 1 0 1 1 0-2h5V2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h5a1 1 0 0 1 1 1M9 2v1h6V2z"
                ></path>
                <path
                  fill="currentColor"
                  d="M10 10a1 1 0 0 1 1 1v6a1 1 0 0 1-2 0v-6a1 1 0 0 1 1-1m4 0a1 1 0 0 1 1 1v6a1 1 0 0 1-2 0v-6a1 1 0 0 1 1-1"
                ></path>
              </svg>
            </IconButton>
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  );
}

export default function MediaBrowser({ items, filters, total, page, pages, pageSize }: MediaBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(filters.q);
  const [ownerInput, setOwnerInput] = useState(filters.owner);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaListItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setSearchInput(filters.q);
  }, [filters.q]);

  useEffect(() => {
    setOwnerInput(filters.owner);
  }, [filters.owner]);

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>, { resetPage = true } = {}) => {
      const params = new URLSearchParams(searchParams?.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value && value.length > 0) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      if (resetPage) {
        params.delete('page');
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname || "", { scroll: true });
    },
    [pathname, router, searchParams],
  );

  const handleFilterSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const payload: Record<string, string | undefined> = {};
      const query = searchInput.trim();
      const owner = ownerInput.trim();
      payload.q = query || undefined;
      payload.owner = owner || undefined;
      updateParams(payload);
    },
    [ownerInput, searchInput, updateParams],
  );

  const handleResetFilters = () => {
    setSearchInput('');
    setOwnerInput('');
    updateParams({ q: undefined, owner: undefined, scope: undefined, kind: undefined });
  };

  const handleScopeChange = (value: FilterScope) => {
    updateParams({ scope: value === 'all' ? undefined : value });
  };

  const handleKindChange = (value: FilterKind) => {
    updateParams({ kind: value === 'all' ? undefined : value });
  };

  const handleCopy = async (item: MediaListItem) => {
    const url = `${window.location.origin}/api/media/${item.originalId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('لینک فایل در کلیپ‌بورد کپی شد.');
    } catch (err) {
      console.error('Clipboard copy failed', err);
      toast.error('کپی لینک موفق نبود.');
    }
  };

  const handleDelete = async (item: MediaListItem) => {
    if (!confirm(`آیا از حذف «${item.filename}» مطمئن هستید؟`)) {
      return;
    }
    setDeletingId(item.id);
    try {
      const response = await fetch(`/api/media/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || response.statusText);
      }
      toast.success('رسانه با موفقیت حذف شد.');
      router.refresh();
    } catch (err) {
      console.error('Failed to delete media', err);
      const message = err instanceof Error ? err.message : 'حذف رسانه ناموفق بود.';
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  const relativeSummary = useMemo(
    () => formatRelative(items.length, total, page, pageSize),
    [items.length, page, pageSize, total],
  );

  const defaultUploadScope: MediaScope =
    filters.scope === 'all' ? 'gallery' : (filters.scope as MediaScope);

  return (
    <>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <Stack spacing={0.5}>
            <Typography variant="h4">گالری رسانه</Typography>
            <Typography variant="body2" color="text.secondary">
              {relativeSummary}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}>
            <Button variant="contained" onClick={() => setUploadOpen(true)}>
              آپلود رسانه جدید
            </Button>
          </Stack>
        </Stack>

        <Paper component="form" onSubmit={handleFilterSubmit} sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="جستجو در نام فایل"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                fullWidth
              />
              <TextField
                label="شناسه مالک (اختیاری)"
                value={ownerInput}
                onChange={(event) => setOwnerInput(event.target.value)}
                fullWidth
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="scope-filter-label">محدوده</InputLabel>
                <Select
                  labelId="scope-filter-label"
                  label="محدوده"
                  value={filters.scope}
                  onChange={(event) => handleScopeChange(event.target.value as FilterScope)}
                >
                  {(
                    [
                      { value: 'all', label: SCOPE_LABELS.all },
                      { value: 'gallery', label: SCOPE_LABELS.gallery },
                      { value: 'attachment', label: SCOPE_LABELS.attachment },
                      { value: 'avatar', label: SCOPE_LABELS.avatar },
                    ] as Array<{ value: FilterScope; label: string }>
                  ).map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="kind-filter-label">نوع فایل</InputLabel>
                <Select
                  labelId="kind-filter-label"
                  label="نوع فایل"
                  value={filters.kind}
                  onChange={(event) => handleKindChange(event.target.value as FilterKind)}
                >
                  {(
                    [
                      { value: 'all', label: KIND_LABELS.all },
                      { value: 'image', label: KIND_LABELS.image },
                      { value: 'file', label: KIND_LABELS.file },
                    ] as Array<{ value: FilterKind; label: string }>
                  ).map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button type="submit" variant="contained">
                اعمال فیلترها
              </Button>
              <Button variant="text" onClick={handleResetFilters}>
                پاک‌سازی فیلترها
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {items.length === 0 ? (
          <Paper
            sx={{
              p: 6,
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Typography variant="h6">رسانه‌ای برای نمایش وجود ندارد.</Typography>
            <Typography variant="body2" color="text.secondary">
              از دکمه «آپلود رسانه جدید» برای افزودن اولین فایل استفاده کنید یا فیلترهای فعلی را تغییر دهید.
            </Typography>
            <Button variant="outlined" onClick={() => setUploadOpen(true)}>
              آپلود رسانه
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {items.map((item) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={item.id}>
                <MediaCard
                  item={item}
                  onCopy={handleCopy}
                  onDelete={handleDelete}
                  onOpenDetails={setSelectedItem}
                  deleting={deletingId === item.id}
                />
              </Grid>
            ))}
          </Grid>
        )}

        {pages > 1 ? (
          <Stack direction="row" justifyContent="center">
            <AppPagination page={page} pages={pages} />
          </Stack>
        ) : null}
      </Stack>

      <MediaUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        defaultScope={defaultUploadScope}
        scopeOptions={MEDIA_SCOPE_OPTIONS}
        onUploaded={(count) => {
          toast.success(`${count.toLocaleString('fa-IR')} رسانه جدید افزوده شد.`);
          router.refresh();
        }}
      />

      <MediaDetailsDialog open={Boolean(selectedItem)} item={selectedItem} onClose={() => setSelectedItem(null)} />
    </>
  );
}
