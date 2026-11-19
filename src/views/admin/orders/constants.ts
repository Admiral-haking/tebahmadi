import type { InvoiceDocument } from '@/orders/models/Invoice';
import {
  INVOICE_PROGRESS_STATES,
  type InvoiceProgressState,
} from '@/orders/constants/progress';

export type InvoiceStatus = InvoiceDocument['status'];

export const INVOICE_STATUSES: InvoiceStatus[] = ['draft', 'pending', 'paid', 'refunded', 'canceled'];

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'پیش‌نویس',
  pending: 'در انتظار پرداخت',
  paid: 'پرداخت شده',
  canceled: 'لغو شده',
  refunded: 'مرجوع شده',
};

export const STATUS_COLORS: Record<InvoiceStatus, { bg: string; color: string; border: string }> = {
  draft: { bg: 'rgba(145, 158, 171, 0.12)', color: '#637381', border: 'rgba(145, 158, 171, 0.24)' },
  pending: { bg: 'rgba(255, 193, 7, 0.16)', color: '#B76E00', border: 'rgba(255, 193, 7, 0.32)' },
  paid: { bg: 'rgba(56, 142, 60, 0.16)', color: '#2E7D32', border: 'rgba(56, 142, 60, 0.32)' },
  canceled: { bg: 'rgba(244, 67, 54, 0.12)', color: '#C62828', border: 'rgba(244, 67, 54, 0.32)' },
  refunded: { bg: 'rgba(3, 169, 244, 0.12)', color: '#0277BD', border: 'rgba(3, 169, 244, 0.24)' },
};

const tomanFormatter = new Intl.NumberFormat('fa-IR');

export function formatToman(amount: number): string {
  return `${tomanFormatter.format(Math.max(0, Math.round(amount)))} تومان`;
}

export const STATUS_FILTERS: Array<{ value: 'all' | InvoiceStatus; label: string }> = [
  { value: 'all', label: 'همه سفارش‌ها' },
  ...INVOICE_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

export { INVOICE_PROGRESS_STATES };
export type { InvoiceProgressState };

export const PROGRESS_LABELS: Record<InvoiceProgressState, { title: string; helper: string }> = {
  'in-progress': { title: 'در حال آماده‌سازی', helper: 'آماده‌سازی و بسته‌بندی سفارش' },
  'packaged-posted': { title: 'بسته‌بندی و ارسال', helper: 'تحویل به پست یا پیک' },
  'order-finished': { title: 'تحویل نهایی', helper: 'سفارش تکمیل شده است' },
};
