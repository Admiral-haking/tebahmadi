"use client";

import {
  useEffect,
  useState,
  useTransition,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";

import {
  formatToman,
  getProgressLabel,
  STATUS_COLORS,
  type InvoiceStatus,
  type InvoiceProgressState,
} from "../constants";
import StatusChip from "./StatusChip";
import AppPagination from "@/components/search/pagination";
import { settleTorobInvoiceAction } from "@/app/admin/orders/[id]/actions";
import {
  buildShippingCopyText,
  copyShippingText,
} from "@/orders/utils/shippingText";
import { toast } from "sonner";
import { isAdminFeatureEnabled } from "@/config/admin-features";

const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateFormatter.format(date);
}

const holooEnabled = isAdminFeatureEnabled("holoo");

function getPaymentStatusLabel(status?: string | null): string | null {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return null;
  if (
    [
      "paid",
      "verified",
      "settled",
      "success",
      "succeeded",
      "ok",
      "done",
      "completed",
    ].includes(normalized)
  ) {
    return "موفق";
  }
  if (
    [
      "pending",
      "created",
      "initialized",
      "init",
      "processing",
      "waiting",
      "requested",
      "request",
      "requested_payment",
      "in_progress",
    ].includes(normalized)
  ) {
    return "در انتظار";
  }
  if (
    ["canceled", "cancelled", "cancel", "void", "voided", "reversed"].includes(
      normalized,
    )
  ) {
    return "کنسل شده";
  }
  if (
    [
      "failed",
      "failure",
      "error",
      "expired",
      "rejected",
      "reject",
      "denied",
      "unverified",
      "not_verified",
      "unsuccessful",
    ].includes(normalized)
  ) {
    return "ناموفق";
  }
  return status ?? null;
}

function getPaymentStatusColor(
  status?: string | null,
): "default" | "success" | "warning" | "error" {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) return "default";
  if (
    [
      "paid",
      "verified",
      "settled",
      "success",
      "succeeded",
      "ok",
      "done",
      "completed",
    ].includes(normalized)
  )
    return "success";
  if (
    [
      "pending",
      "created",
      "initialized",
      "init",
      "processing",
      "waiting",
      "requested",
      "request",
      "requested_payment",
      "in_progress",
    ].includes(normalized)
  )
    return "warning";
  if (
    [
      "failed",
      "failure",
      "error",
      "expired",
      "rejected",
      "reject",
      "denied",
      "unverified",
      "not_verified",
      "unsuccessful",
      "canceled",
      "cancelled",
      "cancel",
      "void",
      "voided",
      "reversed",
    ].includes(normalized)
  )
    return "error";
  return "default";
}

export interface OrdersTableInvoice {
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
  paymentSettledAt?: string | null;
  torobCanSettle: boolean;
  appliedOfferCode?: string;
  progressState?: InvoiceProgressState | null;
  progressInProgressAt?: string | null;
  progressPackagedPostedAt?: string | null;
  progressOrderFinishedAt?: string | null;
  progressTrackingCode?: string | null;
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
  lines?: Array<{
    title: string;
    variantSummary?: string;
    quantity: number;
  }>;
}

function getPaymentMethodLabel(method?: string | null): string {
  const normalized = method?.trim().toLowerCase();
  if (!normalized) return "زرین پال";
  if (normalized === "zarinpal") return "زرین پال";
  if (normalized === "torob") return "ترب پی";
  if (normalized === "azkivam") return "ازکی وام";
  if (normalized === "digipay") return "دیجی پی";
  if (normalized === "snapppay") return "اسنپ پی";
  return method!;
}

function getProgressDate(
  invoice: OrdersTableInvoice,
): string | null | undefined {
  if (invoice.progressState === "order-finished")
    return invoice.progressOrderFinishedAt;
  if (invoice.progressState === "packaged-posted")
    return invoice.progressPackagedPostedAt;
  if (invoice.progressState === "in-progress")
    return invoice.progressInProgressAt;
  return undefined;
}

function getOrderFlowColor(
  level?: "ok" | "warning" | "danger",
): "default" | "success" | "warning" | "error" {
  if (level === "ok") return "success";
  if (level === "warning") return "warning";
  if (level === "danger") return "error";
  return "default";
}

function EllipsisText({
  children,
  color = "text.primary",
  dir,
}: {
  children: string;
  color?: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <Typography
      variant="body2"
      color={color}
      dir={dir}
      sx={{
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        textAlign: dir === "ltr" ? "right" : undefined,
      }}
      title={children}
    >
      {children}
    </Typography>
  );
}

interface OrdersTableProps {
  invoices: OrdersTableInvoice[];
  page: number;
  pages: number;
  onRefresh?: () => void;
}

function TorobSettleButton({
  invoiceId,
  onSettled,
}: {
  invoiceId: string;
  onSettled?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSettle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!window.confirm("می خواهید پرداخت ترب این سفارش تسویه شود؟")) {
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await settleTorobInvoiceAction(invoiceId);
      if (!result.ok) {
        setError("تسویه پرداخت ترب انجام نشد.");
        return;
      }
      onSettled?.();
    });
  };

  return (
    <Stack spacing={0.5} alignItems="flex-end" sx={{ minWidth: 0 }}>
      <Button
        size="small"
        variant="outlined"
        color="warning"
        onClick={handleSettle}
        sx={{ minHeight: 30, px: 1.25 }}
        startIcon={
          isPending ? <CircularProgress color="inherit" size={14} /> : null
        }
      >
        تسویه
      </Button>
      {error ? (
        <Alert
          severity="error"
          sx={{ py: 0, px: 1, maxWidth: 180, "& .MuiAlert-message": { p: 0 } }}
        >
          {error}
        </Alert>
      ) : null}
    </Stack>
  );
}

export default function OrdersTable({
  invoices,
  page,
  pages,
  onRefresh,
}: OrdersTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [holooBusy, setHolooBusy] = useState(false);

  useEffect(() => {
    setSelectedIds((current) => {
      const visibleIds = new Set(invoices.map((invoice) => invoice.id));
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [invoices]);

  const handleCopy = (
    invoice: OrdersTableInvoice,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    copyShippingText({
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      postalCode: invoice.customerPostalCode,
      state: invoice.customerState,
      city: invoice.customerCity,
      address: invoice.customerAddress,
      items: invoice.lines,
    })
      .then(() => toast.success("متن ارسال سفارش کپی شد."))
      .catch(() => toast.error("کپی متن ارسال انجام نشد."));
  };

  const handleToggleAll = (event: ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.target.checked) {
      setSelectedIds(new Set(invoices.map((invoice) => invoice.id)));
      return;
    }
    setSelectedIds(new Set());
  };

  const handleToggleInvoice = (
    invoiceId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    event.stopPropagation();
    setSelectedIds((current) => {
      const next = new Set(current);
      if (event.target.checked) {
        next.add(invoiceId);
      } else {
        next.delete(invoiceId);
      }
      return next;
    });
  };

  const handleCopySelected = () => {
    const selectedInvoices = invoices.filter((invoice) =>
      selectedIds.has(invoice.id),
    );
    if (selectedInvoices.length === 0) {
      toast.error("هیچ سفارشی انتخاب نشده است.");
      return;
    }

    const text = selectedInvoices
      .map((invoice) =>
        buildShippingCopyText({
          customerName: invoice.customerName,
          customerPhone: invoice.customerPhone,
          postalCode: invoice.customerPostalCode,
          state: invoice.customerState,
          city: invoice.customerCity,
          address: invoice.customerAddress,
          items: invoice.lines,
        }),
      )
      .filter(Boolean)
      .join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("متن ارسال سفارش های انتخاب شده کپی شد."))
      .catch(() => toast.error("کپی متن ارسال انجام نشد."));
  };

  const handleSendSelectedToHoloo = () => {
    const ids = invoices.filter((i) => selectedIds.has(i.id)).map((i) => i.id);
    if (ids.length === 0) {
      toast.error("هیچ سفارشی انتخاب نشده است.");
      return;
    }
    if (!window.confirm(`ارسال ${ids.length.toLocaleString("fa-IR")} فاکتور انتخاب‌شده به هلو؟`)) return;
    setHolooBusy(true);
    const tId = toast.loading(`در حال ارسال ${ids.length.toLocaleString("fa-IR")} فاکتور به هلو...`);
    fetch("/api/holoo/sync-invoice/bulk", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceIds: ids }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `خطای ${r.status}`);
        return j as { processed?: number; succeeded?: number };
      })
      .then((j) => {
        const ok = j.succeeded ?? 0;
        const fail = (j.processed ?? ids.length) - ok;
        if (fail > 0) toast.warning(`${ok.toLocaleString("fa-IR")} فاکتور در هلو ثبت شد، ${fail.toLocaleString("fa-IR")} ناموفق/رد شد`);
        else toast.success(`${ok.toLocaleString("fa-IR")} فاکتور در هلو ثبت شد`);
        setSelectedIds(new Set());
        onRefresh?.();
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "خطا در ارسال به هلو"))
      .finally(() => {
        setHolooBusy(false);
        toast.dismiss(tId);
      });
  };

  const selectedVisibleCount = invoices.filter((invoice) =>
    selectedIds.has(invoice.id),
  ).length;
  const allVisibleSelected =
    invoices.length > 0 && selectedVisibleCount === invoices.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < invoices.length;

  return (
    <Card
      variant="outlined"
      sx={{
        maxWidth: "100%",
        borderRadius: 1.5,
        overflow: "hidden",
        borderColor: "rgba(var(--mui-palette-text-secondaryChannel) / 0.24)",
      }}
    >
      <CardContent sx={{ p: 0 }}>
        {selectedVisibleCount > 0 ? (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
            gap={1}
            sx={{ px: { xs: 1, md: 1.5 }, py: 1 }}
          >
            <Typography variant="body2" color="text.secondary">
              {selectedVisibleCount.toLocaleString("fa-IR")} سفارش انتخاب شده
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyRoundedIcon />}
                onClick={handleCopySelected}
                disabled={holooBusy}
              >
                کپی متن ارسال
              </Button>
              {holooEnabled ? (
                <Button
                  size="small"
                  variant="contained"
                  color="secondary"
                  onClick={handleSendSelectedToHoloo}
                  disabled={holooBusy}
                  startIcon={holooBusy ? <CircularProgress size={14} color="inherit" /> : <ReceiptLongRoundedIcon />}
                >
                  ارسال به هلو
                </Button>
              ) : null}
            </Stack>
          </Stack>
        ) : null}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "auto 1fr",
              md: "42px minmax(120px, 1fr) minmax(150px, 1.25fr) minmax(120px, 0.85fr) minmax(120px, 0.9fr) minmax(120px, 0.9fr) 84px",
            },
            gap: { xs: 0.75, md: 1.25 },
            alignItems: "center",
            px: { xs: 1, md: 1.5 },
            py: 0.75,
            bgcolor: "rgba(var(--mui-palette-text-secondaryChannel) / 0.08)",
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Checkbox
            size="small"
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected}
            onChange={handleToggleAll}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 800 }}
          >
            سفارش
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: "none", md: "block" }, fontWeight: 800 }}
          >
            مشتری
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: "none", md: "block" }, fontWeight: 800 }}
          >
            مبلغ
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: "none", md: "block" }, fontWeight: 800 }}
          >
            پرداخت
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: "none", md: "block" }, fontWeight: 800 }}
          >
            جریان سفارش
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: { xs: "none", md: "block" },
              fontWeight: 800,
              textAlign: "center",
            }}
          >
            عملیات
          </Typography>
        </Box>

        {invoices.length === 0 ? (
          <Box sx={{ py: 6 }}>
            <Stack spacing={2} alignItems="center">
              <ReceiptLongRoundedIcon sx={{ fontSize: 48, opacity: 0.4 }} />
              <Typography variant="subtitle1" color="text.secondary">
                سفارشی برای نمایش وجود ندارد.
              </Typography>
            </Stack>
          </Box>
        ) : (
          <Stack
            divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}
          >
            {invoices.map((invoice) => {
              const statusPalette = STATUS_COLORS[invoice.status];
              const progressState = invoice.progressState ?? null;
              const progressLabel = getProgressLabel(progressState);
              const progressDate = getProgressDate(invoice);
              const paymentStatusLabel = getPaymentStatusLabel(
                invoice.paymentStatus,
              );
              const flow = invoice.orderFlow;
              const flowColor = getOrderFlowColor(flow?.issueLevel);
              const flowTitle = flow
                ? `${flow.serviceLabel}: ${flow.statusLabel}`
                : progressLabel;

              return (
                <Box
                  key={invoice.id}
                  component={Link}
                  href={`/admin/orders/${invoice.id}`}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "auto minmax(0, 1fr) auto",
                      md: "42px minmax(120px, 1fr) minmax(150px, 1.25fr) minmax(120px, 0.85fr) minmax(120px, 0.9fr) minmax(120px, 0.9fr) 84px",
                    },
                    gap: { xs: 0.75, md: 1.25 },
                    alignItems: "center",
                    minWidth: 0,
                    px: { xs: 1, md: 1.5 },
                    py: { xs: 1, md: 1.05 },
                    color: "text.primary",
                    textDecoration: "none",
                    borderInlineStart: "3px solid",
                    borderInlineStartColor: statusPalette.color,
                    transition: "background-color 120ms ease",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={selectedIds.has(invoice.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => handleToggleInvoice(invoice.id, event)}
                  />

                  <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                    <Stack
                      direction="row"
                      alignItems="center"
                      gap={0.75}
                      sx={{ minWidth: 0, flexWrap: "wrap" }}
                    >
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 850, lineHeight: 1.2 }}
                      >
                        #{invoice.number}
                      </Typography>
                      <StatusChip status={invoice.status} />
                      {invoice.appliedOfferCode ? (
                        <Chip
                          label={invoice.appliedOfferCode}
                          size="small"
                          color="secondary"
                          variant="outlined"
                          sx={{ height: 22 }}
                        />
                      ) : null}
                    </Stack>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: { xs: "block", md: "none" } }}
                    >
                      {formatDateTime(invoice.createdAt)}
                    </Typography>
                  </Stack>

                  <Stack
                    spacing={0.35}
                    sx={{ minWidth: 0, display: { xs: "none", md: "flex" } }}
                  >
                    <EllipsisText>
                      {invoice.customerName || "مشخص نشده"}
                    </EllipsisText>
                    <EllipsisText color="text.secondary" dir="ltr">
                      {invoice.customerPhone || "-"}
                    </EllipsisText>
                  </Stack>

                  <Stack
                    spacing={0.35}
                    sx={{ minWidth: 0, display: { xs: "none", md: "flex" } }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 800, whiteSpace: "nowrap" }}
                    >
                      {formatToman(invoice.grandTotal)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(invoice.createdAt)}
                    </Typography>
                  </Stack>

                  <Stack
                    direction="row"
                    gap={0.6}
                    alignItems="center"
                    flexWrap="wrap"
                    sx={{ minWidth: 0, display: { xs: "none", md: "flex" } }}
                  >
                    <Chip
                      label={getPaymentMethodLabel(invoice.paymentMethod)}
                      size="small"
                      variant="outlined"
                      sx={{ maxWidth: 92 }}
                    />
                    {paymentStatusLabel ? (
                      <Chip
                        label={paymentStatusLabel}
                        size="small"
                        color={getPaymentStatusColor(invoice.paymentStatus)}
                        variant="outlined"
                        sx={{ maxWidth: 92 }}
                      />
                    ) : null}
                    {invoice.paymentMethod === "torob" &&
                    invoice.paymentSettledAt ? (
                      <Chip
                        label="تسویه شد"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ maxWidth: 92 }}
                      />
                    ) : null}
                  </Stack>

                  <Stack
                    spacing={0.35}
                    sx={{ minWidth: 0, display: { xs: "none", md: "flex" } }}
                  >
                    <Stack direction="row" gap={0.6} alignItems="center" flexWrap="wrap">
                      <Chip
                        label={flowTitle}
                        size="small"
                        color={flowColor}
                        variant={flow?.issueLevel === "ok" ? "outlined" : "filled"}
                        sx={{ maxWidth: 150 }}
                      />
                      {flow?.source === "marketplace" ? (
                        <Chip
                          label="مارکت‌پلیس"
                          size="small"
                          color="info"
                          variant="outlined"
                          sx={{ maxWidth: 92 }}
                        />
                      ) : null}
                    </Stack>
                    <Typography
                      variant="caption"
                      color={flow?.issue ? "warning.main" : "text.secondary"}
                      sx={{ whiteSpace: "nowrap" }}
                    >
                      {flow?.issue ??
                        (flow?.trackingCode
                          ? `رهگیری: ${flow.trackingCode}`
                          : flow?.shippingServiceName ?? formatDateTime(progressDate))}
                    </Typography>
                    {flow?.lastUpdatedAt ? (
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                        آخرین بروزرسانی: {formatDateTime(flow.lastUpdatedAt)}
                      </Typography>
                    ) : null}
                  </Stack>

                  <Stack
                    direction="row"
                    justifyContent="flex-end"
                    alignItems="center"
                    gap={0.25}
                    sx={{
                      gridColumn: { xs: "3 / 4", md: "auto" },
                      minWidth: 0,
                    }}
                  >
                    {invoice.torobCanSettle ? (
                      <TorobSettleButton
                        invoiceId={invoice.id}
                        onSettled={onRefresh}
                      />
                    ) : null}
                    <Tooltip title="کپی متن ارسال">
                      <IconButton
                        size="small"
                        onClick={(event) => handleCopy(invoice, event)}
                        sx={{ width: 32, height: 32 }}
                      >
                        <ContentCopyRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="نمایش سفارش">
                      <IconButton size="small" sx={{ width: 32, height: 32 }}>
                        <OpenInNewRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <Box
                    sx={{
                      gridColumn: "2 / 4",
                      display: { xs: "grid", md: "none" },
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      gap: 0.75,
                      alignItems: "center",
                      minWidth: 0,
                    }}
                  >
                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                      <EllipsisText>
                        {invoice.customerName || "مشخص نشده"}
                      </EllipsisText>
                      <EllipsisText color="text.secondary" dir="ltr">
                        {invoice.customerPhone || "-"}
                      </EllipsisText>
                    </Stack>
                    <Stack
                      spacing={0.45}
                      alignItems="flex-end"
                      sx={{ minWidth: 0 }}
                    >
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 800, whiteSpace: "nowrap" }}
                      >
                        {formatToman(invoice.grandTotal)}
                      </Typography>
                      <Stack
                        direction="row"
                        gap={0.5}
                        flexWrap="wrap"
                        justifyContent="flex-end"
                      >
                        <Chip
                          label={getPaymentMethodLabel(invoice.paymentMethod)}
                          size="small"
                          variant="outlined"
                          sx={{ height: 22 }}
                        />
                        <Chip
                          label={flowTitle}
                          size="small"
                          color={flowColor}
                          variant={flow?.issueLevel === "ok" ? "outlined" : "filled"}
                          sx={{ height: 22 }}
                        />
                      </Stack>
                    </Stack>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
      {invoices.length > 0 ? (
        <Box
          sx={{
            px: { xs: 1, md: 1.5 },
            py: 1.5,
            display: "flex",
            justifyContent: { xs: "center", md: "flex-end" },
            overflowX: "auto",
          }}
        >
          <AppPagination page={page} pages={pages} />
        </Box>
      ) : null}
    </Card>
  );
}
