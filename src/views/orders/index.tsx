'use client';

import { useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useReactToPrint } from 'react-to-print';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ShoppingBagRoundedIcon from '@mui/icons-material/ShoppingBagRounded';
import CreditScoreRoundedIcon from '@mui/icons-material/CreditScoreRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { useAuth, useLoginDialog } from '@/auth';
import { useCart } from '@/components/cart/useCart';
import { BRAND } from '@/config/brand';

type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'canceled' | 'refunded';

interface InvoiceLine {
  productId: string | { $oid?: string };
  variantId: string | { $oid?: string };
  productSlug?: string;
  mediaId?: string | { $oid?: string };
  title: string;
  variantSummary?: string;
  priceModel: 'fixed' | 'per_unit';
  unitOfMeasure?: 'unit' | 'pair' | 'kg' | 'g' | 'lb' | 'oz' | 'l' | 'ml';
  qty?: number;
  requestedQty?: number;
  requestedUnit?: string;
  unitPriceBase: number;
  variantOfferAmount?: number;
  unitPriceEffective: number;
  lineTotal: number;
}

interface Invoice {
  _id: string;
  number: string;
  status: InvoiceStatus;
  progress?: {
    current?: 'in-progress' | 'packaged-posted' | 'order-finished' | string;
    inProgressAt?: string;
    packagedPostedAt?: string;
    packagedPostedTrackingNumber?: string;
    orderFinishedAt?: string;
  };
  lines: InvoiceLine[];
  createdAt?: string;
  updatedAt?: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  grandTotal: number;
  shippingPrice: number;
  shippingPaymentMethod?: 'online' | 'on_delivery' | string;
  transportName: string;
  paymentMethod?: string;
  paymentMethodData?: Record<string, unknown> | null;
  appliedOfferCode?: string | null;
  reviewToken?: string;
  reviewStatus?: 'pending' | 'completed' | 'expired';
  reviewExpiresAt?: string;
  addressSnapshot?: {
    fname?: string;
    lname?: string;
    phone?: string;
    state?: string;
    city?: string;
    address?: string;
    postalCode?: string;
  };
}

const tomanFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
const dateTimeFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const statusMeta: Record<
  InvoiceStatus,
  { label: string; helper: string; palette: 'warning' | 'success' | 'error' | 'info'; progress: number }
> = {
  draft: {
    label: 'پیش‌نویس',
    helper: 'این سفارش هنوز نهایی نشده است.',
    palette: 'info',
    progress: 15,
  },
  pending: {
    label: 'در انتظار پرداخت',
    helper: 'لطفاً پرداخت را تکمیل کنید تا سفارش نهایی شود.',
    palette: 'warning',
    progress: 40,
  },
  paid: {
    label: 'پرداخت شده',
    helper: 'سفارش شما در صف آماده‌سازی و ارسال قرار دارد.',
    palette: 'success',
    progress: 100,
  },
  canceled: {
    label: 'لغو شده',
    helper: 'این سفارش لغو شده است.',
    palette: 'error',
    progress: 100,
  },
  refunded: {
    label: 'مرجوع شده',
    helper: 'وجه سفارش به شما بازگردانده می‌شود.',
    palette: 'info',
    progress: 100,
  },
};

const progressSteps = [
  {
    key: 'in-progress',
    label: 'آماده‌سازی',
    helper: 'سفارش در حال آماده‌سازی و بسته‌بندی است.',
    icon: Inventory2RoundedIcon,
  },
  {
    key: 'packaged-posted',
    label: 'تحویل به پست',
    helper: 'مرسوله تحویل پست شده و قابل پیگیری است.',
    icon: LocalShippingRoundedIcon,
  },
  {
    key: 'order-finished',
    label: 'تحویل شده',
    helper: 'سفارش با موفقیت تکمیل شده است.',
    icon: TaskAltRoundedIcon,
  },
] as const;

function getProgressIndex(current?: string | null) {
  if (!current) {
    return -1;
  }
  const index = progressSteps.findIndex((step) => step.key === current);
  return index >= 0 ? index : -1;
}

function getProgressFallback(order: Invoice) {
  if (order.status === 'pending' || order.status === 'draft') {
    return {
      label: 'در انتظار تکمیل پرداخت',
      helper: 'بعد از پرداخت، سفارش وارد جریان آماده‌سازی می‌شود.',
    };
  }
  if (order.status === 'paid') {
    return {
      label: 'ثبت شده و منتظر بررسی',
      helper: 'سفارش پرداخت شده اما هنوز ادمین مرحله آماده‌سازی را ثبت نکرده است.',
    };
  }
  return {
    label: statusMeta[order.status]?.label ?? 'وضعیت سفارش',
    helper: statusMeta[order.status]?.helper ?? 'وضعیت سفارش در حال بررسی است.',
  };
}

function buildDekapostTrackingUrl(trackingCode?: string) {
  const code = trackingCode?.trim();
  if (!code) {
    return null;
  }
  return `https://tracking.dekapost.ir/?pc=${encodeURIComponent(code)}`;
}

function stringifyId(value: unknown) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && '$oid' in value && typeof (value as { $oid?: string }).$oid === 'string') {
    return (value as { $oid: string }).$oid;
  }
  return String(value);
}

function getLineImageSrc(line: InvoiceLine) {
  const mediaId = stringifyId(line.mediaId);
  return mediaId ? `/api/media/${mediaId}` : '/product-placeholder.svg';
}

const paymentMethodLabels: Record<string, string> = {
  zarinpal: 'زرین‌پال',
  torob: 'ترب‌پی',
  torobpay: 'ترب‌پی',
  azkivam: 'ازکی‌وام',
  digipay: 'دیجی‌پی',
  snapppay: 'اسنپ‌پی',
};

function getPaymentGatewayLabel(method?: string | null) {
  const normalized = method?.trim().toLowerCase();
  if (!normalized) return 'نامشخص';
  return paymentMethodLabels[normalized] ?? method ?? 'نامشخص';
}

function getShippingPaymentLabel(method?: string) {
  return method === 'on_delivery' ? 'پرداخت هزینه ارسال هنگام تحویل' : 'پرداخت آنلاین هزینه ارسال';
}

function formatPrice(value: number | undefined | null): string {
  const normalized = Math.max(0, Math.round(value ?? 0));
  return `${tomanFormatter.format(normalized)} تومان`;
}

function formatDateTime(value?: string): string {
  if (!value) {
    return 'زمان نامشخص';
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return 'زمان نامشخص';
  }
  return dateTimeFormatter.format(date);
}

function convertQuantity(value: number, fromUnit?: InvoiceLine['unitOfMeasure'], toUnit?: InvoiceLine['unitOfMeasure']) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  if (!fromUnit || !toUnit || fromUnit === toUnit) {
    return value;
  }

  const isWeightUnit = (unit: InvoiceLine['unitOfMeasure'] | undefined) => unit === 'g' || unit === 'kg';
  const isVolumeUnit = (unit: InvoiceLine['unitOfMeasure'] | undefined) => unit === 'ml' || unit === 'l';

  if (isWeightUnit(fromUnit) && isWeightUnit(toUnit)) {
    if (fromUnit === 'kg' && toUnit === 'g') {
      return value * 1000;
    }
    if (fromUnit === 'g' && toUnit === 'kg') {
      return value / 1000;
    }
  }

  if (isVolumeUnit(fromUnit) && isVolumeUnit(toUnit)) {
    if (fromUnit === 'l' && toUnit === 'ml') {
      return value * 1000;
    }
    if (fromUnit === 'ml' && toUnit === 'l') {
      return value / 1000;
    }
  }

  return value;
}

function computeLineBaseUnits(line: InvoiceLine): number {
  if (line.priceModel === 'fixed') {
    return Math.max(0, line.qty ?? 0);
  }

  if (!line.requestedQty) {
    return 0;
  }

  const fromUnit = line.requestedUnit ?? line.unitOfMeasure;
  return convertQuantity(line.requestedQty, fromUnit as any, line.unitOfMeasure);
}

function computeLineOfferSavings(line: InvoiceLine): number {
  const baseUnits = computeLineBaseUnits(line);
  if (!baseUnits || !Number.isFinite(baseUnits)) {
    return 0;
  }

  const unitPriceBase = line.unitPriceBase ?? line.unitPriceEffective;
  if (!Number.isFinite(unitPriceBase)) {
    return 0;
  }

  const baseTotal = Math.round(unitPriceBase * baseUnits);
  const effectiveTotal = line.lineTotal;
  const savings = baseTotal - effectiveTotal;
  return savings > 0 ? savings : 0;
}

const fetcher = async (url: string): Promise<Invoice[]> => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const message = (await response.text().catch(() => '')) || response.statusText;
    throw new Error(message || 'Failed to load orders');
  }
  const json = (await response.json()) as { data?: Invoice[] };
  return (json.data ?? []).map((invoice) => ({
    ...invoice,
    _id: typeof invoice._id === 'string' ? invoice._id : (invoice._id as unknown as { $oid?: string })?.$oid ?? '',
    createdAt: invoice.createdAt ?? (invoice as { createdAt?: string }).createdAt,
    updatedAt: invoice.updatedAt ?? (invoice as { updatedAt?: string }).updatedAt,
    reviewExpiresAt:
      typeof invoice.reviewExpiresAt === 'string'
        ? invoice.reviewExpiresAt
        : (invoice as { reviewExpiresAt?: { $date?: string } })?.reviewExpiresAt?.$date,
  }));
};

interface SiteInfo {
  appName?: string;
  logo?: { thumbId?: string; mobileId?: string; originalId?: string } | null;
}

const siteInfoFetcher = async (url: string): Promise<SiteInfo> => {
  const res = await fetch(url);
  if (!res.ok) return {};
  const json = await res.json();
  return json.data ?? {};
};

function buildAddressText(addr: Invoice['addressSnapshot']): string {
  if (!addr) return '';
  const parts: string[] = [];
  const name = [addr.fname, addr.lname].filter(Boolean).join(' ');
  if (name) parts.push(name);
  if (addr.phone) parts.push(`تلفن: ${addr.phone}`);
  const location = [addr.state, addr.city, addr.address].filter(Boolean).join('، ');
  if (location) parts.push(location);
  if (addr.postalCode) parts.push(`کد پستی: ${addr.postalCode}`);
  return parts.join('\n');
}

function cleanVariantSummary(summary: string): string {
  return summary
    .replace(/ \/ weightGrams:\s*[0-9]+(\.[0-9]+)?/g, '')
    .replace(/^weightGrams:\s*[0-9]+(\.[0-9]+)?\s*(\/\s*)?/, '')
    .trim()
    .replace(/\s*\/\s*$/, '');
}

interface SummaryCardProps {
  icon: ReactNode;
  color: 'primary' | 'success' | 'warning' | 'info' | 'error';
  title: string;
  value: string;
  helper?: string;
}

function SummaryCard({ icon, color, title, value, helper }: SummaryCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        p: 2.5,
        borderRadius: 3,
        border: `1px solid rgba(var(--mui-palette-${color}-mainChannel) / 0.12)`,
        background: `linear-gradient(160deg, rgba(var(--mui-palette-${color}-mainChannel) / 0.08) 0%, rgba(var(--mui-palette-background-paperChannel) / 0.96) 100%)`,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 'auto -40% 20% auto',
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: `radial-gradient(circle at center, rgba(var(--mui-palette-${color}-mainChannel) / 0.18) 0%, transparent 70%)`,
        }}
      />
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `rgba(var(--mui-palette-${color}-mainChannel) / 0.12)`,
            color: `var(--mui-palette-${color}-main)`,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h5" fontWeight={700}>
            {value}
          </Typography>
          {helper ? (
            <Typography variant="caption" color="text.secondary">
              {helper}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}

function LoadingState() {
  return (
    <Stack spacing={3}>
      {[0, 1].map((index) => (
        <Paper key={index} sx={{ p: 3, borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Skeleton variant="text" width={160} height={28} />
            <Skeleton variant="rounded" width={96} height={28} />
          </Stack>
          <Skeleton variant="text" width="40%" height={18} sx={{ mt: 1 }} />
          <Skeleton variant="rectangular" height={12} sx={{ mt: 2, borderRadius: 999 }} />
          <Skeleton variant="text" width="60%" height={18} sx={{ mt: 2 }} />
          <Skeleton variant="rectangular" height={72} sx={{ mt: 2, borderRadius: 2 }} />
        </Paper>
      ))}
    </Stack>
  );
}

function EmptyState() {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 4, md: 6 },
        textAlign: 'center',
        borderRadius: 4,
        border: '1px dashed rgba(var(--mui-palette-primary-mainChannel) / 0.24)',
        background: 'linear-gradient(180deg, rgba(var(--mui-palette-primary-mainChannel) / 0.06) 0%, transparent 100%)',
      }}
    >
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
          backgroundColor: 'rgba(var(--mui-palette-primary-mainChannel) / 0.12)',
          color: 'var(--mui-palette-primary-main)',
        }}
      >
        <LocalShippingRoundedIcon fontSize="large" />
      </Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        هنوز سفارشی ثبت نشده است
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto', mb: 3 }}>
        از فروشگاه طب احمدی بازدید کنید، محصول دلخواهتان را انتخاب کنید و اولین سفارش خود را ثبت نمایید. ارسال پست پیشتاز و
        پشتیبانی همیشگی همراه شماست.
      </Typography>
      <Button
        component={Link}
        href="/store"
        variant="contained"
        size="large"
        sx={{ px: 5, borderRadius: "10px" }}
      >
        شروع خرید
      </Button>
    </Paper>
  );
}

// NOTE: This is a printable A4 document rendered off-screen for react-to-print.
// Colors are intentionally fixed (white paper / dark ink) and must NOT use theme
// palette vars — those would adapt to dark mode and print dark-on-dark.
function PrintableInvoice({ order, siteInfo }: { order: Invoice | null; siteInfo: SiteInfo }) {
  if (!order) return null;

  const appName = siteInfo?.appName || BRAND.name;
  const logoId = siteInfo?.logo?.thumbId ?? siteInfo?.logo?.mobileId ?? siteInfo?.logo?.originalId ?? '';
  const logoSrc = logoId ? `/api/media/${logoId}` : null;
  const customerName = [order.addressSnapshot?.fname, order.addressSnapshot?.lname].filter(Boolean).join(' ') || 'مشتری گرامی';
  const trackingCode = order.progress?.packagedPostedTrackingNumber?.trim();
  const fullAddress = [order.addressSnapshot?.state, order.addressSnapshot?.city, order.addressSnapshot?.address].filter(Boolean).join('، ');

  const cellStyle: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 12,
    borderBottom: '1px solid #e5e7eb',
    textAlign: 'right',
    verticalAlign: 'middle',
  };
  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    backgroundColor: '#f8fafc',
    fontWeight: 800,
    color: '#374151',
    fontSize: 11,
  };

  return (
    <Box
      sx={{
        width: '210mm',
        minHeight: '297mm',
        p: '12mm',
        bgcolor: '#fff',
        color: '#111827',
        direction: 'rtl',
        fontFamily: '"Tahoma", "Vazirmatn", Arial, sans-serif',
        fontSize: 13,
      }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: '8mm',
          mb: '6mm',
          borderBottom: '2px solid #111827',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {logoSrc ? (
            <Box
              component="img"
              src={logoSrc}
              alt={appName}
              sx={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 1 }}
            />
          ) : (
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 1,
                background: 'linear-gradient(135deg, #0f766e, #1e3a5f)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ReceiptLongRoundedIcon sx={{ color: '#fff', fontSize: 28 }} />
            </Box>
          )}
          <Box>
            <Typography sx={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>{appName}</Typography>
          </Box>
        </Box>
        <Box sx={{ textAlign: 'left' }}>
          <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#0f766e', mb: 0.5 }}>فاکتور رسمی</Typography>
          <Typography sx={{ fontSize: 11, color: '#6b7280' }}>شماره سفارش: <strong>{order.number}</strong></Typography>
          <Typography sx={{ fontSize: 11, color: '#6b7280' }}>تاریخ: <strong>{formatDateTime(order.createdAt)}</strong></Typography>
        </Box>
      </Box>

      {/* ── Customer & Shipping ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4mm', mb: '6mm' }}>
        <Box sx={{ border: '1px solid #e5e7eb', borderRadius: '6px', p: '10px' }}>
          <Typography sx={{ fontSize: 10, color: '#6b7280', mb: 0.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            اطلاعات خریدار
          </Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 800 }}>{customerName}</Typography>
          {order.addressSnapshot?.phone ? (
            <Typography sx={{ fontSize: 12, color: '#374151', mt: 0.25 }}>📞 {order.addressSnapshot.phone}</Typography>
          ) : null}
          {order.addressSnapshot?.postalCode ? (
            <Typography sx={{ fontSize: 11, color: '#6b7280', mt: 0.25 }}>کد پستی: {order.addressSnapshot.postalCode}</Typography>
          ) : null}
        </Box>
        <Box sx={{ border: '1px solid #e5e7eb', borderRadius: '6px', p: '10px' }}>
          <Typography sx={{ fontSize: 10, color: '#6b7280', mb: 0.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            اطلاعات ارسال
          </Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 800 }}>{order.transportName}</Typography>
          {fullAddress ? (
            <Typography sx={{ fontSize: 11, color: '#374151', mt: 0.25, lineHeight: 1.5 }}>{fullAddress}</Typography>
          ) : null}
          {trackingCode ? (
            <Typography sx={{ fontSize: 11, color: '#0f766e', mt: 0.5, fontWeight: 700 }}>
              کد رهگیری: {trackingCode}
            </Typography>
          ) : null}
        </Box>
      </Box>

      {/* ── Items Table ── */}
      <Box sx={{ mb: '6mm', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl' }}>
          <thead>
            <tr>
              <th style={{ ...headerCellStyle, width: 28 }}>#</th>
              <th style={{ ...headerCellStyle, width: 52 }}></th>
              <th style={headerCellStyle}>کالا</th>
              <th style={{ ...headerCellStyle, width: 70, textAlign: 'center' }}>تعداد</th>
              <th style={{ ...headerCellStyle, width: 120, textAlign: 'left' }}>قیمت (تومان)</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line, index) => {
              const specs = line.variantSummary ? cleanVariantSummary(line.variantSummary) : '';
              return (
                <tr key={`${stringifyId(line.variantId)}-${index}`} style={{ backgroundColor: index % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ ...cellStyle, textAlign: 'center', color: '#9ca3af' }}>{index + 1}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>
                    <img
                      src={getLineImageSrc(line)}
                      alt={line.title}
                      style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 4, display: 'block', margin: '0 auto' }}
                    />
                  </td>
                  <td style={cellStyle}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{line.title}</div>
                    {specs ? (
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{specs}</div>
                    ) : null}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700 }}>
                    {line.priceModel === 'fixed'
                      ? `${line.qty ?? 0} عدد`
                      : `${line.requestedQty ?? 0} ${line.requestedUnit ?? line.unitOfMeasure ?? ''}`}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'left', fontWeight: 700 }}>
                    {tomanFormatter.format(Math.max(0, line.lineTotal))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Box>

      {/* ── Totals ── */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: '8mm' }}>
        <Box sx={{ width: '55mm', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
          {[
            { label: 'جمع کالاها', value: formatPrice(order.subtotal) },
            { label: 'تخفیف', value: `- ${formatPrice(order.discountTotal)}` },
            { label: 'هزینه ارسال', value: formatPrice(order.shippingTotal) },
          ].map(({ label, value }) => (
            <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', px: '8px', py: '5px', borderBottom: '1px solid #f3f4f6', fontSize: 11, color: '#374151' }}>
              <span>{label}</span>
              <span>{value}</span>
            </Box>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', px: '8px', py: '7px', background: '#111827', color: '#fff', fontWeight: 900, fontSize: 13 }}>
            <span>مبلغ پرداختی</span>
            <span>{formatPrice(order.grandTotal)}</span>
          </Box>
        </Box>
      </Box>

      {/* ── Footer ── */}
      <Box sx={{ borderTop: '1px solid #e5e7eb', pt: '4mm', textAlign: 'center' }}>
        <Typography sx={{ fontSize: 11, color: '#6b7280' }}>
          با تشکر از خرید شما — {appName} — درگاه پرداخت: {getPaymentGatewayLabel(order.paymentMethod)}
        </Typography>
      </Box>
    </Box>
  );
}

export default function OrdersView() {
  const { user, status, isLoading: authLoading } = useAuth();
  const { openLogin } = useLoginDialog();
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrintInvoice = useReactToPrint({
    contentRef: printRef,
    documentTitle: invoiceToPrint ? `invoice-${invoiceToPrint.number}` : 'invoice',
    pageStyle: `
      @page { size: A4; margin: 0; }
      html, body { margin: 0; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `,
  });

  const downloadInvoice = (order: Invoice) => {
    setInvoiceToPrint(order);
    window.setTimeout(() => handlePrintInvoice(), 80);
  };

  const copyAddress = useCallback((order: Invoice) => {
    const text = buildAddressText(order.addressSnapshot);
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedOrderId(order._id || order.number);
      setTimeout(() => setCopiedOrderId(null), 2500);
    }).catch(() => {});
  }, []);

  const { itemsCount } = useCart();

  const { data: siteInfo = {} } = useSWR<SiteInfo>('/api/settings/site-info', siteInfoFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const userId = user?._id ?? user?.id;
  const {
    data: orders,
    error,
    isLoading: ordersLoading,
  } = useSWR<Invoice[]>(userId ? `/api/invoices?userId=${userId}&limit=50` : null, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const sortedOrders = useMemo(() => {
    if (!orders) {
      return [];
    }
    return [...orders].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [orders]);

  const summary = useMemo(() => {
    const source = sortedOrders;
    const totals = {
      all: source.length,
      paid: 0,
      pending: 0,
      refunded: 0,
      canceled: 0,
      saved: 0,
      spent: 0,
    };
    source.forEach((order) => {
      if (order.status === 'paid') {
        totals.paid += 1;
        totals.spent += order.grandTotal ?? 0;
      }
      if (order.status === 'pending') {
        totals.pending += 1;
      }
      if (order.status === 'refunded') {
        totals.refunded += 1;
      }
      if (order.status === 'canceled') {
        totals.canceled += 1;
      }
      const couponSavings = order.discountTotal ?? 0;
      const variantSavings = (order.lines ?? []).reduce((acc, line) => acc + computeLineOfferSavings(line), 0);
      totals.saved += couponSavings + variantSavings;
    });
    return totals;
  }, [sortedOrders]);

  const isAuthenticating = authLoading || status === 'idle' || status === 'loading';

  const friendlyName = useMemo(() => {
    const name = [user?.fname, user?.lname].filter(Boolean).join(' ');
    if (name.trim().length > 0) {
      return name.trim();
    }
    if (user?.phone) {
      return `کاربر ${user.phone.slice(-4)}`;
    }
    return 'مهمان عزیز';
  }, [user?.fname, user?.lname, user?.phone]);

  if (!isAuthenticating && status === 'unauthenticated') {
    return (
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, md: 6 },
            borderRadius: 4,
            textAlign: 'center',
            border: '1px solid rgba(var(--mui-palette-primary-mainChannel) / 0.12)',
            background: 'linear-gradient(140deg, rgba(var(--mui-palette-primary-mainChannel) / 0.08) 0%, rgba(var(--mui-palette-background-paperChannel) / 0.96) 100%)',
          }}
        >
          <Typography variant="h4" fontWeight={800} gutterBottom>
            برای مشاهده سفارش‌ها وارد حساب کاربری شوید
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            وضعیت سفارش‌ها، رسید پرداخت و جزئیات ارسال فقط برای کاربران وارد شده قابل مشاهده است.
          </Typography>
          <Button onClick={() => openLogin()} variant="contained" size="large" sx={{ px: 6, borderRadius: "10px" }}>
            ورود به حساب کاربری
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Box sx={{ py: { xs: 6, md: 10 } }}>
      <Box sx={{ position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0, zIndex: -1 }}>
        <Box ref={printRef} dir="rtl">
          <PrintableInvoice order={invoiceToPrint} siteInfo={siteInfo} />
        </Box>
      </Box>
      <Container maxWidth="lg">
        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 4,
            px: { xs: 3, md: 6 },
            py: { xs: 4, md: 6 },
            mb: { xs: 4, md: 6 },
            border: '1px solid rgba(var(--mui-palette-primary-mainChannel) / 0.16)',
            background: 'linear-gradient(135deg, rgba(var(--mui-palette-primary-mainChannel) / 0.12) 0%, rgba(var(--mui-palette-background-paperChannel) / 0.92) 100%)',
            color: 'var(--mui-palette-text-primary)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: '-10% auto auto -15%',
              width: 280,
              height: 280,
              borderRadius: '50%',
              background: 'radial-gradient(circle at center, rgba(var(--mui-palette-primary-mainChannel) / 0.2) 0%, transparent 70%)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 'auto -20% -40% auto',
              width: 320,
              height: 320,
              borderRadius: '50%',
              background: 'radial-gradient(circle at center, rgba(var(--mui-palette-primary-mainChannel) / 0.12) 0%, transparent 70%)',
            }}
          />
          <Stack spacing={2} sx={{ position: 'relative' }}>
            <Chip
              label="تاریخچه خرید"
              size="small"
              sx={{
                alignSelf: 'flex-start',
                bgcolor: 'rgba(var(--mui-palette-background-paperChannel) / 0.16)',
                color: 'var(--mui-palette-primary-contrastText)',
                backdropFilter: 'blur(8px)',
              }}
            />
            <Typography variant="h3" fontWeight={800}>
              خوش آمدی، {friendlyName}!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560 }}>
              در اینجا می‌توانید وضعیت سفارش‌های خود را دنبال کنید، رسید پرداخت را بررسی کنید و روند آماده‌سازی و ارسال
              را ببینید. هر زمان که نیاز داشتید، از همین صفحه به پشتیبانی دسترسی خواهید داشت.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
              <Button component={Link} href="/store" variant="contained" color="primary">
                ادامه خرید
              </Button>
              {
                !!itemsCount && <Button component={Link} href="/cart" variant="outlined" color="primary">
                  تکمیل سفارش قبلی
                </Button>
              }
            </Stack>
          </Stack>
        </Paper>

        <Grid container spacing={2} sx={{ mb: { xs: 4, md: 6 } }}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <SummaryCard
              icon={<ShoppingBagRoundedIcon fontSize="medium" />}
              color="primary"
              title="تمام سفارش‌ها"
              value={`${summary.all} سفارش`}
              helper="تاریخچه کامل خرید شما"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <SummaryCard
              icon={<CreditScoreRoundedIcon fontSize="medium" />}
              color="success"
              title="پرداخت شده"
              value={`${summary.paid} سفارش`}
              helper={`مجموع خرید: ${formatPrice(summary.spent)}`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <SummaryCard
              icon={<PendingActionsRoundedIcon fontSize="medium" />}
              color="warning"
              title="در انتظار اقدام"
              value={`${summary.pending} سفارش`}
              helper="تکمیل پرداخت یا تایید نهایی"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <SummaryCard
              icon={<SavingsRoundedIcon fontSize="medium" />}
              color="info"
              title="میزان صرفه‌جویی"
              value={formatPrice(summary.saved)}
              helper="تخفیف‌های دریافت‌شده"
            />
          </Grid>
        </Grid>

        {error ? (
          <Alert severity="error" sx={{ borderRadius: 3, mb: 4 }}>
            در بارگذاری سفارش‌ها مشکلی پیش آمده است. لطفاً دوباره تلاش کنید.
          </Alert>
        ) : null}

        {ordersLoading || isAuthenticating ? (
          <LoadingState />
        ) : sortedOrders.length === 0 ? (
          <EmptyState />
        ) : (
          <Stack spacing={3.5}>
            {sortedOrders.map((order) => {
              const meta = statusMeta[order.status] ?? statusMeta.pending;
              const createdAt = formatDateTime(order.createdAt);
              const shippingLocation = [order.addressSnapshot?.state, order.addressSnapshot?.city]
                .filter(Boolean)
                .join('، ');
              const progressIndex = getProgressIndex(order.progress?.current);
              const trackingCode = order.progress?.packagedPostedTrackingNumber?.trim();
              const trackingUrl = buildDekapostTrackingUrl(trackingCode);
              const latestProgress = progressIndex >= 0 ? progressSteps[progressIndex] : null;
              const fallbackProgress = getProgressFallback(order);

              return (
                <Paper
                  key={order._id || order.number}
                  elevation={0}
                  sx={{
                    position: 'relative',
                    p: { xs: 3, md: 4 },
                    borderRadius: 4,
                    border: `1px solid rgba(var(--mui-palette-${meta.palette}-mainChannel) / 0.2)`,
                    background: `linear-gradient(155deg, rgba(var(--mui-palette-${meta.palette}-mainChannel) / 0.08) 0%, rgba(var(--mui-palette-background-paperChannel) / 0.96) 100%)`,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 'auto -10% 15% auto',
                      width: 200,
                      height: 200,
                      borderRadius: '50%',
                      background: `radial-gradient(circle at center, rgba(var(--mui-palette-${meta.palette}-mainChannel) / 0.18) 0%, transparent 70%)`,
                    }}
                  />
                  <Stack spacing={2.5} sx={{ position: 'relative' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle2" color="text.secondary">
                          شماره سفارش
                        </Typography>
                        <Typography variant="h5" fontWeight={700}>
                          {order.number}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {createdAt}
                        </Typography>
                      </Stack>
                      <Stack spacing={1} alignItems={{ xs: 'flex-start', sm: 'flex-end' }}>
                        <Chip
                          label={meta.label}
                          size="small"
                          sx={{
                            px: 1.5,
                            height: 28,
                            fontWeight: 600,
                            backgroundColor: `rgba(var(--mui-palette-${meta.palette}-mainChannel) / 0.12)`,
                            color: `var(--mui-palette-${meta.palette}-main)`,
                          }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {meta.helper}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Paper
                      elevation={0}
                      sx={{
                        p: { xs: 2, md: 2.5 },
                        borderRadius: 3,
                        border: `1px solid rgba(var(--mui-palette-${meta.palette}-mainChannel) / 0.16)`,
                        background: `linear-gradient(135deg, rgba(var(--mui-palette-${meta.palette}-mainChannel) / 0.06), rgba(var(--mui-palette-background-paperChannel) / 0.72))`,
                      }}
                    >
                      <Stack spacing={2}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5}>
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Box
                              sx={{
                                width: 42,
                                height: 42,
                                borderRadius: 2,
                                display: 'grid',
                                placeItems: 'center',
                                bgcolor: `rgba(var(--mui-palette-${meta.palette}-mainChannel) / 0.12)`,
                                color: `var(--mui-palette-${meta.palette}-main)`,
                              }}
                            >
                              <RouteRoundedIcon />
                            </Box>
                            <Stack spacing={0.25}>
                              <Typography variant="subtitle1" fontWeight={800}>
                                وضعیت فعلی: {latestProgress?.label ?? fallbackProgress.label}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {latestProgress?.helper ?? fallbackProgress.helper}
                              </Typography>
                            </Stack>
                          </Stack>
                          {trackingUrl ? (
                            <Button
                              component="a"
                              href={trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              variant="contained"
                              size="small"
                              endIcon={<OpenInNewRoundedIcon />}
                              sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, borderRadius: "10px" }}
                            >
                              پیگیری مرسوله
                            </Button>
                          ) : (
                            <Chip
                              label="کد رهگیری هنوز ثبت نشده"
                              size="small"
                              color={order.status === 'paid' ? 'warning' : 'default'}
                              variant="outlined"
                              sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}
                            />
                          )}
                        </Stack>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
                          {progressSteps.map((step, stepIndex) => {
                            const StepIcon = step.icon;
                            const active = progressIndex >= 0 && stepIndex <= progressIndex && order.status !== 'pending' && order.status !== 'draft';
                            return (
                              <Box
                                key={step.key}
                                sx={{
                                  flex: 1,
                                  p: 1.5,
                                  borderRadius: 2.5,
                                  border: active
                                    ? '1px solid rgba(var(--mui-palette-success-mainChannel) / 0.34)'
                                    : '1px solid rgba(var(--mui-palette-dividerChannel) / 0.9)',
                                  bgcolor: active
                                    ? 'rgba(var(--mui-palette-success-mainChannel) / 0.08)'
                                    : 'rgba(var(--mui-palette-text-primaryChannel) / 0.025)',
                                }}
                              >
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Box
                                    sx={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: '50%',
                                      display: 'grid',
                                      placeItems: 'center',
                                      color: active ? 'var(--mui-palette-success-main)' : 'var(--mui-palette-text-disabled)',
                                      bgcolor: active
                                        ? 'rgba(var(--mui-palette-success-mainChannel) / 0.12)'
                                        : 'rgba(var(--mui-palette-text-primaryChannel) / 0.05)',
                                    }}
                                  >
                                    <StepIcon fontSize="small" />
                                  </Box>
                                  <Stack spacing={0.1}>
                                    <Typography variant="body2" fontWeight={700}>
                                      {step.label}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {step.key === 'packaged-posted' && trackingCode
                                        ? `کد رهگیری: ${trackingCode}`
                                        : step.helper}
                                    </Typography>
                                  </Stack>
                                </Stack>
                              </Box>
                            );
                          })}
                        </Stack>

                        <LinearProgress
                          variant="determinate"
                          value={
                            progressIndex >= 0 && order.status !== 'pending' && order.status !== 'draft'
                              ? ((progressIndex + 1) / progressSteps.length) * 100
                              : meta.progress
                          }
                          sx={{
                            height: 8,
                            borderRadius: 999,
                            backgroundColor: `rgba(var(--mui-palette-${meta.palette}-mainChannel) / 0.12)`,
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 999,
                              backgroundColor: `var(--mui-palette-${meta.palette}-main)`,
                            },
                          }}
                        />
                      </Stack>
                    </Paper>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        روش ارسال: <strong>{order.transportName}</strong>
                        {shippingLocation ? ` • مقصد: ${shippingLocation}` : ''}
                      </Typography>
                      {order.appliedOfferCode ? (
                        <Chip
                          label={`کد تخفیف: ${order.appliedOfferCode}`}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(var(--mui-palette-info-mainChannel) / 0.12)',
                            color: 'var(--mui-palette-info-main)',
                          }}
                        />
                      ) : null}
                    </Stack>

                    <Grid container spacing={1.25}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: 2.5,
                            border: '1px solid rgba(var(--mui-palette-success-mainChannel) / 0.18)',
                            bgcolor: 'rgba(var(--mui-palette-success-mainChannel) / 0.06)',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            درگاه پرداخت
                          </Typography>
                          <Typography variant="subtitle2" fontWeight={900}>
                            {getPaymentGatewayLabel(order.paymentMethod)}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Paper
                          elevation={0}
                          sx={{
                            p: 1.5,
                            borderRadius: 2.5,
                            border: '1px solid rgba(var(--mui-palette-info-mainChannel) / 0.18)',
                            bgcolor: 'rgba(var(--mui-palette-info-mainChannel) / 0.06)',
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            نوع پرداخت
                          </Typography>
                          <Typography variant="subtitle2" fontWeight={900}>
                            {getShippingPaymentLabel(order.shippingPaymentMethod)}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>

                    <Stack
                      spacing={1.5}
                      divider={<Divider flexItem sx={{ borderStyle: 'dashed', opacity: 0.6 }} />}
                    >
                      {order.lines.map((line, index) => (
                        <Stack
                          key={`${stringifyId(line.productId)}-${stringifyId(line.variantId)}-${index}`}
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={2}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar
                              src={getLineImageSrc(line)}
                              variant="rounded"
                              sx={{
                                width: 68,
                                height: 68,
                                borderRadius: 2.5,
                                border: '1px solid rgba(var(--mui-palette-dividerChannel) / 0.8)',
                                bgcolor: 'rgba(var(--mui-palette-primary-mainChannel) / 0.06)',
                              }}
                            />
                            <Stack spacing={0.5}>
                              <Typography variant="subtitle1" fontWeight={700}>
                                {line.title}
                              </Typography>
                              {line.variantSummary ? (
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                  {cleanVariantSummary(line.variantSummary)
                                    .split(' / ')
                                    .filter(Boolean)
                                    .map((spec) => (
                                      <Chip
                                        key={spec}
                                        label={spec}
                                        size="small"
                                        variant="outlined"
                                        sx={{
                                          height: 22,
                                          fontSize: 11,
                                          borderRadius: 1,
                                          borderColor: 'rgba(var(--mui-palette-primary-mainChannel) / 0.3)',
                                          color: 'text.secondary',
                                        }}
                                      />
                                    ))}
                                </Stack>
                              ) : null}
                              <Typography variant="caption" color="text.secondary">
                                {line.priceModel === 'fixed'
                                  ? `تعداد: ${line.qty ?? 0}`
                                  : `مقدار: ${line.requestedQty ?? 0} ${line.requestedUnit ?? line.unitOfMeasure ?? ''}`}
                              </Typography>
                            </Stack>
                          </Stack>
                          <Typography variant="subtitle1" fontWeight={700}>
                            {formatPrice(line.lineTotal)}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>

                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={2}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        جمع محصول: {formatPrice(order.subtotal)} • تخفیف: {formatPrice(order.discountTotal)} • هزینه ارسال:{' '}
                        {formatPrice(order.shippingTotal)}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="baseline">
                        <Typography variant="body2" color="text.secondary">
                          مبلغ پرداختی:
                        </Typography>
                        <Typography variant="h5" fontWeight={800}>
                          {formatPrice(order.grandTotal)}
                        </Typography>
                      </Stack>
                    </Stack>

                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      justifyContent="space-between"
                      alignItems={{ xs: 'stretch', sm: 'center' }}
                      sx={{
                        pt: 1,
                        borderTop: '1px solid rgba(var(--mui-palette-dividerChannel) / 0.7)',
                      }}
                    >
                      {order.addressSnapshot?.address ? (
                        <Tooltip
                          title={copiedOrderId === (order._id || order.number) ? 'کپی شد!' : 'کپی آدرس تحویل'}
                          placement="top"
                        >
                          <Button
                            variant="outlined"
                            size="small"
                            color={copiedOrderId === (order._id || order.number) ? 'success' : 'inherit'}
                            startIcon={
                              copiedOrderId === (order._id || order.number)
                                ? <CheckRoundedIcon />
                                : <ContentCopyRoundedIcon />
                            }
                            onClick={() => copyAddress(order)}
                            sx={{
                              borderRadius: "10px",
                              borderColor: 'rgba(var(--mui-palette-dividerChannel) / 0.8)',
                              color: copiedOrderId === (order._id || order.number)
                                ? 'var(--mui-palette-success-main)'
                                : 'text.secondary',
                              fontSize: 12,
                            }}
                          >
                            {copiedOrderId === (order._id || order.number) ? 'کپی شد' : 'کپی آدرس'}
                          </Button>
                        </Tooltip>
                      ) : <Box />}

                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<DownloadRoundedIcon />}
                          onClick={() => downloadInvoice(order)}
                          sx={{ borderRadius: "10px" }}
                        >
                          دانلود فاکتور
                        </Button>
                        {trackingUrl ? (
                          <Button
                            component="a"
                            href={trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="outlined"
                            size="small"
                            endIcon={<OpenInNewRoundedIcon />}
                            sx={{ borderRadius: "10px" }}
                          >
                            رهگیری دکاپست
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>

                    {order.reviewToken ? (
                      <Box
                        sx={{
                          mt: 2,
                          p: { xs: 2, md: 2.5 },
                          borderRadius: 3,
                          border: '1px dashed rgba(var(--mui-palette-primary-mainChannel) / 0.3)',
                          background: 'rgba(var(--mui-palette-primary-mainChannel) / 0.04)',
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1.5}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                        >
                          <Stack spacing={0.5}>
                            <Typography variant="subtitle1" fontWeight={700}>
                              نظر شما درباره این خرید
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              برای ثبت نظر، مستقیم وارد فرم شوید. نیازی به کد پیامک نیست.
                            </Typography>
                            <Stack direction="row" spacing={1}>
                              {order.reviewStatus === 'completed' ? (
                                <Chip label="ثبت شده" size="small" color="success" />
                              ) : null}
                              {order.reviewStatus === 'expired' ? (
                                <Chip label="منقضی شده" size="small" color="warning" />
                              ) : null}
                            </Stack>
                          </Stack>
                          <Button
                            component={Link}
                            href={`/review/${order.reviewToken}`}
                            variant="outlined"
                            size="small"
                            disabled={order.reviewStatus === 'expired'}
                          >
                            {order.reviewStatus === 'completed' ? 'مشاهده نظر' : 'افزودن نظر'}
                          </Button>
                        </Stack>
                      </Box>
                    ) : null}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}

        {sortedOrders.length > 0 ? (
          <Box
            sx={{
              mt: { xs: 6, md: 8 },
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              سفارش‌های قدیمی‌تر در حال حاضر نمایش داده نمی‌شوند. برای مشاهده جزئیات بیشتر با پشتیبانی تماس بگیرید.
            </Typography>
          </Box>
        ) : null}
      </Container>
    </Box>
  );
}
