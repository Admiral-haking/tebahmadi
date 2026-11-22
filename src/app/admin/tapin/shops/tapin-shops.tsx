'use client';

import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  FormControlLabel,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'sonner';
import { axiosRequest, safeJson } from '@/utils/axios-request';

type Shop = { id: string; title: string };
type Form = Record<string, string> & { is_legal_shop: string };
const initial: Form = { is_legal_shop: 'false' };
const fields = [
  ['shop_name', 'نام فروشگاه'],
  ['first_name', 'نام مدیر'],
  ['last_name', 'نام خانوادگی مدیر'],
  ['email', 'ایمیل'],
  ['father_name', 'نام پدر'],
  ['phone', 'تلفن'],
  ['mobile', 'موبایل'],
  ['birth_date', 'تاریخ تولد میلادی (YYYY-MM-DD)'],
  ['certificate_code', 'شماره شناسنامه'],
  ['certificate_serial_number', 'سریال شناسنامه'],
  ['birthday_location', 'محل تولد'],
  ['national_code', 'کد ملی'],
  ['address', 'آدرس'],
  ['province', 'کد استان'],
  ['city', 'کد شهر'],
  ['postal_code', 'کد پستی'],
  ['unit', 'واحد'],
  ['floor', 'طبقه'],
  ['plaque', 'پلاک'],
  ['latitude', 'عرض جغرافیایی'],
  ['longitude', 'طول جغرافیایی'],
  ['website', 'وب‌سایت'],
  ['available_hours', 'ساعات کاری'],
  ['instagram_id', 'شناسه اینستاگرام'],
  ['shop_description', 'توضیحات'],
] as const;
const legalFields = [
  ['company_name', 'نام شرکت'],
  ['economic_code', 'کد اقتصادی'],
  ['company_national_code', 'شناسه ملی شرکت'],
  ['register_code', 'شناسه ثبت شرکت'],
] as const;

async function imageData(event: ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return '';
  if (file.size > 1_000_000) throw new Error('حداکثر حجم تصویر یک مگابایت است.');
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TapinShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [detail, setDetail] = useState<Record<string, unknown>>();
  const [form, setForm] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await axiosRequest('/api/admin/tapin/shops', { credentials: 'include' });
    const result = await safeJson<{ data?: { list: Shop[] } }>(response);
    if (response.ok && result.data) setShops(result.data.list);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const show = async (id: string) => {
    const response = await axiosRequest(`/api/admin/tapin/shops?shopId=${encodeURIComponent(id)}`, {
      credentials: 'include',
    });
    const result = await safeJson<{ data?: Record<string, unknown> }>(response);
    if (response.ok && result.data) setDetail(result.data);
    else toast.error(result.error || 'دریافت جزئیات ناموفق بود.');
  };
  const setImage = async (key: string, event: ChangeEvent<HTMLInputElement>) => {
    try {
      const data = await imageData(event);
      setForm((old) => ({ ...old, [key]: data }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تصویر نامعتبر است.');
    }
  };
  const submit = async () => {
    setBusy(true);
    const numeric = new Set(['province', 'city', 'latitude', 'longitude']);
    const body = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        key === 'is_legal_shop'
          ? value === 'true'
          : numeric.has(key)
            ? Number(value)
            : value || undefined,
      ]),
    );
    const response = await axiosRequest('/api/admin/tapin/shops', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await safeJson<{ data?: { id: string } }>(response);
    if (!response.ok || result.error)
      toast.error(typeof result.error === 'string' ? result.error : 'اطلاعات فرم معتبر نیست.');
    else {
      toast.success(`فروشگاه با شناسه ${result.data?.id} ثبت شد.`);
      setForm(initial);
      await load();
    }
    setBusy(false);
  };
  const legal = form.is_legal_shop === 'true';
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="h4">فروشگاه‌های تاپین</Typography>
          <Button component={Link} href="/admin/tapin">
            بازگشت
          </Button>
        </Stack>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              فروشگاه‌های متصل
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              {shops.map((shop) => (
                <Button key={shop.id} variant="outlined" onClick={() => void show(shop.id)}>
                  {shop.title}
                </Button>
              ))}
            </Stack>
            {detail && (
              <Alert severity="info" sx={{ mt: 2 }}>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(detail, null, 2)}</pre>
              </Alert>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              ثبت فروشگاه جدید
            </Typography>
            <Grid container spacing={2}>
              {fields.map(([name, label]) => (
                <Grid
                  key={name}
                  size={{ xs: 12, md: name === 'address' || name === 'shop_description' ? 12 : 6 }}
                >
                  <TextField
                    fullWidth
                    label={label}
                    value={form[name] || ''}
                    multiline={name === 'address' || name === 'shop_description'}
                    onChange={(e) => setForm((old) => ({ ...old, [name]: e.target.value }))}
                  />
                </Grid>
              ))}
              <Grid size={{ xs: 12, md: 6 }}>
                <Button component="label" variant="outlined">
                  انتخاب لوگو
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(e) => void setImage('logo_image', e)}
                  />
                </Button>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Button component="label" variant="outlined">
                  تصویر کارت ملی
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(e) => void setImage('id_cart_image', e)}
                  />
                </Button>
              </Grid>
              <Grid size={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={legal}
                      onChange={(e) =>
                        setForm((old) => ({ ...old, is_legal_shop: String(e.target.checked) }))
                      }
                    />
                  }
                  label="فروشگاه حقوقی است"
                />
              </Grid>
              {legalFields.map(
                ([name, label]) =>
                  legal && (
                    <Grid key={name} size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        label={label}
                        value={form[name] || ''}
                        onChange={(e) => setForm((old) => ({ ...old, [name]: e.target.value }))}
                      />
                    </Grid>
                  ),
              )}
              <Grid size={12}>
                <Button variant="contained" disabled={busy} onClick={() => void submit()}>
                  ثبت فروشگاه
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
