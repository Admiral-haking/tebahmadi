import { useCallback, useEffect, useMemo, useState } from 'react';
import { axiosRequest } from '@/utils/axios-request';
import type { ChannelKey, InvoiceRow, ProductRow, Summary } from './accounting-types';

export function isoDay(offsetDays: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '01';
  const date = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00+03:30`);
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function useAccounting() {
  const [from, setFrom] = useState(isoDay(-30));
  const [to, setTo] = useState(isoDay(1));
  const [channels, setChannels] = useState<ChannelKey[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [invoices, setInvoices] = useState<{ rows: InvoiceRow[]; total: number }>({
    rows: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [invoicePage, setInvoicePage] = useState(0);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [invoiceSort, setInvoiceSort] = useState('financial_desc');
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (channels.length) params.set('channels', channels.join(','));
    if (invoiceSearch) params.set('q', invoiceSearch);
    if (invoiceStatus) params.set('status', invoiceStatus);
    params.set('sort', invoiceSort);
    return params.toString();
  }, [from, to, channels, invoiceSearch, invoiceStatus, invoiceSort]);
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axiosRequest(
        `/api/admin/accounting?${query}&view=dashboard&limit=50&skip=${invoicePage * 50}&productLimit=100`,
        { credentials: 'include', cache: 'no-store' },
      );
      if (!response.ok) throw new Error('تهیه گزارش با خطا مواجه شد');
      const result = (await response.json()).data;
      setSummary(result?.summary ?? null);
      setProducts(result?.products ?? []);
      setInvoices(result?.invoices ?? { rows: [], total: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تهیه گزارش با خطا مواجه شد');
    } finally {
      setLoading(false);
    }
  }, [query, invoicePage]);
  const requestRefund = async (invoice: InvoiceRow) => {
    if (!window.confirm(`بازپرداخت کامل فاکتور ${invoice.number} انجام شود؟`)) return;
    setError(null);
    const response = await axiosRequest('/api/admin/accounting/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'refund', invoiceId: invoice.id, amount: invoice.grandTotal }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error || 'ثبت بازپرداخت ناموفق بود');
      return;
    }
    await load();
  };
  useEffect(() => {
    void load();
  }, [load]);
  const maxChannelRevenue = Math.max(
    1,
    ...(summary?.channels ?? []).map((channel) => channel.revenue),
  );
  const maxProductRevenue = Math.max(1, ...products.map((product) => product.revenue));
  return {
    from,
    setFrom,
    to,
    setTo,
    channels,
    setChannels,
    summary,
    products,
    invoices,
    loading,
    error,
    openInvoice,
    setOpenInvoice,
    invoicePage,
    setInvoicePage,
    invoiceSearch,
    setInvoiceSearch,
    invoiceStatus,
    setInvoiceStatus,
    invoiceSort,
    setInvoiceSort,
    load,
    requestRefund,
    maxChannelRevenue,
    maxProductRevenue,
  };
}
