import Link from 'next/link';
import { memo } from 'react';
import { Button, Stack, Typography } from '@mui/material';

type Props = { loading: boolean; syncFailures?: number; onSync: () => void; onRetry: () => void };

export const TapinDashboardHeader = memo(function TapinDashboardHeader({
  loading,
  syncFailures,
  onSync,
  onRetry,
}: Props) {
  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={1.5}>
      <Typography variant="h4">مدیریت تاپین</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} flexWrap="wrap">
        {[
          ['/admin/tapin/products', 'محصولات تاپین'],
          ['/admin/tapin/customers', 'مشتریان تاپین'],
          ['/admin/tapin/shops', 'فروشگاه‌ها'],
          ['/admin/tapin/history', 'تاریخچه کامل'],
        ].map(([href, label]) => (
          <Button key={href} component={Link} href={href} variant="outlined">
            {label}
          </Button>
        ))}
        <Button variant="contained" disabled={loading} onClick={onSync}>
          همگام‌سازی اکنون
        </Button>
        <Button
          variant="outlined"
          color="warning"
          disabled={loading || !syncFailures}
          onClick={onRetry}
        >
          retry / تطبیق خطاها
        </Button>
      </Stack>
    </Stack>
  );
});
