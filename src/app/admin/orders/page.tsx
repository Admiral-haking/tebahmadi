import { Container } from '@mui/material';

import OrdersAdminView from '@/views/admin/orders';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const PAGE_TITLE = 'مدیریت سفارش‌ها و فاکتورها';

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value ?? undefined;
}

function toPageNumber(value: string | undefined): number {
  if (!value) {
    return 1;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 1 : parsed;
}

export async function generateMetadata() {
  return buildAdminMetadata(PAGE_TITLE);
}

export default async function OrdersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const page = toPageNumber(firstValue(resolvedSearchParams?.page));
  const status = firstValue(resolvedSearchParams?.status) ?? null;
  const q = firstValue(resolvedSearchParams?.q) ?? null;

  return (
    <Container maxWidth="lg" sx={{ py: 0 }}>
      <OrdersAdminView page={page} status={status} q={q} />
    </Container>
  );
}
