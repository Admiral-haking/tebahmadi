'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Rating,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Typography,
} from '@mui/material';
import { toast } from 'sonner';
import Link from 'next/link';

type ReviewItem = {
  id: string;
  productTitle: string;
  productSlug: string;
  variantSummary?: string;
  rating: number;
  comment?: string;
  status: 'pending' | 'published';
  orderNumber?: string;
  createdAt?: string | null;
  publishedAt?: string | null;
};

type ApiResponse = {
  data?: {
    items: ReviewItem[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: unknown;
};

const DATE_FORMATTER = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short' });

const fetcher = (url: string) =>
  fetch(url, { credentials: 'include' }).then(async (res) => {
    const json = (await res.json().catch(() => ({}))) as ApiResponse;
    if (!res.ok) {
      const message = (json as { error?: string })?.error ?? res.statusText;
      throw new Error(message || 'خطا در دریافت داده‌ها');
    }
    return json.data ?? { items: [], total: 0, page: 1, pageSize: 20 };
  });

function formatDate(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return DATE_FORMATTER.format(parsed);
}

export default function ReviewsAdminView() {
  const [status, setStatus] = useState<'all' | 'pending' | 'published'>('pending');
  const query = status === 'all' ? '' : `?status=${status}`;
  const { data, error, isLoading, mutate } = useSWR<ApiResponse['data']>(`/api/reviews${query}`, fetcher);

  const handleToggleStatus = async (review: ReviewItem) => {
    const nextStatus = review.status === 'published' ? 'pending' : 'published';
    try {
      const response = await fetch(`/api/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const message = (await response.text().catch(() => '')) || response.statusText;
        throw new Error(message || 'به‌روزرسانی انجام نشد');
      }
      toast.success('وضعیت نظر به‌روزرسانی شد.');
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'به‌روزرسانی انجام نشد');
    }
  };

  const items = data?.items ?? [];

  return (
    <Card variant='outlined'>
      <CardContent>
        <Stack direction='row' alignItems='center' justifyContent='space-between' gap={2} flexWrap='wrap'>
          <Box>
            <Typography variant='h6' fontWeight={700}>
              مدیریت نظرات خریداران
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              انتشار یا تعلیق نظرات ثبت‌شده برای محصولات.
            </Typography>
          </Box>
          <Tabs value={status} onChange={(_e, val) => setStatus(val as 'all' | 'pending' | 'published')}>
            <Tab label='همه' value='all' />
            <Tab label='در انتظار' value='pending' />
            <Tab label='منتشر شده' value='published' />
          </Tabs>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {error ? (
          <Alert severity='error'>خطا در دریافت لیست نظرات</Alert>
        ) : isLoading ? (
          <Box display='flex' justifyContent='center' py={6}>
            <CircularProgress size={28} />
          </Box>
        ) : items.length === 0 ? (
          <Alert severity='info'>نظر جدیدی یافت نشد.</Alert>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>محصول</TableCell>
                <TableCell>امتیاز</TableCell>
                <TableCell>متن</TableCell>
                <TableCell>وضعیت</TableCell>
                <TableCell>تاریخ</TableCell>
                <TableCell align='right'>اقدام</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Link href={`/product/${item.productSlug}`} target='_blank'>
                        <Typography fontWeight={700}>{item.productTitle}</Typography>
                      </Link>
                      {item.variantSummary ? (
                        <Typography variant='body2' color='text.secondary'>
                          {item.variantSummary}
                        </Typography>
                      ) : null}
                      {item.orderNumber ? (
                        <Typography variant='caption' color='text.secondary'>
                          سفارش {item.orderNumber}
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction='row' alignItems='center' gap={1}>
                      <Rating value={item.rating} precision={0.5} readOnly size='small' />
                      <Typography variant='body2'>{item.rating.toFixed(1)}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'pre-line' }}>
                      {item.comment ?? 'متنی ثبت نشده است.'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.status === 'published' ? 'منتشر شده' : 'در انتظار'}
                      color={item.status === 'published' ? 'success' : 'default'}
                      size='small'
                    />
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant='caption' color='text.secondary'>
                        ایجاد: {formatDate(item.createdAt)}
                      </Typography>
                      {item.publishedAt ? (
                        <Typography variant='caption' color='text.secondary'>
                          انتشار: {formatDate(item.publishedAt)}
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell align='right'>
                    <Button variant='outlined' size='small' onClick={() => void handleToggleStatus(item)}>
                      {item.status === 'published' ? 'لغو انتشار' : 'انتشار'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
