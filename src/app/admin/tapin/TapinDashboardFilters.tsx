'use client';

import { Button, Card, CardContent, MenuItem, Stack, TextField } from '@mui/material';
import { TAPIN_STATUS_LABELS as labels } from '@/services/tapin/statuses';

export type TapinFilterValues = {
  orderId: string;
  barcode: string;
  status: string;
  firstName: string;
  lastName: string;
  province: string;
  city: string;
  payType: string;
  orderType: string;
  createdAt: string;
  shopId: string;
};

type Props = {
  query: Pick<TapinFilterValues, 'orderId' | 'barcode' | 'status'>;
  advanced: Omit<TapinFilterValues, 'orderId' | 'barcode' | 'status'>;
  shops: Array<{ id: string; title: string }>;
  onQueryChange: (key: 'orderId' | 'barcode' | 'status', value: string) => void;
  onAdvancedChange: (key: keyof Props['advanced'], value: string) => void;
  onApply: () => void;
  onClear: () => void;
};

export function TapinDashboardFilters({
  query,
  advanced,
  shops,
  onQueryChange,
  onAdvancedChange,
  onApply,
  onClear,
}: Props) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1} alignItems={{ md: 'center' }}>
          <TextField
            size="small"
            label="شناسه سفارش تاپین"
            value={query.orderId}
            onChange={(event) => onQueryChange('orderId', event.target.value.replace(/\D/g, ''))}
          />
          <TextField
            size="small"
            label="بارکد"
            value={query.barcode}
            onChange={(event) => onQueryChange('barcode', event.target.value.trim())}
          />
          <TextField
            select
            size="small"
            label="وضعیت"
            value={query.status}
            onChange={(event) => onQueryChange('status', event.target.value)}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">همه</MenuItem>
            {Object.entries(labels).map(([value, title]) => (
              <MenuItem key={value} value={value}>
                {title}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={onApply}>
            اعمال فیلتر
          </Button>
          <Button onClick={onClear}>پاک‌کردن</Button>
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1} mt={2} flexWrap="wrap">
          {[
            ['firstName', 'نام'],
            ['lastName', 'نام خانوادگی'],
            ['province', 'کد استان'],
            ['city', 'کد شهر'],
            ['createdAt', 'تاریخ ثبت'],
          ].map(([key, label]) => (
            <TextField
              key={key}
              size="small"
              label={label}
              value={advanced[key as keyof typeof advanced]}
              onChange={(event) =>
                onAdvancedChange(key as keyof typeof advanced, event.target.value)
              }
            />
          ))}
          <TextField
            select
            size="small"
            label="نوع پرداخت"
            value={advanced.payType}
            onChange={(event) => onAdvancedChange('payType', event.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="">همه</MenuItem>
            <MenuItem value="1">آنلاین</MenuItem>
            <MenuItem value="2">پس‌کرایه</MenuItem>
            <MenuItem value="3">اعتباری</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="نوع سفارش"
            value={advanced.orderType}
            onChange={(event) => onAdvancedChange('orderType', event.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="">همه</MenuItem>
            <MenuItem value="1">پستی</MenuItem>
            <MenuItem value="3">تیپاکس</MenuItem>
            <MenuItem value="5">باربری</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="فروشگاه"
            value={advanced.shopId}
            onChange={(event) => onAdvancedChange('shopId', event.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">همه</MenuItem>
            {shops.map((shop) => (
              <MenuItem key={shop.id} value={shop.id}>
                {shop.title}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </CardContent>
    </Card>
  );
}
