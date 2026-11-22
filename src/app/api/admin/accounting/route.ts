import { NextRequest, NextResponse } from 'next/server';

import { requirePermission } from '@/lib/auth';
import {
  ACCOUNTING_CHANNELS,
  loadInvoiceLedger,
  loadProductRevenue,
  loadRevenueSummary,
  parseTehranAccountingDay,
  type AccountingChannel,
  type RevenueFilters,
} from '@/services/accounting/revenueService';

export const runtime = 'nodejs';
// Reads live order data; caching it would hand an operator stale money figures.
export const dynamic = 'force-dynamic';

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  return parseTehranAccountingDay(value);
}

function parseChannels(value: string | null): AccountingChannel[] | undefined {
  if (!value) return undefined;
  const wanted = value
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is AccountingChannel =>
      (ACCOUNTING_CHANNELS as readonly string[]).includes(part),
    );
  const supplied = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (wanted.length !== supplied.length) throw new Error('invalid_channel');
  return wanted.length > 0 ? wanted : undefined;
}

export async function GET(request: NextRequest) {
  await requirePermission(request, 'accounting:read');

  const params = request.nextUrl.searchParams;
  let filters: RevenueFilters;
  try {
    filters = {
      from: parseDate(params.get('from')),
      to: parseDate(params.get('to')),
      channels: parseChannels(params.get('channels')),
      invoiceQuery: params.get('q')?.trim().slice(0, 100) || undefined,
      invoiceStatus: params.get('status')?.trim() || undefined,
      invoiceSort: (params.get('sort') as RevenueFilters['invoiceSort']) || undefined,
    };
    if (filters.from && filters.to && filters.from >= filters.to) throw new Error('invalid_range');
  } catch {
    return NextResponse.json({ error: 'بازه تاریخ یا کانال نامعتبر است' }, { status: 400 });
  }

  // One endpoint, three views. The dashboard needs all three for the same date
  // range, and splitting them into separate routes would mean three copies of the
  // filter parsing — and three chances for them to disagree about the range.
  const view = params.get('view') ?? 'summary';
  if (!['summary', 'products', 'invoices', 'dashboard'].includes(view)) {
    return NextResponse.json({ error: 'نمای گزارش نامعتبر است' }, { status: 400 });
  }

  try {
    // The accounting home always needs these three views for one identical
    // filter set. Serving them together removes two authenticated HTTP round
    // trips and guarantees the cards, products and invoice ledger use exactly
    // the same snapshot of the requested range.
    if (view === 'dashboard') {
      const invoiceLimit = Math.min(Math.max(Number(params.get('limit')) || 50, 1), 200);
      const invoiceSkip = Math.max(Number(params.get('skip')) || 0, 0);
      const productLimit = Math.min(Math.max(Number(params.get('productLimit')) || 100, 1), 500);
      const [summary, products, invoices] = await Promise.all([
        loadRevenueSummary(filters),
        loadProductRevenue(filters, productLimit),
        loadInvoiceLedger(filters, invoiceLimit, invoiceSkip),
      ]);
      return NextResponse.json({ data: { summary, products, invoices } });
    }

    if (view === 'products') {
      const limit = Math.min(Math.max(Number(params.get('limit')) || 100, 1), 500);
      return NextResponse.json({ data: await loadProductRevenue(filters, limit) });
    }

    if (view === 'invoices') {
      const limit = Math.min(Math.max(Number(params.get('limit')) || 50, 1), 200);
      const skip = Math.max(Number(params.get('skip')) || 0, 0);
      return NextResponse.json({ data: await loadInvoiceLedger(filters, limit, skip) });
    }

    return NextResponse.json({ data: await loadRevenueSummary(filters) });
  } catch (error) {
    console.error('Accounting report failed', error);
    return NextResponse.json({ error: 'تهیه گزارش با خطا مواجه شد' }, { status: 500 });
  }
}
