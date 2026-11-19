
import InvoiceDetailView from '@/views/admin/orders/detail';
import { buildAdminMetadata } from '@/lib/admin-metadata';

const BASE_TITLE = 'جزئیات سفارش';

type RouteParams = {
  id?: string | string[];
};

function resolveId(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) {
    return raw[0] ?? '';
  }
  return raw ?? '';
}

export async function generateMetadata({ params }: { params?: Promise<RouteParams> }) {
  return buildAdminMetadata(BASE_TITLE);
}

export default async function InvoicePage({ params }: { params?: Promise<RouteParams> }) {
  const invoiceId = resolveId((await params)?.id);

  return (

    <InvoiceDetailView invoiceId={invoiceId} />
  );
}
