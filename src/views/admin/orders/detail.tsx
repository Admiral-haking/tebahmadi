'use client';

import { forwardRef, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useReactToPrint } from 'react-to-print';
import {
  Alert,
  Button,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  CardHeader,
} from '@mui/material';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import PercentRoundedIcon from '@mui/icons-material/PercentRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';

import InvoiceLinesTable, { type InvoiceLineView } from './components/InvoiceLinesTable';
import SnappPayUpdateDialog, {
  type SnappPayUpdatePayload,
  type SnappPayUpdateSummary,
} from './components/SnappPayUpdateDialog';
import ProgressUpdateForm, { type InvoiceProgressView } from './components/ProgressUpdateForm';
import StatusChip from './components/StatusChip';
import StatusUpdateForm from './components/StatusUpdateForm';
import {
  formatToman,
  getProgressLabel,
  STATUS_LABELS,
  INVOICE_STATUSES,
  type InvoiceStatus,
} from './constants';
import Splash from '@/components/splash';
import { ORDER_PROGRESS_FREEZE_MS } from '@/orders/constants/progress';
import { defaultFont } from '@/theme';
import { useSiteInfo } from '../site-settings/hooks';
import { ContentCopy } from '@mui/icons-material';
import { toast } from 'sonner';
import { copyShippingText } from '@/orders/utils/shippingText';
import { getReceiptAddress } from './receipt-utils';
import TapinShipmentCard from './components/TapinShipmentCard';
import type { TapinShipmentView } from './components/tapin-shipment.types';
import {
  cancelSnappPayInvoiceAction,
  updateSnappPayInvoiceAction,
} from '@/app/admin/orders/[id]/actions';

const dateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'full',
  timeStyle: 'short',
});

const receiptDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

interface InvoiceDetailProps {
  invoiceId: string;
}

interface InvoiceView {
  id: string;
  number: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  grandTotal: number;
  transportName: string;
  shippingBreakdown: Record<string, any> | null;
  addressSnapshot: Record<string, any> | null;
  appliedOfferCode?: string;
  offerType?: string;
  shippingPaymentMethod: string;
  shippingDeferred: number;
  shippingPrice: number;
  lines: InvoiceLineView[];
  progress?: InvoiceProgressView | null;
  paymentMethod?: string;
  paymentMethodData?: Record<string, any> | null;
  tapinShipment?: TapinShipmentView | null;
}

interface ReceiptToPrintProps {
  invoice: InvoiceView;
}

// NOTE: 80mm thermal-printer receipt rendered for printing. Colors are
// intentionally fixed (black ink on white paper) and must NOT use theme
// palette vars — those would adapt to dark mode and print unreadable.
const ReceiptToPrint = forwardRef<HTMLDivElement, ReceiptToPrintProps>(({ invoice }, ref) => {
  const { data } = useSiteInfo()
  const shippingAmount =
    invoice.shippingPaymentMethod === 'on_delivery' ? invoice.shippingPrice : invoice.shippingTotal;
  const vatAmount = Math.max(
    0,
    invoice.grandTotal - (invoice.subtotal - invoice.discountTotal + shippingAmount),
  );
  const customerName = [invoice.addressSnapshot?.fname, invoice.addressSnapshot?.lname]
    .filter(Boolean)
    .join(' ');
  const printableDate = receiptDateFormatter.format(new Date(invoice.createdAt));

  return (
    <Box
      ref={ref}
      sx={{
        width: '80mm',
        px: 2,
        py: 3,
        fontFamily: defaultFont.style.fontFamily,
        fontSize: '12px',
        color: '#000',
        backgroundColor: '#fff',
        '& *': {
          fontFamily: defaultFont.style.fontFamily,
          fontSize: '12px',
          color: '#000',
        },
      }}
    >
      <Box sx={{ textAlign: 'center', fontSize: '14px', mb: 1 }}>{data?.appName}</Box>
      <Box sx={{ textAlign: 'center', fontSize: '11px', mb: 1 }}>{printableDate}</Box>
      <Box sx={{ textAlign: 'center', fontSize: '11px', mb: 2 }}>سفارش #{invoice.number}</Box>

      <Box sx={{ mb: 1 }}>
        <Table size='small'>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#111', '& *': { color: '#FFF' } }}>
              <TableCell>
                محصول
              </TableCell>
              <TableCell width={10}>
                ت
              </TableCell>
              <TableCell>
                ق.واحد
              </TableCell>
              <TableCell>
                جمع
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoice.lines.map((line) => {
              const qty = line.quantity ?? line.requestedQty ?? 1;
              const unitPrice = line.unitPriceEffective ?? line.unitPriceBase ?? 0;
              const lineTotal = line.lineTotal ?? unitPrice * (qty || 1);
              return (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.title}
                  </TableCell>
                  <TableCell>
                    {qty}
                  </TableCell>
                  <TableCell sx={{ fontSize: 10, color: '#000' }}>
                    {formatToman(unitPrice).replace("تومان", "").trim()}
                  </TableCell>
                  <TableCell sx={{ fontSize: 10, color: '#000' }}>
                    {formatToman(lineTotal).replace("تومان", "").trim()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>جمع کل</span>
        <span>{formatToman(invoice.subtotal)}</span>
      </Box>
      {invoice.discountTotal > 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>تخفیف</span>
          <span>-{formatToman(invoice.discountTotal)}</span>
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>ارسال</span>
        <span>{formatToman(shippingAmount)}</span>
      </Box>
      {vatAmount > 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>مالیات</span>
          <span>{formatToman(vatAmount)}</span>
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>مبلغ قابل پرداخت</span>
        <span>{formatToman(invoice.grandTotal)}</span>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Box>مشتری: {customerName || '—'}</Box>
        <Box>تلفن: {invoice.addressSnapshot?.phone ?? '—'}</Box>
        <Box>ادرس: {invoice.addressSnapshot?.state ?? '—'}, {invoice.addressSnapshot?.city ?? '—'}, {invoice.addressSnapshot?.address ?? '—'}</Box>
      </Box>

      <Box sx={{ textAlign: 'center', my: 1 }}>------------------------------</Box>
      <Box sx={{ textAlign: 'center', fontSize: '11px' }}>{getReceiptAddress(data)}</Box>
      <Box sx={{ textAlign: 'center', fontSize: '11px' }}>از خرید شما متشکریم</Box>
    </Box>
  );
});

ReceiptToPrint.displayName = 'ReceiptToPrint';

type InvoiceResponse = {
  data?: Record<string, any> | null;
};

type FetchError = Error & { status?: number };

function serializeInvoice(invoice: any): InvoiceView {
  const lines: InvoiceLineView[] = Array.isArray(invoice?.lines)
    ? invoice.lines.map((line: any, index: number) => ({
      id: `${invoice?._id}-${line?.sku}-${index}`,
      productId:
        typeof line?.productId === 'string'
          ? line.productId
          : line?.productId?.toString?.() ?? '',
      productSlug: typeof line?.productSlug === 'string' ? line.productSlug : undefined,
      variantId:
        typeof line?.variantId === 'string'
          ? line.variantId
          : line?.variantId?.toString?.() ?? undefined,
      title: line?.title ?? '',
      sku: line?.sku ?? '',
      variantSummary: normalizeVariantSummary(line?.variantSummary, line?.attributesSnapshot),
      quantity: line?.qty ?? undefined,
      requestedQty: line?.requestedQty ?? undefined,
      requestedUnit: line?.requestedUnit ?? undefined,
      unitOfMeasure: line?.unitOfMeasure ?? undefined,
      unitPriceBase: line?.unitPriceBase ?? 0,
      unitPriceEffective: line?.unitPriceEffective ?? line?.unitPriceBase ?? 0,
      lineTotal: line?.lineTotal ?? 0,
      offerAmount: line?.variantOfferAmount ?? undefined,
      priceModel: line?.priceModel,
      mediaId:
        typeof line?.mediaId === 'string'
          ? line.mediaId
          : line?.mediaId?.toString?.() ?? undefined,
      weightGrams: typeof line?.weightGrams === 'number' ? line.weightGrams : undefined,
    }))
    : [];

  const progress: InvoiceProgressView | null = invoice?.progress
    ? {
      current: invoice.progress.current ?? undefined,
      inProgressAt: invoice.progress.inProgressAt
        ? new Date(invoice.progress.inProgressAt).toISOString()
        : undefined,
      packagedPostedAt: invoice.progress.packagedPostedAt
        ? new Date(invoice.progress.packagedPostedAt).toISOString()
        : undefined,
      orderFinishedAt: invoice.progress.orderFinishedAt
        ? new Date(invoice.progress.orderFinishedAt).toISOString()
        : undefined,
      packagedPostedTrackingNumber: invoice.progress.packagedPostedTrackingNumber ?? undefined,
    }
    : null;

  return {
    id: invoice?._id?.toString?.() ?? '',
    number: invoice?.number ?? '',
    status: invoice?.status as InvoiceStatus,
    createdAt: invoice?.createdAt ? new Date(invoice.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: invoice?.updatedAt ? new Date(invoice.updatedAt).toISOString() : new Date().toISOString(),
    subtotal: invoice?.subtotal ?? 0,
    discountTotal: invoice?.discountTotal ?? 0,
    shippingTotal: invoice?.shippingTotal ?? 0,
    grandTotal: invoice?.grandTotal ?? 0,
    transportName: invoice?.transportName ?? '—',
    shippingBreakdown: invoice?.shippingBreakdown ?? null,
    addressSnapshot: invoice?.addressSnapshot ?? null,
    appliedOfferCode: invoice?.appliedOfferCode ?? undefined,
    offerType: invoice?.appliedOfferType ?? undefined,
    shippingPaymentMethod: invoice?.shippingPaymentMethod ?? 'online',
    shippingDeferred: invoice?.shippingDeferred ?? 0,
    shippingPrice: invoice?.shippingPrice ?? invoice?.shippingTotal ?? 0,
    lines,
    progress,
    paymentMethod: invoice?.paymentMethod ?? undefined,
    paymentMethodData: invoice?.paymentMethodData ?? null,
    tapinShipment: invoice?.tapinShipment
      ? {
        ...invoice.tapinShipment,
        registeredAt: invoice.tapinShipment.registeredAt
          ? new Date(invoice.tapinShipment.registeredAt).toISOString()
          : new Date().toISOString(),
        syncedAt: invoice.tapinShipment.syncedAt
          ? new Date(invoice.tapinShipment.syncedAt).toISOString()
          : undefined,
        itemWeights: Array.isArray(invoice.tapinShipment.itemWeights)
          ? invoice.tapinShipment.itemWeights.map((item: any) => ({
            variantId: item?.variantId?.toString?.() ?? String(item?.variantId ?? ''),
            weightGrams: Number(item?.weightGrams ?? 0),
          }))
          : undefined,
      }
      : null,
  };
}

function statusProgress(current: InvoiceStatus) {
  const index = INVOICE_STATUSES.indexOf(current);
  if (index === -1) return new Set<InvoiceStatus>();
  return new Set(INVOICE_STATUSES.slice(0, index + 1));
}

function formatAttributeValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : '';
  }
  if (typeof value === 'boolean') {
    return value ? 'بله' : 'خیر';
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => formatAttributeValue(item))
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .join('، ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.name === 'string' && record.name.trim().length > 0) {
      return record.name;
    }
    if (typeof record.label === 'string' && record.label.trim().length > 0) {
      return record.label;
    }
    if (typeof record.title === 'string' && record.title.trim().length > 0) {
      return record.title;
    }
    if (typeof record.key === 'string' && record.key.trim().length > 0) {
      return record.key;
    }
    if (typeof record.value === 'string' && record.value.trim().length > 0) {
      return record.value;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function normalizeVariantSummary(
  summary: string | undefined | null,
  attributesSnapshot: Record<string, unknown> | undefined,
): string | undefined {
  const cleanSummary = summary?.includes('[object Object]') ? undefined : summary ?? undefined;
  if (cleanSummary) {
    return cleanSummary;
  }
  if (!attributesSnapshot || typeof attributesSnapshot !== 'object') {
    return undefined;
  }
  const entries = Object.entries(attributesSnapshot)
    .map(([key, value]) => {
      const formatted = formatAttributeValue(value);
      if (!formatted) {
        return undefined;
      }
      return `${key}: ${formatted}`;
    })
    .filter((item): item is string => typeof item === 'string' && item.length > 0);
  if (entries.length === 0) {
    return undefined;
  }
  return entries.join(' / ');
}

const fetchInvoice = async (url: string): Promise<InvoiceResponse> => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const message = (await response.text().catch(() => '')) || response.statusText;
    const error = new Error(message || 'خطا در دریافت سفارش') as FetchError;
    error.status = response.status;
    throw error;
  }
  return response.json();
};

export default function InvoiceDetailView({ invoiceId }: InvoiceDetailProps) {
  const { data, error, isLoading, mutate } = useSWR(`/api/invoices/${invoiceId}`, fetchInvoice);
  const invoice = useMemo<InvoiceView | null>(() => {
    if (!data?.data) return null;
    return serializeInvoice(data.data);
  }, [data]);

  // Bridge to the marketplaces: which panels each line's product is linked on.
  // Match on the site variant id (the marketplace records carry it); the line's
  // sku is not the marketplace barcode.
  const variantIds = useMemo(
    () => Array.from(new Set((invoice?.lines ?? []).map((l) => l.variantId).filter(Boolean) as string[])),
    [invoice?.lines],
  );
  const { data: presenceData } = useSWR(
    variantIds.length ? ['marketplace-presence', variantIds.join(',')] : null,
    async () => {
      const res = await fetch('/api/admin/orders/marketplace-presence', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantIds }),
      });
      if (!res.ok) return { presence: {} };
      return res.json() as Promise<{ presence: Record<string, import('./components/MarketplacePresence').LinePresence> }>;
    },
  );
  const presence = presenceData?.presence;

  const [currentStatus, setCurrentStatus] = useState<InvoiceStatus | null>(null);
  const [isSnappPayPending, startSnappPayTransition] = useTransition();
  const [isSnappPayUpdateDialogOpen, setSnappPayUpdateDialogOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: invoice ? `receipt-${invoice.number}` : 'receipt',
    pageStyle: `
      @page {
        size: 80mm auto;
        margin: 5mm;
      }
      body {
        margin: 0;
        font-family: "Roboto Mono","Courier New",monospace;
        -webkit-print-color-adjust: exact;
        direction: rtl;
      }
    `,

  });

  useEffect(() => {
    if (invoice?.status) {
      setCurrentStatus(invoice.status);
    }
  }, [invoice?.status]);

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Splash />
      </Container>
    );
  }

  if (error) {
    const message = error instanceof Error ? error.message : 'خطا در دریافت سفارش';
    const isNotFound = (error as FetchError).status === 404;
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Alert severity={isNotFound ? 'warning' : 'error'}>
          {isNotFound ? 'سفارش مورد نظر یافت نشد.' : message}
        </Alert>
      </Container>
    );
  }

  if (!invoice) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Alert severity="warning">سفارش مورد نظر یافت نشد.</Alert>
      </Container>
    );
  }

  const statusValue = currentStatus ?? invoice.status;
  const reachedStatuses = statusProgress(statusValue);
  const progressView = invoice.progress ?? null;
  const packagedPostedDate =
    progressView?.packagedPostedAt && !Number.isNaN(Date.parse(progressView.packagedPostedAt))
      ? new Date(progressView.packagedPostedAt)
      : null;
  const freezeDeadlineDate =
    packagedPostedDate !== null
      ? new Date(packagedPostedDate.getTime() + ORDER_PROGRESS_FREEZE_MS)
      : null;
  const freezeDeadlineLabel = freezeDeadlineDate ? dateFormatter.format(freezeDeadlineDate) : undefined;
  const isFrozen =
    Boolean(
      (freezeDeadlineDate && Date.now() >= freezeDeadlineDate.getTime()) ||
      progressView?.current === 'order-finished',
    );
  const createdDate = dateFormatter.format(new Date(invoice.createdAt));
  const updatedDate = dateFormatter.format(new Date(invoice.updatedAt));

  const customerName = [invoice.addressSnapshot?.fname, invoice.addressSnapshot?.lname]
    .filter(Boolean)
    .join(' ');
  const handleCopyShippingText = () => {
    copyShippingText({
      customerName,
      customerPhone: invoice.addressSnapshot?.phone,
      postalCode: invoice.addressSnapshot?.postalCode,
      state: invoice.addressSnapshot?.state,
      city: invoice.addressSnapshot?.city,
      address: invoice.addressSnapshot?.address,
      items: invoice.lines.map((line) => ({
        title: line.variantSummary || line.title,
        quantity: line.quantity ?? line.requestedQty ?? 0,
      })),
    })
      .then(() => toast.success("متن ارسال سفارش کپی شد."))
      .catch(() => toast.error("کپی متن ارسال انجام نشد."));
  };
  const shippingPaymentMethod = invoice.shippingPaymentMethod === 'on_delivery' ? 'on_delivery' : 'online';
  const shippingPaymentLabel =
    shippingPaymentMethod === 'on_delivery'
      ? `پرداخت هنگام تحویل (${formatToman(invoice.shippingDeferred || invoice.shippingPrice)})`
      : `پرداخت آنلاین (${formatToman(invoice.shippingTotal)})`;
  const paymentMethod = invoice.paymentMethod?.trim().toLowerCase();
  const paymentData = invoice.paymentMethodData ?? {};
  const readTextValue = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  };
  const readNumberValue = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }
      const parsed = Number(trimmed.replace(/,/g, ''));
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };
  const rialToToman = (value: number | undefined) =>
    value === undefined ? undefined : Math.max(0, Math.floor(value / 10));
  const paymentRequestData =
    typeof paymentData.request === 'object' && paymentData.request !== null
      ? (paymentData.request as Record<string, unknown>)
      : {};
  const providerTransactionId =
    readTextValue(paymentData.providerTransactionId) ??
    readTextValue(paymentData.snappPayProviderTransactionId) ??
    readTextValue(paymentRequestData.providerTransactionId);
  const internalTransactionId = readTextValue(paymentData.transactionId);
  const paymentTransactionId =
    paymentMethod === 'snapppay'
      ? providerTransactionId ?? internalTransactionId
      : internalTransactionId;
  const paymentToken =
    readTextValue(paymentData.paymentToken) ??
    readTextValue(paymentData.authority);
  const paymentStatus = readTextValue(paymentData.status);
  const canMutateSnappPay = paymentMethod === 'snapppay' && paymentStatus === 'paid';
  // When only one item is left, an update would empty/invalidate the cart — per
  // SnappPay's flow only a full cancel is allowed at that point.
  const snappPaySingleItem = (Array.isArray(invoice?.lines) ? invoice.lines.length : 0) <= 1;

  const initialSnappPayAmountToman =
    readNumberValue(paymentData.amount) ??
    rialToToman(readNumberValue(paymentRequestData.amount)) ??
    invoice.grandTotal;
  const defaultExternalSourceAmountToman =
    readNumberValue(paymentRequestData.externalSourceAmountToman) ??
    rialToToman(readNumberValue(paymentRequestData.externalSourceAmount)) ??
    0;
  const defaultCartId = (() => {
    const requestCartList = paymentRequestData.cartList;
    if (!Array.isArray(requestCartList) || requestCartList.length === 0) {
      return 1;
    }
    const firstCart = requestCartList[0];
    if (typeof firstCart !== 'object' || firstCart === null) {
      return 1;
    }
    const cartIdValue = (firstCart as Record<string, unknown>).cartId;
    if (typeof cartIdValue === 'number' && Number.isFinite(cartIdValue)) {
      return cartIdValue;
    }
    return readTextValue(cartIdValue) ?? 1;
  })();
  const defaultTaxAmountToman = Math.max(
    0,
    invoice.grandTotal - (invoice.subtotal - invoice.discountTotal + invoice.shippingTotal),
  );

  // Rebuild the SnappPay edit form straight from the original gateway request
  // (stored in rial). This is the exact payload that produced the original
  // amount, so the form opens reconciled to it instead of guessing from invoice
  // fields (which made the computed final collapse to ۰ تومان). Shipping/tax are
  // surfaced as separate added lines (flags false) to mirror the amount formula.
  //
  // The order-level discount is folded into each item's net unit price (and the
  // discount field zeroed) instead of being kept as a separate subtracted total.
  // Otherwise, removing/reducing an item shrinks the items while the full
  // discount stays, collapsing the final amount to ۰. Folded in, removing an
  // item simply drops that item's value — the total stays correct and positive.
  const snappPayInitialPayload = (() => {
    const requestCartList = paymentRequestData.cartList;
    if (!Array.isArray(requestCartList) || requestCartList.length === 0) {
      return null;
    }
    const cartList = requestCartList
      .filter((cart): cart is Record<string, unknown> => typeof cart === 'object' && cart !== null)
      .map((cart, cartIndex) => {
        const rawItems = Array.isArray(cart.cartItems) ? cart.cartItems : [];
        const cartItems = rawItems
          .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
          .map((item, index) => ({
            id: readNumberValue(item.id) ?? index + 1,
            name: readTextValue(item.name) ?? '',
            count: Math.max(1, Math.floor(readNumberValue(item.count) ?? 1)),
            amountToman: rialToToman(readNumberValue(item.amount)) ?? 0,
            category: readTextValue(item.category) ?? 'general',
            commissionType: Math.max(1, Math.floor(readNumberValue(item.commissionType) ?? 100)),
          }));
        return {
          cartId: readNumberValue(cart.cartId) ?? cartIndex + 1,
          isShipmentIncluded: false,
          isTaxIncluded: false,
          shippingAmountToman: rialToToman(readNumberValue(cart.shippingAmount)) ?? 0,
          taxAmountToman: rialToToman(readNumberValue(cart.taxAmount)) ?? 0,
          cartItems,
        };
      })
      .filter((cart) => cart.cartItems.length > 0);

    if (cartList.length === 0) {
      return null;
    }

    // Fold the coupon/order discount into per-unit prices, scaled by each item's
    // share of the items subtotal, so the discount no longer floats as a separate
    // collapsible total.
    const discountToman =
      rialToToman(readNumberValue(paymentRequestData.discountAmount)) ?? invoice.discountTotal ?? 0;
    const itemsSubtotalToman = cartList.reduce(
      (total, cart) => total + cart.cartItems.reduce((sum, item) => sum + item.count * item.amountToman, 0),
      0,
    );
    if (discountToman > 0 && itemsSubtotalToman > 0) {
      const keepRatio = Math.max(0, (itemsSubtotalToman - discountToman) / itemsSubtotalToman);
      for (const cart of cartList) {
        for (const item of cart.cartItems) {
          item.amountToman = Math.max(0, Math.floor(item.amountToman * keepRatio));
        }
      }
    }

    return {
      discountAmountToman: 0,
      externalSourceAmountToman:
        rialToToman(readNumberValue(paymentRequestData.externalSourceAmount)) ?? defaultExternalSourceAmountToman,
      cartList,
    };
  })();

  const resolveSnappPayMutationError = (reason?: string, code?: number): string => {
    switch (reason) {
      case 'transaction_not_found':
        return 'تراکنش اسنپ‌پی پیدا نشد.';
      case 'invoice_not_found':
        return 'فاکتور سفارش پیدا نشد.';
      case 'transaction_payment_token_missing':
        return 'Payment Token سفارش موجود نیست.';
      case 'snapppay_update_amount_not_reduced':
        return 'مبلغ آپدیت باید از مبلغ اولیه سفارش کمتر باشد.';
      case 'snapppay_update_cart_list_missing':
        return 'اطلاعات cartList برای آپدیت کامل نیست.';
      case 'snapppay_update_cart_items_missing':
        return 'حداقل یک آیتم باید در cartItems باقی بماند.';
      case 'snapppay_update_invalid_payload':
      case 'snapppay_update_invalid_amount':
        return 'داده‌های آپدیت اسنپ‌پی نامعتبر است.';
      case 'snapppay_status_check_failed':
        return 'استعلام وضعیت اسنپ‌پی قبل از آپدیت ناموفق بود.';
      case 'snapppay_settle_before_update_failed':
        return 'تسویه تراکنش قبل از آپدیت انجام نشد. لطفاً دوباره تلاش کنید.';
      case 'snapppay_transaction_not_ready_for_update':
        return 'وضعیت تراکنش در اسنپ‌پی برای آپدیت مناسب نیست.';
      case 'snapppay_update_failed':
        if (code === 1011) {
          return 'وضعیت تراکنش برای آپدیت مناسب نیست. ابتدا وضعیت را در اسنپ‌پی بررسی کنید.';
        }
        if (code === 1042) {
          return 'مبلغ جدید باید کمتر یا مساوی مبلغ قبلی باشد.';
        }
        if (code === 1053) {
          return 'درخواست قبلی در حال پردازش است. چند لحظه بعد دوباره تلاش کنید.';
        }
        if (code === 1078) {
          return 'سفارش‌های دارای کد تخفیف اسنپ‌پی قابل ویرایش نیستند.';
        }
        return code ? 'آپدیت اسنپ‌پی رد شد (Code: ' + code + ').' : 'آپدیت اسنپ‌پی رد شد.';
      case 'snapppay_cancel_failed':
        return code ? 'کنسل اسنپ‌پی رد شد (Code: ' + code + ').' : 'کنسل اسنپ‌پی رد شد.';
      default:
        if (reason?.startsWith('transaction_status_')) {
          return 'وضعیت فعلی تراکنش اجازه این عملیات را نمی‌دهد.';
        }
        return 'عملیات اسنپ‌پی انجام نشد.';
    }
  };

  const handleOpenSnappPayUpdateDialog = () => {
    setSnappPayUpdateDialogOpen(true);
  };

  const handleSnappPayUpdateSubmit = (
    payload: SnappPayUpdatePayload,
    summary: SnappPayUpdateSummary,
  ) => {
    const confirmed = window.confirm(
      'آپدیت اسنپ‌پی غیرقابل بازگشت است. مبلغ نهایی جدید ' + formatToman(summary.amountToman) + ' خواهد بود. ادامه می‌دهید؟',
    );
    if (!confirmed) return;

    startSnappPayTransition(async () => {
      const result = await updateSnappPayInvoiceAction(invoice.id, payload);
      if (!result.ok) {
        toast.error(resolveSnappPayMutationError(result.reason, result.code));
        return;
      }
      toast.success('آپدیت اسنپ‌پی انجام شد.');
      setSnappPayUpdateDialogOpen(false);
      void mutate();
    });
  };

  const handleSnappPayCancel = () => {
    const confirmed = window.confirm(
      'کنسل کامل اسنپ‌پی غیرقابل بازگشت است و کل سبد برگشت می‌خورد. ادامه می‌دهید؟',
    );
    if (!confirmed) return;

    startSnappPayTransition(async () => {
      const result = await cancelSnappPayInvoiceAction(invoice.id);
      if (!result.ok) {
        toast.error(resolveSnappPayMutationError(result.reason, result.code));
        return;
      }
      toast.success('کنسل اسنپ‌پی انجام شد.');
      setCurrentStatus('canceled');
      void mutate();
    });
  };

  return (
    <Box sx={{ py: 6, px: 2 }}>
      <Stack spacing={4}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack spacing={1}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              سفارش #{invoice.number}
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <StatusChip status={statusValue} size="medium" />
              <Tooltip title="زمان ثبت">
                <Chip icon={<ScheduleRoundedIcon />} label={createdDate} variant="outlined" />
              </Tooltip>
            </Stack>
          </Stack>
          <IconButton LinkComponent={Link} href="/admin/orders" color="primary">
            <ReplyRoundedIcon />
          </IconButton>
        </Stack>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={3}>
              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h6">اقلام سفارش</Typography>
                    <InvoiceLinesTable lines={invoice.lines} presence={presence} />
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardHeader
                  title="اطلاعات ارسال"
                  action={<IconButton onClick={handleCopyShippingText}>
                    <ContentCopy />
                  </IconButton>}
                />
                <CardContent>
                  <Stack spacing={2}>
                    <List disablePadding>
                      <ListItem>
                        <ListItemIcon>
                          <LocalShippingRoundedIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText primary="روش ارسال" secondary={invoice.transportName} />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <PaymentsRoundedIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText primary="نحوه پرداخت هزینه ارسال" secondary={shippingPaymentLabel} />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <PlaceRoundedIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="استان"
                          secondary={invoice.addressSnapshot?.state ?? '—'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <PlaceRoundedIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="شهر"
                          secondary={invoice.addressSnapshot?.city ?? '—'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <PlaceRoundedIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="آدرس کامل"
                          secondary={invoice.addressSnapshot?.address ?? '—'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <PlaceRoundedIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary="کد پستی"
                          secondary={invoice.addressSnapshot?.postalCode ?? '—'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <PhoneRoundedIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText primary="شماره تماس" secondary={invoice.addressSnapshot?.phone ?? '—'} />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <PersonRoundedIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText primary="گیرنده" secondary={customerName || '—'} />
                      </ListItem>
                    </List>
                  </Stack>
                </CardContent>
              </Card>

              <TapinShipmentCard invoice={invoice} onChanged={() => void mutate()} />
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              <Button variant="contained" fullWidth onClick={() => handlePrint?.()}>
                پرینت فاکتور
              </Button>
              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="h6">اطلاعات پرداخت</Typography>
                    <Stack spacing={0.75}>
                      <Typography variant="body2" color="text.secondary">
                        روش پرداخت: {paymentMethod === 'snapppay' ? 'اسنپ‌پی' : invoice.paymentMethod ?? '—'}
                      </Typography>
                      {paymentStatus ? (
                        <Typography variant="body2" color="text.secondary">
                          وضعیت پرداخت: {paymentStatus}
                        </Typography>
                      ) : null}
                      {paymentTransactionId ? (
                        <Typography variant="body2" color="text.secondary" dir="ltr">
                          {paymentMethod === 'snapppay' ? 'SnappPay Transaction ID' : 'Transaction ID'}: {paymentTransactionId}
                        </Typography>
                      ) : null}
                      {paymentToken ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          dir="ltr"
                          sx={{ wordBreak: 'break-all' }}
                        >
                          Payment Token: {paymentToken}
                        </Typography>
                      ) : null}
                    </Stack>
                    {paymentMethod === 'snapppay' ? (
                      <>
                        <Divider flexItem />
                        <Stack spacing={1}>
                          <Button
                            variant="outlined"
                            color="warning"
                            disabled={!canMutateSnappPay || isSnappPayPending || snappPaySingleItem}
                            onClick={handleOpenSnappPayUpdateDialog}
                          >
                            ویرایش و آپدیت اسنپ‌پی
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            disabled={!canMutateSnappPay || isSnappPayPending}
                            onClick={handleSnappPayCancel}
                          >
                            کنسل کامل اسنپ‌پی
                          </Button>
                          {!canMutateSnappPay ? (
                            <Typography variant="caption" color="text.secondary">
                              آپدیت و کنسل فقط برای پرداخت اسنپ‌پی نهایی‌شده فعال است.
                            </Typography>
                          ) : canMutateSnappPay && snappPaySingleItem ? (
                            <Typography variant="caption" color="text.secondary">
                              فقط یک آیتم در سفارش باقی مانده است؛ امکان آپدیت نیست و تنها می‌توانید سفارش را لغو کنید.
                            </Typography>
                          ) : null}
                        </Stack>
                      </>
                    ) : null}
                  </Stack>
                </CardContent>
              </Card>
              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardContent>
                  <Stack spacing={1.5}>
                    <Typography variant="h6">جمع مبالغ</Typography>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        مجموع محصولات
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {formatToman(invoice.subtotal)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        تخفیف‌ها
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="error.main">
                        -{formatToman(invoice.discountTotal)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">
                        هزینه ارسال
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {shippingPaymentMethod === 'on_delivery'
                          ? `${formatToman(invoice.shippingPrice)} (پرداخت در محل)`
                          : formatToman(invoice.shippingTotal)}
                      </Typography>
                    </Stack>
                    <Divider flexItem sx={{ my: 1 }} />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="subtitle1" fontWeight={700}>
                        مبلغ کل
                      </Typography>
                      <Typography variant="subtitle1" fontWeight={800}>
                        {formatToman(invoice.grandTotal)}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="h6">وضعیت سفارش</Typography>
                      <Chip label={STATUS_LABELS[statusValue]} color="primary" variant="outlined" size="small" />
                    </Stack>
                    <StatusUpdateForm
                      invoiceId={invoice.id}
                      status={statusValue}
                      disabled={isFrozen}
                      onStatusChange={(next) => {
                        setCurrentStatus(next);
                        void mutate();
                      }}
                    />
                    {isFrozen ? (
                      <Alert severity="warning" variant="outlined">
                        {freezeDeadlineLabel
                          ? `این سفارش از ${freezeDeadlineLabel} قفل شده و امکان تغییر وضعیت یا مرحله وجود ندارد.`
                          : 'این سفارش به دلیل تکمیل فرآیند قفل شده و امکان تغییر وضعیت یا مرحله وجود ندارد.'}
                      </Alert>
                    ) : null}
                    <Divider flexItem />
                    <Stack spacing={1.5}>
                      <Typography variant="subtitle2" color="text.secondary">
                        پیشرفت وضعیت
                      </Typography>
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {INVOICE_STATUSES.map((item) => (
                          <Chip
                            key={item}
                            label={STATUS_LABELS[item]}
                            color={reachedStatuses.has(item) ? 'success' : 'default'}
                            variant={reachedStatuses.has(item) ? 'filled' : 'outlined'}
                            size="small"
                          />
                        ))}
                      </Stack>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="h6">مراحل ارسال</Typography>
                      <Chip
                        label={getProgressLabel(progressView?.current)}
                        color={progressView?.current === 'order-finished' ? 'success' : 'default'}
                        size="small"
                        variant={progressView?.current ? 'filled' : 'outlined'}
                      />
                    </Stack>
                    <ProgressUpdateForm
                      invoiceId={invoice.id}
                      status={statusValue}
                      progress={progressView}
                      isFrozen={isFrozen}
                      freezeDeadline={freezeDeadlineLabel}
                      onProgressChange={() => {
                        void mutate();
                      }}
                    />
                  </Stack>
                </CardContent>
              </Card>

              {invoice.appliedOfferCode && (
                <Card variant="outlined" sx={{ borderRadius: 4 }}>
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PercentRoundedIcon color="primary" />
                        <Typography variant="subtitle1" fontWeight={600}>
                          کد تخفیف اعمال شده
                        </Typography>
                      </Stack>
                      <Typography variant="h6">{invoice.appliedOfferCode}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        نوع: {invoice.offerType ?? 'نامشخص'}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              )}

              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2" color="text.secondary">
                      آخرین بروزرسانی
                    </Typography>
                    <Typography variant="body2">{updatedDate}</Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>

        <SnappPayUpdateDialog
          open={isSnappPayUpdateDialogOpen}
          onClose={() => setSnappPayUpdateDialogOpen(false)}
          lines={invoice.lines}
          defaultCartId={defaultCartId}
          // Fallback build (no stored gateway request): keep the discount at 0 so
          // removing/reducing an item can't drive the final to ۰ — the item net
          // prices already carry the value. Admin reduces items to lower the total.
          defaultDiscountAmountToman={0}
          defaultExternalSourceAmountToman={defaultExternalSourceAmountToman}
          defaultShippingAmountToman={invoice.shippingTotal}
          defaultTaxAmountToman={defaultTaxAmountToman}
          initialPayload={snappPayInitialPayload}
          originalAmountToman={initialSnappPayAmountToman}
          isSubmitting={isSnappPayPending}
          onSubmit={handleSnappPayUpdateSubmit}
        />

        <Box sx={{ position: 'fixed', top: -10000, left: -10000 }}>
          {invoice ? <ReceiptToPrint ref={printRef} invoice={invoice} /> : null}
        </Box>
      </Stack>
    </Box>
  );
}
