import { NextRequest, NextResponse } from "next/server";
import type { FilterQuery } from "mongoose";

import { connectMongoose } from "@/lib/mongoose";
import { requirePermission } from "@/lib/auth";
import { InvoiceModel, type InvoiceDocument } from "@/orders/models/Invoice";
import type { InvoiceProgressState } from "@/orders/constants/progress";
import { TrackerModel } from "@/tracking";

const PAGE_SIZE = 20;
const LEGACY_DEFAULT_PAYMENT_METHOD = "zarinpal";
const PENDING_INVOICE_EXPIRES_MS = 10 * 60 * 1000;

const INVOICE_STATUSES = [
  "draft",
  "pending",
  "paid",
  "refunded",
  "canceled",
] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

interface OrdersTableInvoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  grandTotal: number;
  discountTotal: number;
  shippingTotal: number;
  lineCount: number;
  customerName: string;
  customerPhone: string;
  customerState?: string;
  customerCity?: string;
  customerAddress?: string;
  customerPostalCode?: string;
  transportName: string;
  paymentMethod: string;
  paymentStatus?: string;
  paymentTransactionId?: string;
  paymentSettledAt?: string;
  torobCanSettle: boolean;
  appliedOfferCode?: string;
  progressState?: InvoiceProgressState;
  progressInProgressAt?: string;
  progressPackagedPostedAt?: string;
  progressOrderFinishedAt?: string;
  progressTrackingCode?: string;
  orderFlow?: {
    source: "site" | "marketplace";
    serviceId?: string;
    serviceLabel: string;
    statusLabel: string;
    issueLevel: "ok" | "warning" | "danger";
    issue?: string;
    shippingServiceName?: string;
    trackingCode?: string;
    lastUpdatedAt?: string;
  };
  lines: Array<{
    title: string;
    variantSummary?: string;
    quantity: number;
  }>;
}

interface StatusMetric {
  status: InvoiceStatus;
  count: number;
  revenue: number;
}

function resolveStatus(value?: string | null): "all" | InvoiceStatus {
  if (!value) return "all";
  return (INVOICE_STATUSES.includes(value as InvoiceStatus) ? value : "all") as
    | "all"
    | InvoiceStatus;
}

function getPendingExpirationThreshold(): Date {
  return new Date(Date.now() - PENDING_INVOICE_EXPIRES_MS);
}

function buildStatusFilter(
  status: "all" | InvoiceStatus,
): FilterQuery<InvoiceDocument> {
  const threshold = getPendingExpirationThreshold();
  if (status === "all") {
    return {};
  }
  if (status === "pending") {
    return { status: "pending", createdAt: { $gt: threshold } };
  }
  if (status === "canceled") {
    return {
      $or: [
        { status: "canceled" },
        { status: "pending", createdAt: { $lte: threshold } },
      ],
    };
  }
  return { status };
}

function buildFilter(
  status: "all" | InvoiceStatus,
  q?: string | null,
  trackerOrderIds: string[] = [],
): FilterQuery<InvoiceDocument> {
  const statusFilter = buildStatusFilter(status);
  const trimmed = q?.trim();
  if (!trimmed) {
    return statusFilter;
  }

  const regex = new RegExp(trimmed, "i");
  const searchFilter: FilterQuery<InvoiceDocument> = {
    $or: [
      { number: regex },
      { "addressSnapshot.phone": regex },
      { "addressSnapshot.fname": regex },
      { "addressSnapshot.lname": regex },
      { "addressSnapshot.state": regex },
      { "addressSnapshot.city": regex },
      { "addressSnapshot.address": regex },
      { "addressSnapshot.postalCode": regex },
      { transportName: regex },
      { "lines.title": regex },
      { "lines.sku": regex },
      { "lines.variantSummary": regex },
      { "paymentMethodData.transactionId": regex },
      { "paymentMethodData.providerTransactionId": regex },
      { "paymentMethodData.snappPayProviderTransactionId": regex },
      { "paymentMethodData.request.providerTransactionId": regex },
      { "paymentMethodData.authority": regex },
      { "paymentMethodData.refId": regex },
      { "paymentMethodData.paymentToken": regex },
      { "progress.packagedPostedTrackingNumber": regex },
      ...(trackerOrderIds.length ? [{ number: { $in: trackerOrderIds } }] : []),
    ],
  };

  if (Object.keys(statusFilter).length === 0) {
    return searchFilter;
  }

  return { $and: [statusFilter, searchFilter] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolvePaymentMethod(invoice: InvoiceDocument): string {
  const raw =
    typeof invoice.paymentMethod === "string"
      ? invoice.paymentMethod.trim()
      : "";
  return raw.length > 0 ? raw : LEGACY_DEFAULT_PAYMENT_METHOD;
}

function getTrackerServiceLabel(serviceId?: string | null): string {
  const normalized = serviceId?.trim().toLowerCase();
  if (normalized === "dgk" || normalized === "digikala") return "دیجی‌کالا";
  if (normalized === "snapp" || normalized === "snp") return "اسنپ‌شاپ";
  if (normalized === "basalaam" || normalized === "bsl") return "باسلام";
  if (normalized === "torob") return "ترب";
  return serviceId || "سایت";
}

function isExpiredPendingInvoice(
  invoice: InvoiceDocument & { createdAt: Date },
): boolean {
  if (invoice.status !== "pending") {
    return false;
  }
  const createdAt =
    invoice.createdAt instanceof Date
      ? invoice.createdAt
      : new Date(invoice.createdAt);
  return (
    !Number.isNaN(createdAt.getTime()) &&
    createdAt.getTime() <= getPendingExpirationThreshold().getTime()
  );
}

function serializeInvoice(
  invoice: InvoiceDocument & { createdAt: Date; updatedAt: Date },
  tracker?: {
    serviceId?: string;
    orderStatus?: string;
    progressState?: string;
    shippingServiceName?: string;
    updatedAt?: Date;
    items?: Array<{ trackingCode?: string }>;
  } | null,
): OrdersTableInvoice {
  const customerName = [
    invoice.addressSnapshot?.fname,
    invoice.addressSnapshot?.lname,
  ]
    .filter(Boolean)
    .join(" ");
  const progressState = invoice.progress?.current as
    | InvoiceProgressState
    | undefined;
  const paymentContext = isRecord(invoice.paymentMethodData)
    ? invoice.paymentMethodData
    : {};
  const resolvedPaymentMethod = resolvePaymentMethod(invoice);
  const paymentContextRequest = isRecord(paymentContext.request)
    ? paymentContext.request
    : {};
  const expiredPending = isExpiredPendingInvoice(invoice);
  const effectiveStatus: InvoiceStatus = expiredPending
    ? "canceled"
    : invoice.status;
  const paymentStatus =
    (expiredPending ? "expired" : undefined) ??
    readNonEmptyString(paymentContext.status) ??
    readNonEmptyString(paymentContext.state) ??
    readNonEmptyString(paymentContext.paymentStatus) ??
    readNonEmptyString(paymentContext.result) ??
    readNonEmptyString(paymentContextRequest.status) ??
    readNonEmptyString(paymentContextRequest.state) ??
    (effectiveStatus === "canceled" ? "canceled" : undefined);
  const providerTransactionId =
    readNonEmptyString(paymentContext.providerTransactionId) ??
    readNonEmptyString(paymentContext.snappPayProviderTransactionId) ??
    readNonEmptyString(paymentContextRequest.providerTransactionId);
  const paymentTransactionId =
    resolvedPaymentMethod === "snapppay"
      ? (providerTransactionId ??
        readNonEmptyString(paymentContext.transactionId))
      : readNonEmptyString(paymentContext.transactionId);
  const toIsoString = (value?: Date | string | null): string | undefined => {
    if (!value) {
      return undefined;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  };
  const trackerTrackingCode = tracker?.items?.find((item) => readNonEmptyString(item?.trackingCode))?.trackingCode;
  const trackingCode = invoice.progress?.packagedPostedTrackingNumber ?? trackerTrackingCode ?? undefined;
  const shippingServiceName = tracker?.shippingServiceName ?? invoice.transportName ?? undefined;
  const lastFlowUpdate = toIsoString(tracker?.updatedAt ?? invoice.updatedAt);
  const flowSource = tracker?.serviceId ? "marketplace" : "site";
  const flowServiceLabel = tracker?.serviceId ? getTrackerServiceLabel(tracker.serviceId) : "سایت";
  const flowStatusLabel =
    readNonEmptyString(tracker?.progressState) ??
    readNonEmptyString(tracker?.orderStatus) ??
    (progressState ? progressState : effectiveStatus);
  const needsTrackingCode =
    effectiveStatus === "paid" &&
    progressState === "packaged-posted" &&
    !trackingCode;
  const notStarted =
    effectiveStatus === "paid" &&
    !progressState;
  const issueLevel = needsTrackingCode || notStarted ? "warning" : effectiveStatus === "canceled" ? "danger" : "ok";
  const issue = needsTrackingCode
    ? "کد رهگیری ثبت نشده است."
    : notStarted
      ? "پرداخت شده ولی وارد جریان آماده‌سازی نشده است."
      : undefined;

  return {
    id: invoice._id.toString(),
    number: invoice.number,
    status: effectiveStatus,
    createdAt:
      invoice.createdAt?.toISOString?.() ??
      new Date(invoice.createdAt).toISOString(),
    updatedAt:
      invoice.updatedAt?.toISOString?.() ??
      new Date(invoice.updatedAt).toISOString(),
    grandTotal: invoice.grandTotal ?? 0,
    discountTotal: invoice.discountTotal ?? 0,
    shippingTotal: invoice.shippingTotal ?? 0,
    lineCount: invoice.lines?.length ?? 0,
    customerName,
    customerPhone: invoice.addressSnapshot?.phone ?? "",
    customerState: invoice.addressSnapshot?.state ?? undefined,
    customerCity: invoice.addressSnapshot?.city ?? undefined,
    customerAddress: invoice.addressSnapshot?.address ?? undefined,
    customerPostalCode: invoice.addressSnapshot?.postalCode ?? undefined,
    transportName: invoice.transportName ?? "—",
    paymentMethod: resolvedPaymentMethod,
    paymentStatus,
    paymentTransactionId,
    paymentSettledAt: toIsoString(
      paymentContext.settledAt instanceof Date ||
        typeof paymentContext.settledAt === "string"
        ? paymentContext.settledAt
        : undefined,
    ),
    torobCanSettle:
      resolvedPaymentMethod === "torob" && paymentStatus === "verified",
    appliedOfferCode: invoice.appliedOfferCode ?? undefined,
    progressState,
    progressInProgressAt: toIsoString(
      invoice.progress?.inProgressAt ?? undefined,
    ),
    progressPackagedPostedAt: toIsoString(
      invoice.progress?.packagedPostedAt ?? undefined,
    ),
    progressOrderFinishedAt: toIsoString(
      invoice.progress?.orderFinishedAt ?? undefined,
    ),
    progressTrackingCode:
      trackingCode,
    orderFlow: {
      source: flowSource,
      serviceId: tracker?.serviceId,
      serviceLabel: flowServiceLabel,
      statusLabel: flowStatusLabel,
      issueLevel,
      issue,
      shippingServiceName,
      trackingCode,
      lastUpdatedAt: lastFlowUpdate,
    },
    lines: (invoice.lines || []).map((line) => ({
      title: line.title || line.sku || "",
      variantSummary: line.variantSummary ?? undefined,
      quantity: line.qty ?? line.requestedQty ?? 0,
    })),
  };
}

export async function GET(request: NextRequest) {
  await connectMongoose();
  await requirePermission(request, "orders:read");

  const url = new URL(request.url);
  const pageParam = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const statusParam = url.searchParams.get("status");
  const qParam = url.searchParams.get("q");

  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const currentStatus = resolveStatus(statusParam);
  const trackerOrderIds = qParam?.trim()
    ? await TrackerModel.find(
        {
          $or: [
            { orderId: new RegExp(escapeRegExp(qParam.trim()), "i") },
            { "items.trackingCode": new RegExp(escapeRegExp(qParam.trim()), "i") },
            { shippingServiceName: new RegExp(escapeRegExp(qParam.trim()), "i") },
            { serviceId: new RegExp(escapeRegExp(qParam.trim()), "i") },
            { orderStatus: new RegExp(escapeRegExp(qParam.trim()), "i") },
          ],
        },
        { orderId: 1 },
      )
        .limit(200)
        .lean<Array<{ orderId?: string }>>()
        .then((items) => items.map((item) => item.orderId).filter(Boolean) as string[])
    : [];
  const filter = buildFilter(currentStatus, qParam, trackerOrderIds);
  const skip = (page - 1) * PAGE_SIZE;

  const [invoicesRaw, filteredCount, aggregated] = await Promise.all([
    InvoiceModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(PAGE_SIZE)
      .lean({ getters: true }),
    InvoiceModel.countDocuments(filter),
    InvoiceModel.aggregate<{
      _id: InvoiceStatus;
      count: number;
      revenue: number;
    }>([
      {
        $match: { status: { $in: INVOICE_STATUSES } },
      },
      {
        $addFields: {
          effectiveStatus: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "pending"] },
                  { $lte: ["$createdAt", getPendingExpirationThreshold()] },
                ],
              },
              "canceled",
              "$status",
            ],
          },
        },
      },
      {
        $group: {
          _id: "$effectiveStatus",
          count: { $sum: 1 },
          revenue: { $sum: "$grandTotal" },
        },
      },
    ]).exec(),
  ]);

  const [paidWithoutProgress, packagedWithoutTracking] = await Promise.all([
    InvoiceModel.countDocuments({
      status: "paid",
      $or: [
        { "progress.current": { $exists: false } },
        { "progress.current": null },
        { "progress.current": "" },
      ],
    }).exec(),
    InvoiceModel.countDocuments({
      status: "paid",
      "progress.current": "packaged-posted",
      $or: [
        { "progress.packagedPostedTrackingNumber": { $exists: false } },
        { "progress.packagedPostedTrackingNumber": null },
        { "progress.packagedPostedTrackingNumber": "" },
      ],
    }).exec(),
  ]);

  const metricsMap = new Map<
    InvoiceStatus,
    { count: number; revenue: number }
  >();
  aggregated.forEach((item) => {
    metricsMap.set(item._id, { count: item.count, revenue: item.revenue });
  });

  const statusMetrics: StatusMetric[] = INVOICE_STATUSES.map((statusKey) => ({
    status: statusKey,
    count: metricsMap.get(statusKey)?.count ?? 0,
    revenue: ["paid", "pending", "refunded"].includes(statusKey)
      ? (metricsMap.get(statusKey)?.revenue ?? 0)
      : 0,
  }));

  const totalCount = statusMetrics.reduce(
    (acc, metric) => acc + metric.count,
    0,
  );
  const totalRevenue = statusMetrics
    .filter((metric) => ["paid", "pending", "refunded"].includes(metric.status))
    .reduce((acc, metric) => acc + metric.revenue, 0);

  const invoiceNumbers = invoicesRaw.map((invoice) => String(invoice.number));
  const trackers = invoiceNumbers.length
    ? await TrackerModel.find(
        { orderId: { $in: invoiceNumbers } },
        {
          orderId: 1,
          serviceId: 1,
          orderStatus: 1,
          progressState: 1,
          shippingServiceName: 1,
          items: 1,
          updatedAt: 1,
        },
      )
        .sort({ updatedAt: -1 })
        .lean<Array<{
          orderId?: string;
          serviceId?: string;
          orderStatus?: string;
          progressState?: string;
          shippingServiceName?: string;
          updatedAt?: Date;
          items?: Array<{ trackingCode?: string }>;
        }>>()
    : [];
  const trackerByOrderId = new Map<string, (typeof trackers)[number]>();
  trackers.forEach((tracker) => {
    const orderId = tracker.orderId ? String(tracker.orderId) : "";
    if (orderId && !trackerByOrderId.has(orderId)) {
      trackerByOrderId.set(orderId, tracker);
    }
  });

  const invoices = invoicesRaw.map((invoice) =>
    serializeInvoice(
      invoice as InvoiceDocument & { createdAt: Date; updatedAt: Date },
      trackerByOrderId.get(String(invoice.number)) ?? null,
    ),
  );

  const pages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  return NextResponse.json({
    invoices,
    page,
    pages,
    totalCount,
    totalRevenue,
    statusMetrics,
    currentStatus,
    operationMetrics: {
      paidWithoutProgress,
      packagedWithoutTracking,
    },
  });
}
