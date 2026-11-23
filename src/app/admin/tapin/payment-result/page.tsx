import Link from 'next/link';
import { Alert, Button, Card, CardContent, Container, Stack, Typography } from '@mui/material';
import { buildAdminMetadata } from '@/lib/admin-metadata';

export async function generateMetadata() {
  return buildAdminMetadata('نتیجه پرداخت تاپین');
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const value = (key: string) => (typeof params[key] === 'string' ? params[key] : '');
  const success = value('success') === '1';
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">نتیجه افزایش اعتبار تاپین</Typography>
            <Alert severity={success ? 'success' : 'error'}>
              {value('message') || (success ? 'پرداخت با موفقیت ثبت شد.' : 'پرداخت تکمیل نشد.')}
            </Alert>
            {success && (
              <>
                <Typography>فروشگاه: {value('shopTitle') || '—'}</Typography>
                <Typography>
                  مبلغ: {(Number(value('amount')) / 10 || 0).toLocaleString('fa-IR')} تومان
                </Typography>
                <Typography>شناسه پرداخت: {value('tranId') || '—'}</Typography>
              </>
            )}
            <Button component={Link} href="/admin/tapin" variant="contained">
              بازگشت و بررسی تراکنش‌ها
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
