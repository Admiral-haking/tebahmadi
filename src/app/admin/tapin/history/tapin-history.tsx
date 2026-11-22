'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  TextField,
  MenuItem,
} from '@mui/material';
import { axiosRequest, safeJson } from '@/utils/axios-request';

type Transaction = {
  id: string;
  price: number;
  pay_type_description: string;
  status: number;
  status_description: string;
  create_at: string;
};
type Task = { id: string; task_type: number; task_status: number; created_at: string };
type Result<T> = { list: T[]; total_count: number };
type Shop = { id: string; title: string };
const taskTypes: Record<number, string> = {
  0: 'ورودی اکسل',
  1: 'تغییر وضعیت گروهی',
  2: 'خروجی اکسل',
  3: 'خروجی PDF',
  4: 'ثبت گروهی',
};
const taskStatuses: Record<number, string> = {
  0: 'ثبت شده',
  1: 'در حال بررسی',
  2: 'در حال انجام',
  3: 'تکمیل شده',
  4: 'خطا',
};

function useTapinHistoryView() {
  const [tab, setTab] = useState<'transactions' | 'tasks'>('transactions');
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState<Result<Transaction>>({
    list: [],
    total_count: 0,
  });
  const [tasks, setTasks] = useState<Result<Task>>({ list: [], total_count: 0 });
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState('');
  useEffect(() => {
    void (async () => {
      const response = await axiosRequest('/api/admin/tapin/shops', { credentials: 'include' });
      const result = await safeJson<{ data?: { list: Shop[] } }>(response);
      if (response.ok && result.data) setShops(result.data.list);
    })();
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams({ page: String(page), count: '20' });
    if (tab === 'transactions' && shopId) query.set('shopId', shopId);
    const response = await axiosRequest(`/api/admin/tapin/${tab}?${query}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    const result = await safeJson<{ data?: Result<Transaction | Task> }>(response);
    if (!response.ok || result.error || !result.data)
      setError(typeof result.error === 'string' ? result.error : 'دریافت تاریخچه ناموفق بود.');
    else {
      setError('');
      if (tab === 'transactions') setTransactions(result.data as Result<Transaction>);
      else setTasks(result.data as Result<Task>);
    }
    setLoading(false);
  }, [page, shopId, tab]);
  useEffect(() => {
    void load();
  }, [load]);
  const showTask = async (id: string) => {
    const response = await axiosRequest(`/api/admin/tapin/tasks/${encodeURIComponent(id)}`, {
      credentials: 'include',
    });
    const result = await safeJson<{ data?: Record<string, unknown> }>(response);
    if (response.ok && result.data) setDetail(result.data);
    else setError(typeof result.error === 'string' ? result.error : 'دریافت جزئیات ناموفق بود.');
  };
  const downloadDetail = () => {
    if (!detail) return;
    const blob = new Blob([JSON.stringify(detail, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tapin-task-${String(detail.id || 'result')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const total = tab === 'transactions' ? transactions.total_count : tasks.total_count;
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="h4">تاریخچه تاپین</Typography>
          <Button component={Link} href="/admin/tapin">
            بازگشت
          </Button>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        <Card>
          <CardContent>
            <Tabs
              value={tab}
              onChange={(_, value) => {
                setTab(value);
                setPage(1);
              }}
            >
              <Tab value="transactions" label="تراکنش‌ها" />
              <Tab value="tasks" label="Taskها" />
            </Tabs>
            {tab === 'transactions' && (
              <TextField
                select
                size="small"
                label="فروشگاه"
                value={shopId}
                onChange={(event) => {
                  setShopId(event.target.value);
                  setPage(1);
                }}
                sx={{ minWidth: 220, my: 2 }}
              >
                <MenuItem value="">پیش‌فرض</MenuItem>
                {shops.map((shop) => (
                  <MenuItem key={shop.id} value={shop.id}>
                    {shop.title}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <Table size="small">
              <TableHead>
                <TableRow>
                  {tab === 'transactions' ? (
                    <>
                      <TableCell>مبلغ</TableCell>
                      <TableCell>روش</TableCell>
                      <TableCell>وضعیت</TableCell>
                      <TableCell>تاریخ</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>نوع</TableCell>
                      <TableCell>وضعیت</TableCell>
                      <TableCell>تاریخ</TableCell>
                      <TableCell>جزئیات</TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {tab === 'transactions'
                  ? transactions.list.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {Math.round(item.price / 10).toLocaleString('fa-IR')} تومان
                        </TableCell>
                        <TableCell>{item.pay_type_description}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={item.status === 1 ? 'success' : 'default'}
                            label={item.status_description}
                          />
                        </TableCell>
                        <TableCell>{item.create_at}</TableCell>
                      </TableRow>
                    ))
                  : tasks.list.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{taskTypes[item.task_type] ?? item.task_type}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={
                              item.task_status === 4
                                ? 'error'
                                : item.task_status === 3
                                  ? 'success'
                                  : 'default'
                            }
                            label={taskStatuses[item.task_status] ?? item.task_status}
                          />
                        </TableCell>
                        <TableCell>{item.created_at}</TableCell>
                        <TableCell>
                          <Button size="small" onClick={() => void showTask(item.id)}>
                            نمایش
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
            {!loading && total === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                رکوردی وجود ندارد.
              </Alert>
            )}
            <Stack direction="row" justifyContent="center" alignItems="center" gap={1} mt={2}>
              <Button disabled={loading || page === 1} onClick={() => setPage((old) => old - 1)}>
                قبلی
              </Button>
              <Typography>
                صفحه {page.toLocaleString('fa-IR')} از{' '}
                {Math.max(1, Math.ceil(total / 20)).toLocaleString('fa-IR')}
              </Typography>
              <Button
                disabled={loading || page * 20 >= total}
                onClick={() => setPage((old) => old + 1)}
              >
                بعدی
              </Button>
            </Stack>
          </CardContent>
        </Card>
        <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="md">
          <DialogTitle>جزئیات Task</DialogTitle>
          <DialogContent>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {JSON.stringify(detail, null, 2)}
            </pre>
          </DialogContent>
          <DialogActions>
            <Button onClick={downloadDetail}>دریافت نتیجه</Button>
            <Button onClick={() => setDetail(null)}>بستن</Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Container>
  );
}

export default function TapinHistory() {
  return useTapinHistoryView();
}
