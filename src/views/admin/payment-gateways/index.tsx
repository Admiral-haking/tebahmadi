'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { RefreshRounded, SaveRounded } from '@mui/icons-material';
import { toast } from 'sonner';
import type { PaymentGatewayControl } from '@/payments/paymentGatewayControls';

type ApiResponse = { data: PaymentGatewayControl[] };

async function readControls(): Promise<PaymentGatewayControl[]> {
  const response = await fetch('/api/admin/payment-gateways', { credentials: 'include' });
  if (!response.ok) throw new Error('دریافت تنظیمات درگاه‌ها ناموفق بود.');
  return ((await response.json()) as ApiResponse).data;
}

export default function PaymentGatewayControlsView() {
  const [controls, setControls] = useState<PaymentGatewayControl[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setControls(await readControls());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'دریافت تنظیمات ناموفق بود.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const update = (gateway: PaymentGatewayControl['gateway'], key: 'visible' | 'enabled', value: boolean) => {
    setControls((current) =>
      current.map((item) => (item.gateway === gateway ? { ...item, [key]: value } : item)),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/payment-gateways', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          controls: Object.fromEntries(
            controls.map((item) => [item.gateway, { visible: item.visible, enabled: item.enabled }]),
          ),
        }),
      });
      if (!response.ok) throw new Error('ذخیره تنظیمات درگاه‌ها ناموفق بود.');
      setControls(((await response.json()) as ApiResponse).data);
      toast.success('تنظیمات درگاه‌ها ذخیره شد.');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'ذخیره ناموفق بود.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="h4" fontWeight={900}>مدیریت درگاه‌های پرداخت</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              فقط درگاه‌های دارای تنظیمات معتبر در فروشگاه نمایش داده می‌شوند. زرین‌پال عمداً پیش‌فرض خاموش است.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => void load()} disabled={loading || saving}>
              تازه‌سازی
            </Button>
            <Button variant="contained" startIcon={<SaveRounded />} onClick={() => void save()} disabled={loading || saving}>
              {saving ? <CircularProgress size={20} color="inherit" /> : 'ذخیره'}
            </Button>
          </Stack>
        </Stack>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Stack spacing={1.5}>
          {loading ? <CircularProgress sx={{ alignSelf: 'center' }} /> : controls.map((item) => (
            <Card key={item.gateway} variant="outlined">
              <CardContent>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={800}>{item.label}</Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                      <Chip size="small" label={item.configured ? 'تنظیمات موجود است' : 'کلیدها ناقص است'} color={item.configured ? 'success' : 'warning'} />
                      {item.gateway === 'zarinpal' ? <Chip size="small" label="پیش‌فرض خاموش" variant="outlined" /> : null}
                    </Stack>
                  </Box>
                  <Stack direction="row" divider={<Divider orientation="vertical" flexItem />}>
                    <FormControlLabel
                      control={<Switch checked={item.enabled} onChange={(event) => update(item.gateway, 'enabled', event.target.checked)} disabled={!item.configured} />}
                      label="فعال"
                    />
                    <FormControlLabel
                      control={<Switch checked={item.visible} onChange={(event) => update(item.gateway, 'visible', event.target.checked)} disabled={!item.configured} />}
                      label="نمایش به مشتری"
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}
