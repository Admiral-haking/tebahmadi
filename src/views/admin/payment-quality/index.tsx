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
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckCircleRounded,
  CreditCardRounded,
  ErrorRounded,
  HealthAndSafetyRounded,
  PlayArrowRounded,
  RefreshRounded,
  ReportProblemRounded,
} from "@mui/icons-material";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import type {
  PaymentQualityGateway,
  PaymentQualityResponse,
  PaymentQualityStatus,
  SnappPayEligibilityCheckResult,
} from "@/payments/paymentQuality";

type PaletteColorKey = "primary" | "secondary" | "info" | "success" | "warning" | "error";
const colorVar = (key: PaletteColorKey) => `var(--mui-palette-${key}-main)`;
const colorAlpha = (key: PaletteColorKey, opacity: number) => `rgba(var(--mui-palette-${key}-mainChannel) / ${opacity})`;

type ApiResponse = { data: PaymentQualityResponse };
type EligibilityResponse = { data: SnappPayEligibilityCheckResult };

const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" });

const statusMeta = {
  healthy: { label: "سالم", colorKey: "success", icon: CheckCircleRounded },
  warning: { label: "نیازمند توجه", colorKey: "warning", icon: ReportProblemRounded },
  critical: { label: "بحرانی", colorKey: "error", icon: ErrorRounded },
} satisfies Record<PaymentQualityStatus, { label: string; colorKey: PaletteColorKey; icon: typeof CheckCircleRounded }>;

async function fetcher(url: string): Promise<ApiResponse> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "دریافت وضعیت پرداخت‌ها ناموفق بود.");
  }
  return response.json() as Promise<ApiResponse>;
}

function formatDate(value?: string) {
  if (!value) return "نامشخص";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "نامشخص";
  return dateFormatter.format(date);
}

function GatewayCard({ gateway }: { gateway: PaymentQualityGateway }) {
  const meta = statusMeta[gateway.status];
  const Icon = meta.icon;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        height: "100%",
        borderRadius: 4,
        border: "1px solid",
        borderColor: colorAlpha(meta.colorKey, 0.28),
        background: `linear-gradient(135deg, ${colorAlpha(meta.colorKey, 0.1)}, rgba(var(--mui-palette-background-paperChannel) / 0.95))`,
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: `0 12px 28px ${colorAlpha(meta.colorKey, 0.2)}`,
        },
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 3,
                display: "grid",
                placeItems: "center",
                color: colorVar(meta.colorKey),
                bgcolor: colorAlpha(meta.colorKey, 0.12),
              }}
            >
              <Icon />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={900}>
                {gateway.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                امتیاز سلامت: {numberFormatter.format(gateway.score)}
              </Typography>
            </Box>
          </Stack>
          <Chip label={meta.label} sx={{ color: colorVar(meta.colorKey), borderColor: colorAlpha(meta.colorKey, 0.45) }} variant="outlined" />
        </Stack>

        <LinearProgress
          variant="determinate"
          value={gateway.score}
          sx={{
            height: 8,
            borderRadius: 999,
            bgcolor: colorAlpha(meta.colorKey, 0.12),
            "& .MuiLinearProgress-bar": { bgcolor: colorVar(meta.colorKey) },
          }}
        />

        <Stack direction="row" flexWrap="wrap" gap={1}>
          {gateway.capabilities.map((capability) => (
            <Chip
              key={capability.key}
              size="small"
              label={`${capability.label}: ${
                capability.status === "ready" ? "آماده" : capability.status === "manual" ? "دستی" : "ناقص"
              }`}
              color={capability.status === "ready" ? "success" : capability.status === "manual" ? "warning" : "error"}
              variant={capability.status === "ready" ? "filled" : "outlined"}
            />
          ))}
        </Stack>

        {gateway.callbackUrl ? (
          <Typography variant="caption" color="primary" sx={{ direction: "ltr", wordBreak: "break-all" }}>
            {gateway.callbackUrl}
          </Typography>
        ) : null}

        {gateway.missingKeys.length ? (
          <Alert severity="error">کلیدهای ناقص: {gateway.missingKeys.join(", ")}</Alert>
        ) : null}

        {gateway.warnings.map((warning) => (
          <Alert key={warning} severity="warning">
            {warning}
          </Alert>
        ))}

        <Stack spacing={0.75}>
          {gateway.capabilities.map((capability) => (
            <Typography key={capability.key} variant="body2" color="text.secondary">
              {capability.label}: {capability.note}
            </Typography>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function PaymentQualityView() {
  const { data, error, isLoading, isValidating, mutate } = useSWR("/api/admin/payment-quality", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });
  const [amount, setAmount] = useState("10000000");
  const [eligibility, setEligibility] = useState<SnappPayEligibilityCheckResult | null>(null);
  const [running, setRunning] = useState(false);

  const quality = data?.data;

  const runEligibility = async () => {
    setRunning(true);
    try {
      const response = await fetch("/api/admin/payment-quality", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway: "snapppay", amountRial: Number(amount) }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || "تست eligibility اسنپ‌پی ناموفق بود.");
      }
      const json = (await response.json()) as EligibilityResponse;
      setEligibility(json.data);
      toast.success(json.data.message ?? "تست eligibility اجرا شد.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تست eligibility اسنپ‌پی ناموفق بود.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", py: { xs: 3, md: 5 }, bgcolor: "background.default" }}>
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 4 },
              borderRadius: 5,
              border: "1px solid",
              borderColor: "divider",
              background:
                "radial-gradient(circle at top left, rgba(var(--mui-palette-info-mainChannel) / 0.18), transparent 34%), linear-gradient(135deg, rgba(var(--mui-palette-text-primaryChannel) / 0.04), rgba(var(--mui-palette-success-mainChannel) / 0.06))",
            }}
          >
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <HealthAndSafetyRounded color="primary" />
                  <Typography variant="h4" fontWeight={950}>
                    کنترل کیفیت پرداخت‌ها
                  </Typography>
                </Stack>
                <Typography color="text.secondary">
                  وضعیت زرین‌پال، ترب‌پی، دیجی‌پی، ازکی‌وام و اسنپ‌پی از نظر تنظیمات، callback، verify و eligibility.
                </Typography>
                {quality ? (
                  <Typography variant="caption" color="text.secondary">
                    آخرین بررسی: {formatDate(quality.generatedAt)}
                  </Typography>
                ) : null}
              </Stack>
              <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
                {quality ? (
                  <>
                    <Chip color="success" label={`${numberFormatter.format(quality.summary.healthy)} سالم`} />
                    <Chip color="warning" label={`${numberFormatter.format(quality.summary.warning)} هشدار`} />
                    <Chip color="error" label={`${numberFormatter.format(quality.summary.critical)} بحرانی`} />
                    <Chip variant="outlined" label={`${numberFormatter.format(quality.summary.totalMissingKeys)} کلید ناقص`} />
                  </>
                ) : null}
                <Button startIcon={isValidating ? <CircularProgress size={16} /> : <RefreshRounded />} onClick={() => mutate()}>
                  بروزرسانی
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {error ? <Alert severity="error">{error.message}</Alert> : null}
          {isLoading ? <LinearProgress /> : null}

          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "center" }}>
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CreditCardRounded color="success" />
                  <Typography variant="h6" fontWeight={900}>
                    تست زنده eligibility اسنپ‌پی
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  این تست فقط سرویس eligible را صدا می‌زند و پرداخت یا verify واقعی انجام نمی‌دهد.
                </Typography>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField
                  label="مبلغ تست به ریال"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  size="small"
                  sx={{ minWidth: 220 }}
                />
                <Button variant="contained" startIcon={running ? <CircularProgress size={16} /> : <PlayArrowRounded />} onClick={runEligibility} disabled={running}>
                  اجرای تست
                </Button>
              </Stack>
            </Stack>
            {eligibility ? (
              <Alert severity={eligibility.ok ? "success" : "warning"} sx={{ mt: 2 }}>
                {eligibility.message}
                {eligibility.result?.description ? ` ${eligibility.result.description}` : ""}
              </Alert>
            ) : null}
          </Paper>

          <Grid container spacing={2.5}>
            {quality?.gateways.map((gateway) => (
              <Grid key={gateway.id} size={{ xs: 12, md: 6, xl: 4 }}>
                <GatewayCard gateway={gateway} />
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
