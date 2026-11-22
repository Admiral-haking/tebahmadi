'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Container,
  MenuItem,
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
import { axiosRequest, safeJson } from '@/utils/axios-request';
type Customer = {
  customer_id: string;
  first_name: string;
  last_name: string;
  mobile: string;
  phone?: string;
  email?: string;
  postal_code?: string;
  state: number;
  city: number;
  category_id?: string;
  created_at: string;
};
type Category = { category_id: string; title: string };
type Shop = { id: string; title: string };
function useTapinCustomersView() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    phone: '',
    email: '',
    postalCode: '',
    state: '',
    city: '',
    createdAt: '',
    categoryId: '',
    shopId: '',
  });
  const [filters, setFilters] = useState(form);
  const load = useCallback(async () => {
    const p = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([key, value]) => value && p.set(key, value));
    const response = await axiosRequest(`/api/admin/tapin/customers?${p}`, {
      credentials: 'include',
      cache: 'no-store',
    });
    const result = await safeJson<{
      data?: {
        customers: { list: Customer[]; total_count: number };
        categories: Category[];
        shops: Shop[];
      };
    }>(response);
    if (!response.ok || result.error || !result.data)
      setError(result.error || 'دریافت مشتریان ناموفق بود.');
    else {
      setRows(result.data.customers.list);
      setTotal(result.data.customers.total_count);
      setCategories(result.data.categories);
      setShops(result.data.shops);
      setError('');
    }
  }, [page, filters]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h4">مشتریان تاپین</Typography>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} gap={1}>
              <TextField
                size="small"
                label="نام"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
              <TextField
                size="small"
                label="تلفن"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <TextField
                size="small"
                label="ایمیل"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <TextField
                size="small"
                label="کد پستی"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              />
              <TextField
                size="small"
                label="کد استان"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
              <TextField
                size="small"
                label="کد شهر"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
              <TextField
                size="small"
                label="تاریخ ایجاد"
                placeholder="1404-01-01"
                value={form.createdAt}
                onChange={(e) => setForm({ ...form, createdAt: e.target.value })}
              />
              <TextField
                size="small"
                label="نام خانوادگی"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
              <TextField
                size="small"
                label="موبایل"
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              />
              <TextField
                select
                size="small"
                label="گروه"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">همه</MenuItem>
                {categories.map((item) => (
                  <MenuItem key={item.category_id} value={item.category_id}>
                    {item.title}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="فروشگاه"
                value={form.shopId}
                onChange={(e) => setForm({ ...form, shopId: e.target.value })}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">پیش‌فرض</MenuItem>
                {shops.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.title}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="outlined"
                onClick={() => {
                  setPage(1);
                  setFilters({ ...form });
                }}
              >
                جست‌وجو
              </Button>
            </Stack>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>نام</TableCell>
                  <TableCell>موبایل</TableCell>
                  <TableCell>ایمیل</TableCell>
                  <TableCell>کد پستی</TableCell>
                  <TableCell>استان/شهر</TableCell>
                  <TableCell>گروه</TableCell>
                  <TableCell>تاریخ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.customer_id}>
                    <TableCell>
                      {row.first_name} {row.last_name}
                    </TableCell>
                    <TableCell dir="ltr">{row.mobile}</TableCell>
                    <TableCell>{row.email || '—'}</TableCell>
                    <TableCell>{row.postal_code || '—'}</TableCell>
                    <TableCell>
                      {row.state}/{row.city}
                    </TableCell>
                    <TableCell>
                      {categories.find((item) => item.category_id === row.category_id)?.title ??
                        '—'}
                    </TableCell>
                    <TableCell>{row.created_at}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" justifyContent="center" gap={1} p={2}>
            <Button disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
              قبل
            </Button>
            <Typography>صفحه {page.toLocaleString('fa-IR')}</Typography>
            <Button disabled={page * 20 >= total} onClick={() => setPage((v) => v + 1)}>
              بعد
            </Button>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

export default function TapinCustomers() {
  return useTapinCustomersView();
}
