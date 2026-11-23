"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  BugReportRounded,
  CheckCircleRounded,
  DeleteSweepRounded,
  ErrorRounded,
  RefreshRounded,
  ReportProblemRounded,
  VisibilityRounded,
} from "@mui/icons-material";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PageJumper } from "@/components/search/pagination";
import useSWR from "swr";
import { toast } from "sonner";

type ErrorLogLevel = "error" | "warning" | "info";
type ErrorLogCategory = "api" | "payment" | "sync" | "marketplace" | "ai" | "system";

type ErrorLogItem = {
  id: string;
  level: ErrorLogLevel;
  category: ErrorLogCategory;
  source: string;
  message: string;
  stack?: string;
  statusCode?: number;
  route?: string;
  method?: string;
  fingerprint?: string;
  metadata?: unknown;
  resolvedAt?: string | null;
  resolvedNote?: string;
  createdAt: string;
  updatedAt: string;
};

type ErrorLogsResponse = {
  data: ErrorLogItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total: number;
    open: number;
    resolved: number;
    error: number;
    warning: number;
    info: number;
  };
  daily?: Array<{ date: string; total: number; error: number }>;
};

const numberFormatter = new Intl.NumberFormat("fa-IR");
const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
  timeStyle: "short",
});

type PaletteColorKey = "primary" | "secondary" | "info" | "success" | "warning" | "error";
const colorVar = (key: PaletteColorKey) => `var(--mui-palette-${key}-main)`;
const colorAlpha = (key: PaletteColorKey, opacity: number) => `rgba(var(--mui-palette-${key}-mainChannel) / ${opacity})`;

const levelMeta: Record<ErrorLogLevel, { label: string; color: "error" | "warning" | "info" }> = {
  error: { label: "خطا", color: "error" },
  warning: { label: "هشدار", color: "warning" },
  info: { label: "اطلاع", color: "info" },
};

const categoryLabels: Record<ErrorLogCategory, string> = {
  api: "API",
  payment: "پرداخت",
  sync: "Sync",
  marketplace: "مارکت‌پلیس",
  ai: "هوش مصنوعی",
  system: "سیستم",
};

async function fetcher(url: string): Promise<ErrorLogsResponse> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "دریافت لاگ خطاها ناموفق بود.");
  }
  return response.json() as Promise<ErrorLogsResponse>;
}

function formatDate(value?: string | null) {
  if (!value) return "ثبت نشده";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "نامشخص" : dateFormatter.format(date);
}

function buildUrl(filters: {
  page: number;
  q: string;
  level: string;
  category: string;
  resolved: string;
}) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("limit", "25");
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.level) params.set("level", filters.level);
  if (filters.category) params.set("category", filters.category);
  if (filters.resolved) params.set("resolved", filters.resolved);
  return `/api/admin/error-logs?${params.toString()}`;
}

function StatCard({ title, value, colorKey, icon }: { title: string; value: number; colorKey: PaletteColorKey; icon: ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid",
        borderColor: colorAlpha(colorKey, 0.22),
        bgcolor: colorAlpha(colorKey, 0.08),
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: `0 10px 22px ${colorAlpha(colorKey, 0.18)}`,
        },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            width: 42,
            height: 42,
            display: "grid",
            placeItems: "center",
            borderRadius: 2,
            color: colorVar(colorKey),
            bgcolor: colorAlpha(colorKey, 0.14),
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h6" fontWeight={900}>
            {numberFormatter.format(value)}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

/** Tiny dependency-free 7-day bar chart: total logs (grey) + errors (red) per day. */
function WeeklyTrendChart({ daily }: { daily: Array<{ date: string; total: number; error: number }> }) {
  const max = Math.max(1, ...daily.map((d) => d.total));
  const dayFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "short" });

  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: 1, borderColor: "divider" }}>
      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>
        روند خطاها در ۷ روز اخیر
      </Typography>
      <Stack direction="row" alignItems="flex-end" justifyContent="space-between" gap={1} sx={{ height: 120 }}>
        {daily.map((d) => {
          const totalH = Math.round((d.total / max) * 96);
          const errorH = Math.round((d.error / max) * 96);
          const label = (() => {
            try { return dayFmt.format(new Date(`${d.date}T00:00:00`)); } catch { return d.date.slice(5); }
          })();
          return (
            <Tooltip key={d.date} title={`${d.date} — کل: ${d.total} | خطا: ${d.error}`}>
              <Stack alignItems="center" gap={0.5} sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ position: "relative", width: "100%", maxWidth: 26, height: 96, display: "flex", alignItems: "flex-end" }}>
                  <Box sx={{ position: "absolute", bottom: 0, width: "100%", height: Math.max(totalH, 2), bgcolor: "action.selected", borderRadius: 1 }} />
                  <Box sx={{ position: "absolute", bottom: 0, width: "100%", height: errorH, bgcolor: "error.main", borderRadius: 1 }} />
                </Box>
                <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
              </Stack>
            </Tooltip>
          );
        })}
      </Stack>
      <Stack direction="row" gap={2} sx={{ mt: 1 }} justifyContent="center">
        <Stack direction="row" gap={0.5} alignItems="center">
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: "action.selected" }} />
          <Typography variant="caption" color="text.secondary">کل لاگ‌ها</Typography>
        </Stack>
        <Stack direction="row" gap={0.5} alignItems="center">
          <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: "error.main" }} />
          <Typography variant="caption" color="text.secondary">خطاها</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

function DetailDialog({ item, onClose }: { item: ErrorLogItem | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(item)} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>جزئیات خطا</DialogTitle>
      <DialogContent>
        {item ? (
          <Stack spacing={2} sx={{ py: 1 }}>
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Chip label={levelMeta[item.level].label} color={levelMeta[item.level].color} />
              <Chip label={categoryLabels[item.category]} variant="outlined" />
              {item.statusCode ? <Chip label={`HTTP ${item.statusCode}`} variant="outlined" /> : null}
              {item.resolvedAt ? <Chip label="حل‌شده" color="success" /> : <Chip label="باز" color="warning" />}
            </Stack>
            <Box>
              <Typography variant="caption" color="text.secondary">
                منبع
              </Typography>
              <Typography variant="body2" fontWeight={800}>
                {item.source}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                پیام
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {item.message}
              </Typography>
            </Box>
            {item.route ? (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  مسیر
                </Typography>
                <Typography variant="body2" dir="ltr">
                  {item.method ? `${item.method} ` : ""}
                  {item.route}
                </Typography>
              </Box>
            ) : null}
            {item.stack ? (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Stack
                </Typography>
                <Paper
                  elevation={0}
                  sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(var(--mui-palette-text-primaryChannel) / 0.06)", maxHeight: 260, overflow: "auto" }}
                >
                  <Typography variant="caption" component="pre" dir="ltr" sx={{ m: 0, whiteSpace: "pre-wrap" }}>
                    {item.stack}
                  </Typography>
                </Paper>
              </Box>
            ) : null}
            {item.metadata ? (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Metadata
                </Typography>
                <Paper
                  elevation={0}
                  sx={{ p: 1.5, borderRadius: 2, bgcolor: "rgba(var(--mui-palette-text-primaryChannel) / 0.06)", maxHeight: 260, overflow: "auto" }}
                >
                  <Typography variant="caption" component="pre" dir="ltr" sx={{ m: 0, whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(item.metadata, null, 2)}
                  </Typography>
                </Paper>
              </Box>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              ثبت: {formatDate(item.createdAt)} | آخرین تغییر: {formatDate(item.updatedAt)}
            </Typography>
          </Stack>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function ErrorLogsView() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [category, setCategory] = useState("");
  const [resolved, setResolved] = useState("false");
  const [selected, setSelected] = useState<ErrorLogItem | null>(null);

  // Debounce the search term so we don't refetch on every keystroke.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(id);
  }, [q]);

  const url = useMemo(
    () => buildUrl({ page, q: debouncedQ, level, category, resolved }),
    [page, debouncedQ, level, category, resolved],
  );
  const { data, error, isLoading, isValidating, mutate } = useSWR(url, fetcher, { refreshInterval: 30_000 });

  async function markResolved(item: ErrorLogItem) {
    const response = await fetch("/api/admin/error-logs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ ids: [item.id], resolved: !item.resolvedAt }),
    });
    if (!response.ok) {
      toast.error("بروزرسانی وضعیت لاگ انجام نشد.");
      return;
    }
    toast.success(item.resolvedAt ? "لاگ دوباره باز شد." : "لاگ حل‌شده شد.");
    await mutate();
  }

  async function cleanupResolved() {
    const response = await fetch("/api/admin/error-logs?resolvedOnly=true&olderThanDays=30", {
      method: "DELETE",
      credentials: "include",
    });
    if (!response.ok) {
      toast.error("پاکسازی لاگ‌ها انجام نشد.");
      return;
    }
    const result = await response.json();
    toast.success(`${numberFormatter.format(Number(result.deleted ?? 0))} لاگ قدیمی پاک شد.`);
    await mutate();
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
              "radial-gradient(circle at 15% 18%, rgba(var(--mui-palette-error-mainChannel) / 0.42), transparent 30%), linear-gradient(135deg, var(--mui-palette-grey-900), var(--mui-palette-error-dark) 55%, var(--mui-palette-grey-800))",
          }}
        >
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="overline" sx={{ opacity: 0.75 }}>
                Operations Error Log
              </Typography>
              <Typography variant="h4" fontWeight={950}>
                لاگ خطاهای پروژه
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, maxWidth: 720, opacity: 0.82, lineHeight: 1.9 }}>
                خطاهای مهم API، پرداخت، sync و مارکت‌پلیس‌ها اینجا ذخیره می‌شوند تا ردشان در console گم نشود.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems={{ xs: "stretch", sm: "center" }}>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<RefreshRounded />}
                onClick={() => void mutate()}
                sx={{ color: "var(--mui-palette-grey-900)", borderRadius: 2, fontWeight: 900 }}
              >
                بروزرسانی
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<DeleteSweepRounded />}
                onClick={cleanupResolved}
                sx={{ borderRadius: 2, fontWeight: 900 }}
              >
                پاکسازی حل‌شده‌های قدیمی
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {error ? <Alert severity="error">{error instanceof Error ? error.message : "خطا در دریافت لاگ‌ها"}</Alert> : null}
        {(isLoading || isValidating) && <LinearProgress />}

        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard title="کل لاگ‌ها" value={data?.stats.total ?? 0} colorKey="info" icon={<BugReportRounded />} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard title="باز" value={data?.stats.open ?? 0} colorKey="warning" icon={<ReportProblemRounded />} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard title="خطا" value={data?.stats.error ?? 0} colorKey="error" icon={<ErrorRounded />} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard title="حل‌شده" value={data?.stats.resolved ?? 0} colorKey="success" icon={<CheckCircleRounded />} />
          </Grid>
        </Grid>

        {data?.daily && data.daily.length > 0 ? <WeeklyTrendChart daily={data.daily} /> : null}

        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: 1, borderColor: "divider" }}>
          <Grid container spacing={1.25} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="جستجو در پیام، منبع، مسیر"
                value={q}
                onChange={(event) => {
                  setPage(1);
                  setQ(event.target.value);
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>سطح</InputLabel>
                <Select label="سطح" value={level} onChange={(event) => { setPage(1); setLevel(event.target.value); }}>
                  <MenuItem value="">همه</MenuItem>
                  <MenuItem value="error">خطا</MenuItem>
                  <MenuItem value="warning">هشدار</MenuItem>
                  <MenuItem value="info">اطلاع</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>دسته</InputLabel>
                <Select label="دسته" value={category} onChange={(event) => { setPage(1); setCategory(event.target.value); }}>
                  <MenuItem value="">همه</MenuItem>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 4, md: 2 }}>
              <FormControl fullWidth>
                <InputLabel>وضعیت</InputLabel>
                <Select label="وضعیت" value={resolved} onChange={(event) => { setPage(1); setResolved(event.target.value); }}>
                  <MenuItem value="">همه</MenuItem>
                  <MenuItem value="false">باز</MenuItem>
                  <MenuItem value="true">حل‌شده</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Typography variant="body2" color="text.secondary" textAlign={{ xs: "right", md: "left" }}>
                {numberFormatter.format(data?.pagination.total ?? 0)} لاگ
              </Typography>
            </Grid>
          </Grid>
        </Paper>

        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: 1, borderColor: "divider" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>سطح</TableCell>
                <TableCell>پیام</TableCell>
                <TableCell>منبع</TableCell>
                <TableCell>دسته</TableCell>
                <TableCell>زمان</TableCell>
                <TableCell>وضعیت</TableCell>
                <TableCell align="right">عملیات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.data.map((item, rowIndex) => (
                <TableRow
                  key={item.id}
                  hover
                  sx={{
                    // Subtle level tint for error/warning; zebra striping otherwise.
                    bgcolor:
                      item.level === "error"
                        ? "rgba(var(--mui-palette-error-mainChannel) / 0.06)"
                        : item.level === "warning"
                          ? "rgba(var(--mui-palette-warning-mainChannel) / 0.06)"
                          : rowIndex % 2 === 1
                            ? "action.hover"
                            : undefined,
                    // Left accent bar by level (RTL → border-inline-start).
                    borderInlineStart: "3px solid",
                    borderInlineStartColor:
                      item.level === "error"
                        ? "error.main"
                        : item.level === "warning"
                          ? "warning.main"
                          : "transparent",
                  }}
                >
                  <TableCell>
                    <Chip size="small" label={levelMeta[item.level].label} color={levelMeta[item.level].color} />
                  </TableCell>
                  <TableCell sx={{ maxWidth: 420 }}>
                    <Typography variant="body2" fontWeight={800} noWrap>
                      {item.message}
                    </Typography>
                    {item.route ? (
                      <Typography variant="caption" color="text.secondary" dir="ltr" display="block" noWrap>
                        {item.method ? `${item.method} ` : ""}
                        {item.route}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{item.source}</TableCell>
                  <TableCell>{categoryLabels[item.category]}</TableCell>
                  <TableCell>{formatDate(item.createdAt)}</TableCell>
                  <TableCell>
                    {item.resolvedAt ? <Chip size="small" label="حل‌شده" color="success" /> : <Chip size="small" label="باز" color="warning" />}
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" gap={0.75} justifyContent="flex-end">
                      <Button size="small" startIcon={<VisibilityRounded />} onClick={() => setSelected(item)}>
                        جزئیات
                      </Button>
                      <Button size="small" color={item.resolvedAt ? "warning" : "success"} onClick={() => void markResolved(item)}>
                        {item.resolvedAt ? "باز کردن" : "حل شد"}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && data?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Stack spacing={1} alignItems="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary" textAlign="center">
                        {data.stats.total === 0
                          ? "کالکشن لاگ خطا فعلاً خالی است و هنوز خطایی ثبت نشده."
                          : "لاگی برای فیلتر فعلی پیدا نشد."}
                      </Typography>
                      {data.stats.total > 0 && resolved === "false" ? (
                        <Button size="small" onClick={() => setResolved("")}>
                          نمایش همه وضعیت‌ها
                        </Button>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack direction="row" alignItems="center" justifyContent="center" gap={2} flexWrap="wrap">
          <Pagination
            page={page}
            count={data?.pagination.totalPages ?? 1}
            onChange={(_, nextPage) => setPage(nextPage)}
          />
          <PageJumper pages={data?.pagination.totalPages ?? 1} onJump={setPage} />
        </Stack>
      </Stack>

      <DetailDialog item={selected} onClose={() => setSelected(null)} />
    </Container>
  );
}
