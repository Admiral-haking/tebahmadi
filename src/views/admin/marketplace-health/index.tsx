"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import {
  ArrowBackRounded,
  CheckCircleRounded,
  ErrorRounded,
  HubRounded,
  Inventory2Rounded,
  LocalShippingRounded,
  PlayArrowRounded,
  RefreshRounded,
  ReportProblemRounded,
  ScheduleRounded,
  SyncRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import type { MarketplaceHealthResponse, MarketplaceHealthItem } from "@/marketplace/health";

const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});

type ApiResponse = {
  data: MarketplaceHealthResponse;
};

type SyncJobItem = {
  id: string;
  type: "orders-from-services" | "stock-from-services" | "stock-to-services";
  status: "queued" | "running" | "succeeded" | "failed";
  attempts: number;
  maxAttempts: number;
  interruptions?: number;
  runAfter: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs?: number | null;
  result?: {
    pushedVariants?: number;
    pushed?: { attempted?: number; succeeded?: number; failed?: number };
    reconciled?: { attempted?: number; succeeded?: number; failed?: number };
  } | null;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

type SyncJobsResponse = {
  data: {
    jobs: SyncJobItem[];
    counts: Record<string, number>;
  };
};

// colorKey is a MUI palette key; styling reads --mui-palette-<colorKey>-* below.
type PaletteColorKey = "primary" | "secondary" | "info" | "success" | "warning" | "error";
const colorVar = (key: PaletteColorKey) => `var(--mui-palette-${key}-main)`;
const colorAlpha = (key: PaletteColorKey, opacity: number) => `rgba(var(--mui-palette-${key}-mainChannel) / ${opacity})`;

const statusMeta = {
  healthy: {
    label: "سالم",
    colorKey: "success",
    icon: CheckCircleRounded,
  },
  warning: {
    label: "نیازمند توجه",
    colorKey: "warning",
    icon: ReportProblemRounded,
  },
  critical: {
    label: "بحرانی",
    colorKey: "error",
    icon: ErrorRounded,
  },
} satisfies Record<MarketplaceHealthItem["status"], { label: string; colorKey: PaletteColorKey; icon: typeof CheckCircleRounded }>;

const syncStatusMeta = {
  queued: { label: "در صف", colorKey: "info" },
  running: { label: "در حال اجرا", colorKey: "warning" },
  succeeded: { label: "موفق", colorKey: "success" },
  failed: { label: "ناموفق", colorKey: "error" },
} satisfies Record<SyncJobItem["status"], { label: string; colorKey: PaletteColorKey }>;

async function fetcher(url: string): Promise<ApiResponse> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "دریافت وضعیت مارکت‌پلیس‌ها ناموفق بود.");
  }
  return response.json() as Promise<ApiResponse>;
}

async function fetchSyncJobs(url: string): Promise<SyncJobsResponse> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "دریافت وضعیت صف همگام‌سازی ناموفق بود.");
  }
  return response.json() as Promise<SyncJobsResponse>;
}

function formatDate(value: string | null) {
  if (!value) return "ثبت نشده";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "نامشخص";
  return dateFormatter.format(date);
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${numberFormatter.format(ms)} میلی‌ثانیه`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${numberFormatter.format(Math.round(seconds))} ثانیه`;
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return rem ? `${numberFormatter.format(minutes)} دقیقه ${numberFormatter.format(rem)} ثانیه` : `${numberFormatter.format(minutes)} دقیقه`;
}

function getSyncTypeLabel(type: SyncJobItem["type"]) {
  if (type === "orders-from-services") return "دریافت سفارش‌ها";
  if (type === "stock-from-services") return "خواندن موجودی سرویس‌ها";
  return "ارسال موجودی به سرویس‌ها";
}

function MetricPill({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" | "danger" }) {
  const colorKey = tone === "danger" ? "error" : tone === "warning" ? "warning" : "text";
  const colorVar = colorKey === "text" ? "var(--mui-palette-text-primary)" : `var(--mui-palette-${colorKey}-main)`;
  const colorChannel = colorKey === "text" ? "var(--mui-palette-text-primaryChannel)" : `var(--mui-palette-${colorKey}-mainChannel)`;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        borderRadius: 2,
        border: "1px solid",
        borderColor: `rgba(${colorChannel} / 0.22)`,
        bgcolor: `rgba(${colorChannel} / 0.07)`,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle1" fontWeight={900} sx={{ color: colorVar }}>
        {numberFormatter.format(value)}
      </Typography>
    </Paper>
  );
}

function SyncQueuePanel({
  data,
  isLoading,
  isRunning,
  onRun,
}: {
  data?: SyncJobsResponse["data"];
  isLoading: boolean;
  isRunning: boolean;
  onRun: () => void;
}) {
  const jobs = data?.jobs ?? [];
  const counts = data?.counts ?? {};
  const waitingCount = Number(counts.queued ?? 0) + Number(counts.running ?? 0);

  // Operational alerts derived from the queue — surface what needs attention.
  const alerts: { severity: "warning" | "error"; text: string }[] = [];
  if (Number(counts.queued ?? 0) > 6) {
    alerts.push({ severity: "warning", text: `صف شلوغ است: ${numberFormatter.format(Number(counts.queued))} job در انتظار` });
  }
  if (Number(counts.failed ?? 0) > 0) {
    alerts.push({ severity: "error", text: `${numberFormatter.format(Number(counts.failed))} job ناموفق — نیازمند بررسی` });
  }
  const longRunning = jobs.find((j) => j.status === "running" && j.startedAt && Date.now() - new Date(j.startedAt).getTime() > 12 * 60_000);
  if (longRunning) {
    alerts.push({ severity: "warning", text: `«${getSyncTypeLabel(longRunning.type)}» بیش از ۱۲ دقیقه در حال اجراست` });
  }
  for (const j of jobs) {
    const p = j.result?.pushed;
    const attempted = Number(p?.attempted ?? 0);
    const failed = Number(p?.failed ?? 0);
    if (attempted >= 10 && failed / attempted > 0.3) {
      alerts.push({ severity: "warning", text: `نرخ خطای ارسال «${getSyncTypeLabel(j.type)}» بالاست: ${numberFormatter.format(failed)}/${numberFormatter.format(attempted)}` });
      break;
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 2.75 },
        borderRadius: 4,
        border: "1px solid",
        borderColor: colorAlpha("info", 0.24),
        background:
          "linear-gradient(135deg, rgba(var(--mui-palette-info-mainChannel) / 0.16), rgba(var(--mui-palette-background-defaultChannel) / 0.9) 48%, rgba(var(--mui-palette-success-mainChannel) / 0.12))",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: 220,
          height: 220,
          borderRadius: "50%",
          insetInlineEnd: -80,
          top: -100,
          bgcolor: colorAlpha("info", 0.14),
          filter: "blur(3px)",
        }}
      />

      <Stack spacing={2.25} sx={{ position: "relative" }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2.5,
                display: "grid",
                placeItems: "center",
                color: "var(--mui-palette-info-main)",
                bgcolor: colorAlpha("info", 0.13),
                boxShadow: `inset 0 0 0 1px ${colorAlpha("info", 0.2)}`,
              }}
            >
              <SyncRounded />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={950}>
                صف هوشمند همگام‌سازی
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.9 }}>
                سفارش‌ها و موجودی‌ها به‌جای اجرای شکننده، وارد صف می‌شوند و در صورت خطا با فاصله‌ی زمانی دوباره تلاش می‌کنند.
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            startIcon={isRunning ? <CircularProgress size={16} color="inherit" /> : <PlayArrowRounded />}
            onClick={onRun}
            disabled={isRunning}
            sx={{
              alignSelf: { xs: "stretch", md: "center" },
              borderRadius: 2,
              fontWeight: 900,
              px: 2.25,
              bgcolor: "var(--mui-palette-grey-900)",
              color: "common.white",
              "&:hover": { bgcolor: "var(--mui-palette-grey-800)" },
            }}
          >
            اجرای jobهای آماده
          </Button>
        </Stack>

        {isLoading ? <LinearProgress /> : null}

        {alerts.length ? (
          <Stack spacing={0.75}>
            {alerts.map((a, i) => (
              <Alert key={i} severity={a.severity} variant="outlined" sx={{ py: 0.25 }}>
                {a.text}
              </Alert>
            ))}
          </Stack>
        ) : (
          <Alert severity="success" variant="outlined" sx={{ py: 0.25 }}>
            وضعیت صف سالم است — موردی برای توجه نیست.
          </Alert>
        )}

        <Grid container spacing={1.25}>
          {(["queued", "running", "failed", "succeeded"] as const).map((status) => {
            const meta = syncStatusMeta[status];
            return (
              <Grid key={status} size={{ xs: 6, md: 3 }}>
                <MetricPill label={meta.label} value={Number(counts[status] ?? 0)} tone={status === "failed" ? "danger" : status === "running" ? "warning" : "default"} />
              </Grid>
            );
          })}
        </Grid>

        <Stack spacing={1}>
          {jobs.length ? (
            jobs.slice(0, 6).map((job) => {
              const meta = syncStatusMeta[job.status];
              return (
                <Paper
                  key={job.id}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 2.5,
                    border: "1px solid",
                    borderColor: colorAlpha(meta.colorKey, 0.2),
                    bgcolor: "rgba(var(--mui-palette-background-paperChannel) / 0.76)",
                  }}
                >
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.25}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="subtitle2" fontWeight={900}>
                          {getSyncTypeLabel(job.type)}
                        </Typography>
                        <Chip
                          size="small"
                          label={meta.label}
                          sx={{
                            height: 24,
                            color: colorVar(meta.colorKey),
                            bgcolor: colorAlpha(meta.colorKey, 0.12),
                            border: "1px solid",
                            borderColor: colorAlpha(meta.colorKey, 0.24),
                            fontWeight: 800,
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          تلاش {numberFormatter.format(job.attempts)} از {numberFormatter.format(job.maxAttempts)}
                        </Typography>
                        {job.interruptions && job.interruptions > 0 ? (
                          <Chip size="small" variant="outlined" color="warning" sx={{ height: 20 }}
                            label={`${numberFormatter.format(job.interruptions)} وقفه`} />
                        ) : null}
                        {typeof job.durationMs === "number" && job.durationMs > 0 ? (
                          <Chip size="small" variant="outlined" label={`⏱ ${formatDuration(job.durationMs)}`} sx={{ height: 20 }} />
                        ) : null}
                      </Stack>

                      {job.result?.pushed || job.result?.reconciled ? (
                        <Typography variant="caption" color="text.secondary">
                          {(() => {
                            const p = job.result?.pushed;
                            const r = job.result?.reconciled;
                            const parts: string[] = [];
                            if (p && (p.attempted ?? 0) > 0) parts.push(`ارسال: ${numberFormatter.format(p.succeeded ?? 0)}/${numberFormatter.format(p.attempted ?? 0)}${(p.failed ?? 0) ? ` (${numberFormatter.format(p.failed ?? 0)} خطا)` : ""}`);
                            if (r && (r.attempted ?? 0) > 0) parts.push(`تطبیق: ${numberFormatter.format(r.succeeded ?? 0)}/${numberFormatter.format(r.attempted ?? 0)}`);
                            return parts.join(" • ");
                          })()}
                        </Typography>
                      ) : null}
                      {job.lastError ? (() => {
                        // A requeue after a dead worker is normal housekeeping, not a
                        // failure — show it as an info note, not a red error.
                        const benign = job.lastError === "sync_job_requeued_after_stale_lock";
                        return (
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <WarningAmberRounded sx={{ color: benign ? "var(--mui-palette-info-main)" : "var(--mui-palette-error-main)", fontSize: 17 }} />
                            <Typography variant="caption" color={benign ? "info.main" : "error.main"}>
                              {benign ? "اجرای قبلی ناتمام ماند و دوباره به صف رفت (عادی)" : job.lastError}
                            </Typography>
                          </Stack>
                        );
                      })() : null}
                    </Stack>
                    <Stack direction="row" spacing={0.75} alignItems="center" color="text.secondary">
                      <ScheduleRounded sx={{ fontSize: 17 }} />
                      <Typography variant="caption">
                        اجرای بعدی: {formatDate(job.runAfter)}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>
              );
            })
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2.5,
                border: "1px dashed",
                borderColor: "rgba(var(--mui-palette-text-primaryChannel) / 0.18)",
                bgcolor: "rgba(var(--mui-palette-background-paperChannel) / 0.52)",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                هنوز job همگام‌سازی ثبت نشده؛ بعد از اولین دریافت سفارش یا بروزرسانی موجودی، اینجا تاریخچه و وضعیت تلاش‌ها دیده می‌شود.
              </Typography>
            </Paper>
          )}
        </Stack>

        {waitingCount ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            {numberFormatter.format(waitingCount)} job در صف یا در حال اجراست؛ اگر سرویس مقصد کند باشد، اجرای بعدی خودکار با backoff انجام می‌شود.
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}

function HealthCard({ item }: { item: MarketplaceHealthItem }) {
  const meta = statusMeta[item.status];
  const StatusIcon = meta.icon;

  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%",
        p: { xs: 2, md: 2.5 },
        borderRadius: 3,
        border: "1px solid",
        borderColor: colorAlpha(meta.colorKey, 0.28),
        background: `linear-gradient(145deg, ${colorAlpha(meta.colorKey, 0.13)}, rgba(var(--mui-palette-background-paperChannel) / 0.92) 46%, rgba(var(--mui-palette-text-primaryChannel) / 0.05))`,
        overflow: "hidden",
        position: "relative",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: `0 12px 28px ${colorAlpha(meta.colorKey, 0.22)}`,
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: 160,
          height: 160,
          borderRadius: "50%",
          insetInlineStart: -70,
          top: -70,
          bgcolor: colorAlpha(meta.colorKey, 0.16),
          filter: "blur(2px)",
        }}
      />

      <Stack spacing={2} sx={{ position: "relative" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                color: colorVar(meta.colorKey),
                bgcolor: colorAlpha(meta.colorKey, 0.13),
                boxShadow: `inset 0 0 0 1px ${colorAlpha(meta.colorKey, 0.18)}`,
              }}
            >
              <HubRounded />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                {item.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.connected ? `${item.vendors.length.toLocaleString("fa-IR")} فروشنده متصل` : "اتصال ثبت نشده"}
              </Typography>
            </Box>
          </Stack>
          <Chip
            icon={<StatusIcon />}
            label={meta.label}
            size="small"
            sx={{
              color: colorVar(meta.colorKey),
              bgcolor: colorAlpha(meta.colorKey, 0.12),
              border: "1px solid",
              borderColor: colorAlpha(meta.colorKey, 0.24),
              fontWeight: 800,
              "& .MuiChip-icon": { color: colorVar(meta.colorKey) },
            }}
          />
        </Stack>

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
            <Typography variant="body2" color="text.secondary">
              امتیاز سلامت
            </Typography>
            <Typography variant="subtitle2" fontWeight={900} sx={{ color: colorVar(meta.colorKey) }}>
              {numberFormatter.format(item.score)}٪
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={item.score}
            sx={{
              height: 9,
              borderRadius: 99,
              bgcolor: colorAlpha(meta.colorKey, 0.13),
              "& .MuiLinearProgress-bar": {
                bgcolor: colorVar(meta.colorKey),
                borderRadius: 99,
              },
            }}
          />
        </Box>

        <Grid container spacing={1}>
          <Grid size={{ xs: 6 }}>
            <MetricPill label="تنوع‌ها" value={item.metrics.totalVariants} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <MetricPill label="سفارش باز" value={item.metrics.openOrders} tone={item.metrics.openOrders ? "warning" : "default"} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <MetricPill label="اختلاف موجودی" value={item.metrics.stockMismatches} tone={item.metrics.stockMismatches ? "danger" : "default"} />
          </Grid>
          <Grid size={{ xs: 6 }}>
            <MetricPill label="بدون بارکد" value={item.metrics.missingBarcodes} tone={item.metrics.missingBarcodes ? "warning" : "default"} />
          </Grid>
          {typeof item.metrics.failedPayments === "number" ? (
            <Grid size={{ xs: 6 }}>
              <MetricPill label="پرداخت ناموفق" value={item.metrics.failedPayments} tone={item.metrics.failedPayments ? "danger" : "default"} />
            </Grid>
          ) : null}
          {typeof item.metrics.paymentRequests === "number" ? (
            <Grid size={{ xs: 6 }}>
              <MetricPill label="درخواست پرداخت" value={item.metrics.paymentRequests} />
            </Grid>
          ) : null}
        </Grid>

        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            آخرین بروزرسانی موجودی: {formatDate(item.lastSyncAt)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            آخرین سفارش: {formatDate(item.lastOrderAt)}
          </Typography>
        </Stack>

        <Stack spacing={0.75}>
          {item.issues.slice(0, 3).map((issue) => (
            <Stack key={issue} direction="row" spacing={0.75} alignItems="flex-start">
              <ReportProblemRounded sx={{ color: colorVar(meta.colorKey), fontSize: 17, mt: 0.1 }} />
              <Typography variant="caption" color="text.secondary">
                {issue}
              </Typography>
            </Stack>
          ))}
        </Stack>

        <Button
          component={Link}
          href={item.actionHref}
          variant="outlined"
          endIcon={<ArrowBackRounded />}
          sx={{
            borderRadius: 2,
            borderColor: colorAlpha(meta.colorKey, 0.45),
            color: colorVar(meta.colorKey),
            fontWeight: 800,
            "&:hover": {
              borderColor: colorVar(meta.colorKey),
              bgcolor: colorAlpha(meta.colorKey, 0.08),
            },
          }}
        >
          رفتن به مدیریت {item.title}
        </Button>
      </Stack>
    </Paper>
  );
}

function SummaryCard({ icon, label, value, colorKey }: { icon: ReactNode; label: string; value: number; colorKey: PaletteColorKey }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid",
        borderColor: colorAlpha(colorKey, 0.22),
        bgcolor: colorAlpha(colorKey, 0.08),
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            color: colorVar(colorKey),
            bgcolor: colorAlpha(colorKey, 0.13),
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h6" fontWeight={900}>
            {numberFormatter.format(value)}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function MarketplaceHealthView() {
  const { data, error, isLoading, isValidating, mutate } = useSWR("/api/admin/marketplace-health", fetcher, {
    refreshInterval: 60_000,
  });
  const {
    data: syncJobsData,
    error: syncJobsError,
    isLoading: syncJobsLoading,
    mutate: mutateSyncJobs,
  } = useSWR("/api/admin/sync-jobs", fetchSyncJobs, {
    refreshInterval: 30_000,
  });
  const [isRunningSync, setIsRunningSync] = useState(false);
  const result = data?.data;

  async function handleRunSyncQueue() {
    setIsRunningSync(true);
    try {
      const response = await fetch("/api/admin/sync-jobs", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "اجرای صف همگام‌سازی ناموفق بود.");
      }
      toast.success("صف همگام‌سازی اجرا شد.");
      await Promise.all([mutateSyncJobs(), mutate()]);
    } catch (syncError) {
      toast.error(syncError instanceof Error ? syncError.message : "اجرای صف همگام‌سازی ناموفق بود.");
    } finally {
      setIsRunningSync(false);
    }
  }

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack spacing={3}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 3.5 },
            borderRadius: 4,
            color: "common.white",
            background:
              "radial-gradient(circle at 12% 20%, rgba(var(--mui-palette-success-mainChannel) / 0.38), transparent 30%), linear-gradient(135deg, var(--mui-palette-grey-900), var(--mui-palette-info-dark) 52%, var(--mui-palette-success-dark))",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="overline" sx={{ opacity: 0.78, letterSpacing: 1 }}>
                Marketplace Health Center
              </Typography>
              <Typography variant="h4" fontWeight={950} sx={{ mt: 0.5 }}>
                داشبورد سلامت مارکت‌پلیس‌ها
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, maxWidth: 720, opacity: 0.82, lineHeight: 1.9 }}>
                وضعیت اتصال، موجودی، سفارش‌های باز و خطاهای قابل تشخیص هر سرویس اینجا جمع می‌شود تا قبل از اینکه سفارش یا فروش از دست برود، مشکل خودش را لو بدهد.
              </Typography>
            </Box>
            <Stack alignItems={{ xs: "stretch", md: "flex-end" }} spacing={1}>
              <Button
                variant="contained"
                color="inherit"
                startIcon={isValidating ? <CircularProgress size={16} color="inherit" /> : <RefreshRounded />}
                onClick={() => void mutate()}
                sx={{ color: "var(--mui-palette-grey-900)", borderRadius: 2, fontWeight: 900 }}
              >
                بروزرسانی وضعیت
              </Button>
              <Typography variant="caption" sx={{ opacity: 0.72 }}>
                آخرین تولید: {formatDate(result?.generatedAt ?? null)}
              </Typography>
            </Stack>
          </Stack>
        </Paper>

        {error ? (
          <Alert severity="error">
            {error instanceof Error ? error.message : "دریافت داده‌های سلامت ناموفق بود."}
          </Alert>
        ) : null}

        {syncJobsError ? (
          <Alert severity="warning">
            {syncJobsError instanceof Error ? syncJobsError.message : "دریافت وضعیت صف همگام‌سازی ناموفق بود."}
          </Alert>
        ) : null}

        {isLoading ? <LinearProgress /> : null}

        {result ? (
          <>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <SummaryCard icon={<CheckCircleRounded />} label="سرویس سالم" value={result.summary.healthy} colorKey="success" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <SummaryCard icon={<ReportProblemRounded />} label="نیازمند توجه" value={result.summary.warning} colorKey="warning" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <SummaryCard icon={<LocalShippingRounded />} label="سفارش باز" value={result.summary.totalOpenOrders} colorKey="info" />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                <SummaryCard icon={<Inventory2Rounded />} label="اختلاف موجودی" value={result.summary.totalStockMismatches} colorKey="error" />
              </Grid>
            </Grid>

            <SyncQueuePanel
              data={syncJobsData?.data}
              isLoading={syncJobsLoading}
              isRunning={isRunningSync}
              onRun={handleRunSyncQueue}
            />

            <Grid container spacing={2}>
              {result.services.map((item) => (
                <Grid key={item.id} size={{ xs: 12, md: 6, xl: 3 }}>
                  <HealthCard item={item} />
                </Grid>
              ))}
            </Grid>
          </>
        ) : null}
      </Stack>
    </Container>
  );
}
