'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { Alert, Box, Button, Chip, CircularProgress, Container, Divider, Fade, Paper, Stack, Typography } from '@mui/material';

import OrdersTable, { type OrdersTableInvoice } from './components/OrdersTable';
import OrderMetrics, { type StatusMetric } from './components/OrderMetrics';
import StatusFilterChips from './components/StatusFilterChips';
import SearchBox from '@/components/search';
import Splash from '@/components/splash';
import { formatToman, INVOICE_STATUSES, type InvoiceStatus } from './constants';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

export interface OrdersAdminViewProps {
  page?: number;
  status?: string | null;
  q?: string | null;
}

interface OrdersApiResponse {
  invoices: OrdersTableInvoice[];
  page: number;
  pages: number;
  totalCount: number;
  totalRevenue: number;
  statusMetrics: StatusMetric[];
  currentStatus: 'all' | InvoiceStatus;
  operationMetrics?: {
    paidWithoutProgress: number;
    packagedWithoutTracking: number;
  };
}

const fetcher = async (url: string): Promise<OrdersApiResponse> => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const message = (await response.text().catch(() => '')) || response.statusText;
    throw new Error(message || 'خطا در دریافت سفارش‌ها');
  }
  return response.json();
};

function normalizePage(value?: number): number {
  if (!value || Number.isNaN(value) || value < 1) {
    return 1;
  }
  return Math.floor(value);
}

function normalizeStatus(value?: string | null): 'all' | InvoiceStatus {
  if (!value) return 'all';
  return (INVOICE_STATUSES.includes(value as InvoiceStatus) ? value : 'all') as 'all' | InvoiceStatus;
}

export default function OrdersAdminView({ page = 1, status, q }: OrdersAdminViewProps) {
  const currentPage = normalizePage(page);
  const currentStatus = normalizeStatus(status);
  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', currentPage.toString());
    if (currentStatus !== 'all') {
      params.set('status', currentStatus);
    }
    const query = q?.trim();
    if (query) {
      params.set('q', query);
    }
    return `/api/admin/orders?${params.toString()}`;
  }, [currentPage, currentStatus, q]);

  const { data, error, isLoading, mutate } = useSWR(endpoint, fetcher, {
    keepPreviousData: true,
  });

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
        <Splash />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
        <Alert severity="error">
          {error instanceof Error ? error.message : 'خطا در دریافت سفارش‌ها'}
        </Alert>
      </Container>
    );
  }

  const totalCount = data?.totalCount ?? 0;
  const totalRevenue = data?.totalRevenue ?? 0;
  const metrics = data?.statusMetrics ?? INVOICE_STATUSES.map<StatusMetric>((statusKey) => ({
    status: statusKey,
    count: 0,
    revenue: 0,
  }));
  const invoices = data?.invoices ?? [];
  const pages = data?.pages ?? 1;
  const resolvedStatus = data?.currentStatus ?? currentStatus;
  const operationMetrics = data?.operationMetrics ?? {
    paidWithoutProgress: 0,
    packagedWithoutTracking: 0,
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack spacing={2.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <div>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              مدیریت سفارش‌ها و فاکتورها
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {`تا کنون ${totalCount.toLocaleString('fa-IR')} سفارش پردازش شده و ${formatToman(totalRevenue)} ثبت شده است.`}
            </Typography>
          </div>
        </Stack>

        <OrderMetrics totalCount={totalCount} metrics={metrics} />

        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.25, md: 1.5 },
            borderRadius: 2,
            border: 1,
            borderColor:
              operationMetrics.paidWithoutProgress || operationMetrics.packagedWithoutTracking
                ? 'warning.light'
                : 'divider',
            bgcolor:
              operationMetrics.paidWithoutProgress || operationMetrics.packagedWithoutTracking
                ? 'rgba(var(--mui-palette-warning-mainChannel) / 0.08)'
                : 'background.paper',
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} gap={1} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
            <Stack>
              <Typography variant="subtitle2" fontWeight={900}>
                وضعیت عملیاتی سفارش‌ها
              </Typography>
              <Typography variant="caption" color="text.secondary">
                سفارش‌هایی که بعد از پرداخت هنوز نیاز به اقدام دارند.
              </Typography>
            </Stack>
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Chip
                color={operationMetrics.paidWithoutProgress ? 'warning' : 'success'}
                variant={operationMetrics.paidWithoutProgress ? 'filled' : 'outlined'}
                label={`پرداخت‌شده بدون آماده‌سازی: ${operationMetrics.paidWithoutProgress.toLocaleString('fa-IR')}`}
              />
              <Chip
                color={operationMetrics.packagedWithoutTracking ? 'warning' : 'success'}
                variant={operationMetrics.packagedWithoutTracking ? 'filled' : 'outlined'}
                label={`ارسال‌شده بدون کد رهگیری: ${operationMetrics.packagedWithoutTracking.toLocaleString('fa-IR')}`}
              />
            </Stack>
          </Stack>
        </Paper>

        <Box
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'background.paper',
            p: { xs: 1.25, md: 1.5 },
          }}
        >
          <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
              >
                <SearchBox
                  onSearchUrl="/admin/orders"
                  initialQuery={q ?? ''}
                  preserveQueryParams
                  placeholder="جستجو بر اساس کد سفارش، نام، تلفن یا کد تراکنش"
                />
                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={isLoading ? <CircularProgress size={14} /> : <RefreshRoundedIcon />}
                    onClick={() => void mutate()}
                    disabled={isLoading}
                  >
                    {isLoading ? "در حال بارگیری…" : "بروزرسانی"}
                  </Button>
                  <StatusFilterChips currentStatus={resolvedStatus} query={q ?? undefined} />
                </Stack>
              </Stack>
              <Divider />
              <Fade in={!isLoading} timeout={250}>
                <Box>
                  <OrdersTable invoices={invoices} page={currentPage} pages={pages} onRefresh={() => void mutate()} />
                </Box>
              </Fade>
          </Stack>
        </Box>
      </Stack>
    </Container>
  );
}
