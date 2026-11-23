'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Checkbox,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'sonner';
import { axiosRequest, safeJson } from '@/utils/axios-request';
import {
  fetchTapinOverview,
  fetchTapinStatusReport,
  fetchTapinTask,
  runTapinSync,
} from '@/services/tapin/dashboard.api';
import { TAPIN_STATUS_LABELS as labels } from '@/services/tapin/statuses';
import { TapinDashboardHeader } from './TapinDashboardHeader';
import { TapinDashboardStats } from './TapinDashboardStats';
import { TapinDashboardAlerts } from './TapinDashboardAlerts';
import { TapinDashboardFilters, type TapinFilterValues } from './TapinDashboardFilters';
import { TapinDashboardDataSections } from './TapinDashboardDataSections';
import { type TapinOverview } from './tapin-dashboard.types';

function useTapinDashboardView() {
  const [data, setData] = useState<TapinOverview>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [orderId, setOrderId] = useState('');
  const [barcode, setBarcode] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [advanced, setAdvanced] = useState<
    Omit<TapinFilterValues, 'orderId' | 'barcode' | 'status'>
  >({
    firstName: '',
    lastName: '',
    province: '',
    city: '',
    payType: '',
    orderType: '',
    createdAt: '',
    shopId: '',
  });
  const [filters, setFilters] = useState<TapinFilterValues>({
    orderId: '',
    barcode: '',
    status: '',
    firstName: '',
    lastName: '',
    province: '',
    city: '',
    payType: '',
    orderType: '',
    createdAt: '',
    shopId: '',
  });
  const [creditAmount, setCreditAmount] = useState('');
  const [taskDetail, setTaskDetail] = useState<Record<string, unknown> | null>(null);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({ page: String(page) });
    if (filters.orderId) query.set('orderId', filters.orderId);
    if (filters.barcode) query.set('barcode', filters.barcode);
    if (filters.status) query.set('status', filters.status);
    for (const [key, value] of Object.entries(filters))
      if (value && !query.has(key)) query.set(key, value);
    const { response, result } = await fetchTapinOverview<TapinOverview>(query);
    if (!response.ok || result.error || !result.data)
      setError(result.error || 'دریافت اطلاعات ناموفق بود.');
    else {
      setData(result.data);
      setError('');
    }
    setLoading(false);
  }, [page, filters]);
  useEffect(() => {
    void load();
  }, [load]);
  const sync = async () => {
    setLoading(true);
    const { response, result } = await runTapinSync<{ checked: number; updated: number }>();
    if (!response.ok || result.error) toast.error(result.error || 'همگام‌سازی ناموفق بود.');
    else
      toast.success(
        `${result.data?.checked ?? 0} مرسوله بررسی و ${result.data?.updated ?? 0} مورد به‌روز شد.`,
      );
    await load();
  };
  const retryFailedSync = async () => {
    setLoading(true);
    const { response, result } = await runTapinSync<{
      checked: number;
      updated: number;
      failed: number;
    }>('retry-failed');
    if (!response.ok || result.error) toast.error(result.error || 'تطبیق مجدد تاپین ناموفق بود.');
    else
      toast.success(
        `${result.data?.checked ?? 0} مورد دوباره بررسی شد؛ ${result.data?.failed ?? 0} مورد هنوز خطا دارد.`,
      );
    await load();
  };
  const bulkStatus = async (status: 1 | 2 | 80) => {
    if (!selected.length) return;
    if (!window.confirm(`وضعیت ${selected.length.toLocaleString('fa-IR')} مرسوله تغییر کند؟`))
      return;
    setLoading(true);
    const response = await axiosRequest('/api/admin/tapin/bulk-status', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selected, status, shopId: advanced.shopId || undefined }),
    });
    const result = await safeJson(response);
    if (!response.ok || result.error) toast.error(result.error || 'عملیات گروهی ناموفق بود.');
    else {
      const syncResult = result.sync as { updated?: number; failed?: number } | undefined;
      toast.success(
        `درخواست ثبت شد؛ وضعیت داخلی ${syncResult?.updated ?? 0} مرسوله به‌روزرسانی شد` +
          (syncResult?.failed ? ` و ${syncResult.failed} مورد نیازمند بررسی است.` : '.'),
      );
      setSelected([]);
    }
    await load();
  };
  const createCreditPayment = async () => {
    const toman = Number(creditAmount);
    if (!Number.isFinite(toman) || toman < 1_000) return toast.error('حداقل مبلغ ۱٬۰۰۰ تومان است.');
    if (!window.confirm(`${toman.toLocaleString('fa-IR')} تومان به کیف پول افزوده شود؟`)) return;
    const response = await axiosRequest('/api/admin/tapin/credit-payment', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: Math.round(toman * 10), shopId: advanced.shopId || undefined }),
    });
    const result = await safeJson<{ data?: { url: string } }>(response);
    if (!response.ok || result.error || !result.data?.url)
      return toast.error(result.error || 'ساخت لینک پرداخت ناموفق بود.');
    window.location.assign(result.data.url);
  };
  const showTask = async (id: string) => {
    const { response, result } = await fetchTapinTask<Record<string, unknown>>(id);
    if (!response.ok || result.error || !result.data)
      toast.error(result.error || 'دریافت Task ناموفق بود.');
    else setTaskDetail(result.data);
  };
  const downloadExport = async (type: 'labels' | 'barcodes' | 'invoices') => {
    const orderIds = (data?.remote.list ?? [])
      .filter((item) => selected.includes(item.id))
      .map((item) => item.order_id);
    if (type === 'invoices' && !orderIds.length) return toast.error('حداقل یک مرسوله انتخاب کنید.');
    if (type !== 'invoices' && (!exportFrom || !exportTo))
      return toast.error('بازه تاریخ را وارد کنید.');
    const response = await axiosRequest('/api/admin/tapin/exports', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        type === 'invoices'
          ? { type, orderIds, shopId: advanced.shopId || undefined }
          : {
              type,
              fromDate: exportFrom,
              toDate: exportTo,
              shopId: advanced.shopId || undefined,
            },
      ),
    });
    if (!response.ok) {
      const result = await safeJson(response);
      return toast.error(result.error || 'دریافت خروجی ناموفق بود.');
    }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tapin-${type}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const querySelectedStatuses = async () => {
    if (!selected.length) return toast.error('حداقل یک مرسوله انتخاب کنید.');
    const response = await axiosRequest('/api/admin/tapin/bulk-status/query', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selected, shopId: advanced.shopId || undefined }),
    });
    const result = await safeJson<{ data?: Record<string, unknown> }>(response);
    if (!response.ok || result.error || !result.data)
      toast.error(typeof result.error === 'string' ? result.error : 'دریافت وضعیت‌ها ناموفق بود.');
    else setTaskDetail(result.data);
  };
  const showStatusReport = async () => {
    if (!exportFrom || !exportTo) return toast.error('بازه تاریخ را وارد کنید.');
    const query = new URLSearchParams({ fromDate: exportFrom, toDate: exportTo });
    if (advanced.shopId) query.set('shopId', advanced.shopId);
    const { response, result } = await fetchTapinStatusReport<Record<string, unknown>>(query);
    if (!response.ok || result.error || !result.data)
      toast.error(typeof result.error === 'string' ? result.error : 'دریافت گزارش ناموفق بود.');
    else setTaskDetail(result.data);
  };
  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <TapinDashboardHeader
          loading={loading}
          syncFailures={data?.syncFailures}
          onSync={sync}
          onRetry={retryFailedSync}
        />
        <TapinDashboardAlerts
          error={error}
          warnings={data?.warnings}
          syncHealth={data?.syncHealth}
        />
        <TapinDashboardFilters
          query={{ orderId, barcode, status: statusFilter }}
          advanced={advanced}
          shops={data?.shops.list ?? []}
          onQueryChange={(key, value) => {
            if (key === 'orderId') setOrderId(value);
            if (key === 'barcode') setBarcode(value);
            if (key === 'status') setStatusFilter(value);
          }}
          onAdvancedChange={(key, value) => setAdvanced((old) => ({ ...old, [key]: value }))}
          onApply={() => {
            setPage(1);
            setFilters({ orderId, barcode, status: statusFilter, ...advanced });
          }}
          onClear={() => {
            setOrderId('');
            setBarcode('');
            setStatusFilter('');
            const empty = {
              firstName: '',
              lastName: '',
              province: '',
              city: '',
              payType: '',
              orderType: '',
              createdAt: '',
              shopId: '',
            };
            setAdvanced(empty);
            setFilters({ orderId: '', barcode: '', status: '', ...empty });
          }}
        />
        <TapinDashboardStats
          items={[
            [
              'اعتبار کیف پول',
              `${Math.round((data?.credit ?? 0) / 10).toLocaleString('fa-IR')} تومان`,
            ],
            ['مرسوله‌های متصل', (data?.linked ?? 0).toLocaleString('fa-IR')],
            ['مرسوله‌های فعال', (data?.active ?? 0).toLocaleString('fa-IR')],
            ['خطاهای همگام‌سازی', (data?.syncFailures ?? 0).toLocaleString('fa-IR')],
            ['کل مرسوله‌های تاپین', (data?.remote.total_count ?? 0).toLocaleString('fa-IR')],
            ['مشتریان تاپین', (data?.customers.total_count ?? 0).toLocaleString('fa-IR')],
            ['کارکنان تاپین', (data?.employees.total_count ?? 0).toLocaleString('fa-IR')],
          ]}
        />
        {data?.shop ? (
          <Alert severity={data.shop.status_display === 'فعال' ? 'success' : 'warning'}>
            فروشگاه «{data.shop.title}» — {data.shop.status_display || 'وضعیت نامشخص'} — مدیر:{' '}
            {data.shop.owner_first_name} {data.shop.owner_last_name} ({data.shop.owner_mobile})
          </Alert>
        ) : null}
        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems={{ sm: 'center' }}>
              <Typography fontWeight={700}>افزایش اعتبار کیف پول</Typography>
              <TextField
                size="small"
                type="number"
                label="مبلغ (تومان)"
                value={creditAmount}
                onChange={(event) => setCreditAmount(event.target.value)}
              />
              <Button variant="contained" onClick={createCreditPayment}>
                رفتن به درگاه تاپین
              </Button>
            </Stack>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" mb={2}>
              آخرین مرسوله‌ها
            </Typography>
            <Stack direction="row" gap={1} mb={2} flexWrap="wrap">
              <Button
                size="small"
                disabled={!selected.length || loading}
                onClick={() => bulkStatus(1)}
              >
                آماده چاپ گروهی
              </Button>
              <Button
                size="small"
                disabled={!selected.length || loading}
                onClick={() => bulkStatus(2)}
              >
                آماده ارسال گروهی
              </Button>
              <Button
                size="small"
                color="error"
                disabled={!selected.length || loading}
                onClick={() => bulkStatus(80)}
              >
                حذف گروهی
              </Button>
              <Button
                size="small"
                disabled={!selected.length}
                onClick={() => void downloadExport('invoices')}
              >
                فاکتور گروهی
              </Button>
              <Button
                size="small"
                disabled={!selected.length}
                onClick={() => void querySelectedStatuses()}
              >
                استعلام وضعیت انتخاب‌ها
              </Button>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} mb={2}>
              <TextField
                size="small"
                label="از تاریخ شمسی"
                placeholder="1404-01-01"
                value={exportFrom}
                onChange={(event) => setExportFrom(event.target.value)}
              />
              <TextField
                size="small"
                label="تا تاریخ شمسی"
                placeholder="1404-01-31"
                value={exportTo}
                onChange={(event) => setExportTo(event.target.value)}
              />
              <Button variant="outlined" onClick={() => void downloadExport('labels')}>
                لیبل‌های بازه
              </Button>
              <Button variant="outlined" onClick={() => void downloadExport('barcodes')}>
                بارکدهای بازه
              </Button>
              <Button variant="outlined" onClick={() => void showStatusReport()}>
                گزارش تغییر وضعیت
              </Button>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>شناسه</TableCell>
                    <TableCell>گیرنده</TableCell>
                    <TableCell>موبایل</TableCell>
                    <TableCell>بارکد</TableCell>
                    <TableCell>وضعیت</TableCell>
                    <TableCell>تاریخ</TableCell>
                    <TableCell>اقلام</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.remote.list ?? []).map((order) => (
                    <TableRow key={order.id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={selected.includes(order.id)}
                          onChange={(event) =>
                            setSelected((items) =>
                              event.target.checked
                                ? [...items, order.id]
                                : items.filter((id) => id !== order.id),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>{order.order_id}</TableCell>
                      <TableCell>
                        {order.first_name} {order.last_name}
                      </TableCell>
                      <TableCell dir="ltr">{order.mobile}</TableCell>
                      <TableCell dir="ltr">{order.barcode || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={labels[order.status] ?? `کد ${order.status}`} />
                      </TableCell>
                      <TableCell>{order.created_at}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          component="a"
                          target="_blank"
                          href={`/api/admin/tapin/order-items/${order.order_id}`}
                        >
                          اقلام
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {!loading && !data?.remote.list.length ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                مرسوله‌ای وجود ندارد. برای ثبت، از <Link href="/admin/orders">سفارش‌ها</Link> وارد
                جزئیات سفارش شوید.
              </Alert>
            ) : null}
            <Stack direction="row" justifyContent="center" alignItems="center" gap={1} mt={2}>
              <Button disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>
                صفحه قبل
              </Button>
              <Typography variant="body2">صفحه {page.toLocaleString('fa-IR')}</Typography>
              <Button
                disabled={loading || page * 20 >= (data?.remote.total_count ?? 0)}
                onClick={() => setPage((value) => value + 1)}
              >
                صفحه بعد
              </Button>
            </Stack>
          </CardContent>
        </Card>
        <TapinDashboardDataSections
          data={data}
          loading={loading}
          onTaskClick={(id) => void showTask(id)}
        />
        <Dialog
          open={Boolean(taskDetail)}
          onClose={() => setTaskDetail(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>جزئیات Task تاپین</DialogTitle>
          <DialogContent>
            <Typography
              component="pre"
              dir="ltr"
              sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13 }}
            >
              {taskDetail ? JSON.stringify(taskDetail, null, 2) : ''}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTaskDetail(null)}>بستن</Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Container>
  );
}

export default function TapinDashboard() {
  return useTapinDashboardView();
}
