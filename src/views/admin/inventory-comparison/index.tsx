"use client";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  FormControl,
  Grid,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  CheckCircleRounded,
  Inventory2Rounded,
  RefreshRounded,
  SearchRounded,
  SyncRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { PageJumper } from "@/components/search/pagination";
import useSWR from "swr";
import { toast } from "sonner";

type ServiceName = "digikala" | "snapp" | "basalaam";

type ServiceStock = {
  id: string;
  vendorId: string;
  quantity: number;
  displayName: string;
  updatedAt?: string;
};

type InventoryComparisonItem = {
  variantId: string;
  productId: string;
  title: string;
  slug: string;
  sku?: string;
  barcode?: string;
  imageId?: string;
  siteStock: number;
  hasMismatch: boolean;
  services: Record<ServiceName, ServiceStock[]>;
};

type InventoryComparisonResponse = {
  data: InventoryComparisonItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: {
    total: number;
    mismatch: number;
    linked: number;
    unlinked: number;
  };
};

const numberFormatter = new Intl.NumberFormat("fa-IR");

type PaletteColorKey = "primary" | "secondary" | "info" | "success" | "warning" | "error";
const colorVar = (key: PaletteColorKey) => `var(--mui-palette-${key}-main)`;
const colorAlpha = (key: PaletteColorKey, opacity: number) => `rgba(var(--mui-palette-${key}-mainChannel) / ${opacity})`;

const serviceLabels: Record<ServiceName, { label: string; colorKey: PaletteColorKey }> = {
  digikala: { label: "دیجی‌کالا", colorKey: "error" },
  snapp: { label: "اسنپ", colorKey: "success" },
  basalaam: { label: "باسلام", colorKey: "warning" },
};

async function fetcher(url: string): Promise<InventoryComparisonResponse> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "دریافت مقایسه موجودی ناموفق بود.");
  }
  return response.json() as Promise<InventoryComparisonResponse>;
}

function buildUrl(filters: { page: number; q: string; status: string }) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("limit", "25");
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.status) params.set("status", filters.status);
  return `/api/admin/inventory-comparison?${params.toString()}`;
}

function StatCard({ label, value, colorKey, icon }: { label: string; value: number; colorKey: PaletteColorKey; icon: ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid",
        borderColor: colorAlpha(colorKey, 0.24),
        bgcolor: colorAlpha(colorKey, 0.08),
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
            {label}
          </Typography>
          <Typography variant="h6" fontWeight={950}>
            {numberFormatter.format(value)}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function ServiceCell({ item, service }: { item: InventoryComparisonItem; service: ServiceName }) {
  const rows = item.services[service] ?? [];
  const meta = serviceLabels[service];

  if (!rows.length) {
    return (
      <Chip
        size="small"
        variant="outlined"
        label="وصل نیست"
        sx={{ color: "text.secondary", borderStyle: "dashed" }}
      />
    );
  }

  return (
    <Stack spacing={0.75}>
      {rows.map((row) => {
        const qty = Number(row.quantity ?? 0);
        const diff = qty - Number(item.siteStock ?? 0);
        const mismatch = diff !== 0;
        return (
          <Chip
            key={row.id}
            size="small"
            color={mismatch ? "warning" : "success"}
            variant={mismatch ? "filled" : "outlined"}
            label={`${row.vendorId}: ${numberFormatter.format(qty)}${mismatch ? `  (${diff > 0 ? "▲+" : "▼"}${numberFormatter.format(Math.abs(diff))})` : ""}`}
            sx={{
              justifyContent: "flex-start",
              maxWidth: 200,
              borderColor: colorAlpha(meta.colorKey, 0.32),
            }}
          />
        );
      })}
    </Stack>
  );
}

export default function InventoryComparisonView() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("mismatch");
  const [selected, setSelected] = useState<string[]>([]);
  const [syncingIds, setSyncingIds] = useState<string[]>([]);

  const url = useMemo(() => buildUrl({ page, q, status }), [page, q, status]);
  const { data, error, isLoading, isValidating, mutate } = useSWR(url, fetcher, {
    keepPreviousData: true,
    refreshInterval: 45_000,
  });

  const items = data?.data ?? [];
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visibleIds = items.map((item) => item.variantId);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const selectedVisibleIds = visibleIds.filter((id) => selectedSet.has(id));

  function toggleSelection(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleVisible() {
    setSelected((prev) => {
      const set = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => set.delete(id));
      } else {
        visibleIds.forEach((id) => set.add(id));
      }
      return Array.from(set);
    });
  }

  async function handleSync(variantIds: string[]) {
    if (!variantIds.length) return;
    setSyncingIds(variantIds);
    try {
      const response = await fetch("/api/admin/inventory-comparison", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantIds }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "همگام‌سازی موجودی ناموفق بود.");
      }
      const serviceFailed = Number(payload.serviceFailed ?? 0);
      const serviceSucceeded = Number(payload.serviceSucceeded ?? 0);
      if (serviceFailed > 0) {
        toast.warning(
          `${numberFormatter.format(serviceSucceeded)} درخواست سرویس انجام شد و ${numberFormatter.format(serviceFailed)} درخواست خطا داشت.`,
        );
      } else {
        toast.success(`${numberFormatter.format(Number(payload.synced ?? 0))} موجودی همگام شد.`);
      }
      if (serviceSucceeded > 0) {
        setSelected((prev) => prev.filter((id) => !variantIds.includes(id)));
      }
      const refreshed = await mutate();
      if (refreshed && page > refreshed.pagination.totalPages) {
        setPage(1);
      }
    } catch (syncError) {
      toast.error(syncError instanceof Error ? syncError.message : "همگام‌سازی موجودی ناموفق بود.");
    } finally {
      setSyncingIds([]);
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
              "radial-gradient(circle at 15% 20%, rgba(var(--mui-palette-info-mainChannel) / 0.42), transparent 31%), linear-gradient(135deg, var(--mui-palette-grey-900), var(--mui-palette-info-dark) 50%, var(--mui-palette-success-dark))",
          }}
        >
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
            <Box>
              <Typography variant="overline" sx={{ opacity: 0.78, letterSpacing: 1 }}>
                Unified Inventory
              </Typography>
              <Typography variant="h4" fontWeight={950} sx={{ mt: 0.5 }}>
                مقایسه موجودی سایت و مارکت‌پلیس‌ها
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, maxWidth: 760, opacity: 0.82, lineHeight: 1.9 }}>
                موجودی سایت، دیجی‌کالا، اسنپ و باسلام را کنار هم ببینید؛ اختلاف‌ها را جدا کنید و موجودی سایت را برای یک کالا یا چند کالا به سرویس‌ها sync کنید.
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="inherit"
              startIcon={isValidating ? <SyncRounded /> : <RefreshRounded />}
              onClick={() => void mutate()}
              sx={{ alignSelf: { xs: "stretch", md: "center" }, color: "var(--mui-palette-grey-900)", borderRadius: 2, fontWeight: 900 }}
            >
              بروزرسانی
            </Button>
          </Stack>
        </Paper>

        {error ? (
          <Alert severity="error" action={<Button onClick={() => void mutate()}>تلاش دوباره</Button>}>
            {error instanceof Error ? error.message : "دریافت مقایسه موجودی ناموفق بود."}
          </Alert>
        ) : null}

        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard label="کل نتیجه" value={data?.stats.total ?? 0} colorKey="info" icon={<Inventory2Rounded />} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard label="دارای اختلاف" value={data?.stats.mismatch ?? 0} colorKey="error" icon={<WarningAmberRounded />} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard label="متصل به سرویس" value={data?.stats.linked ?? 0} colorKey="success" icon={<CheckCircleRounded />} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
            <StatCard label="بدون اتصال" value={data?.stats.unlinked ?? 0} colorKey="warning" icon={<WarningAmberRounded />} />
          </Grid>
        </Grid>

        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: 1, borderColor: "divider" }}>
          <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "stretch", md: "center" }} gap={1.5}>
            <TextField
              size="small"
              value={q}
              onChange={(event) => {
                setPage(1);
                setQ(event.target.value);
              }}
              placeholder="جستجو: عنوان، slug، SKU، بارکد..."
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: { xs: "100%", md: 190 } }}>
              <InputLabel>وضعیت</InputLabel>
              <Select
                value={status}
                label="وضعیت"
                onChange={(event) => {
                  setPage(1);
                  setSelected([]);
                  setStatus(event.target.value);
                }}
              >
                <MenuItem value="mismatch">فقط اختلاف‌ها</MenuItem>
                <MenuItem value="synced">هماهنگ‌ها</MenuItem>
                <MenuItem value="unlinked">بدون اتصال</MenuItem>
                <MenuItem value="all">همه</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="contained"
              startIcon={<SyncRounded />}
              disabled={!selected.length || syncingIds.length > 0}
              onClick={() => void handleSync(selected)}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              sync گروهی ({numberFormatter.format(selected.length)})
            </Button>
          </Stack>
        </Paper>

        {(isLoading || isValidating) && <LinearProgress />}

        {isLoading ? (
          <Stack spacing={1}>
            {Array.from({ length: 8 }).map((_, index) => (
              <Paper key={index} elevation={0} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
                <Stack direction="row" gap={1.5} alignItems="center">
                  <Skeleton variant="rounded" width={48} height={48} />
                  <Stack flex={1} spacing={0.8}>
                    <Skeleton variant="text" width="48%" />
                    <Skeleton variant="text" width="28%" />
                  </Stack>
                  <Skeleton variant="rounded" width={260} height={36} />
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 3, overflowX: "auto" }}>
            <Table sx={{ minWidth: 1180 }}>
              <TableHead>
                <TableRow>
                  <TableCell width={56}>
                    <Checkbox checked={allVisibleSelected} indeterminate={selectedVisibleIds.length > 0 && !allVisibleSelected} onChange={toggleVisible} />
                  </TableCell>
                  <TableCell>کالا</TableCell>
                  <TableCell>سایت</TableCell>
                  <TableCell>دیجی‌کالا</TableCell>
                  <TableCell>اسنپ</TableCell>
                  <TableCell>باسلام</TableCell>
                  <TableCell>وضعیت</TableCell>
                  <TableCell align="right">عملیات</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => {
                  const syncing = syncingIds.includes(item.variantId);
                  const hasServices =
                    (item.services.digikala?.length ?? 0) +
                      (item.services.snapp?.length ?? 0) +
                      (item.services.basalaam?.length ?? 0) >
                    0;
                  return (
                    <TableRow key={item.variantId} selected={selectedSet.has(item.variantId)}>
                      <TableCell>
                        <Checkbox checked={selectedSet.has(item.variantId)} onChange={() => toggleSelection(item.variantId)} />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1.25} alignItems="center">
                          <Box
                            component="img"
                            src={item.imageId && item.imageId !== "null" ? `/api/media/${item.imageId}` : "/product-placeholder.svg"}
                            width={48}
                            height={48}
                            alt={item.title}
                            sx={{ borderRadius: 1, objectFit: "cover", bgcolor: "background.default" }}
                          />
                          <Stack spacing={0.25}>
                            <Typography component={Link} href={`/product/${item.slug}`} target="_blank" variant="body2" color="text.primary" fontWeight={800}>
                              {item.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              بارکد: {item.barcode || "N/A"} | SKU: {item.sku || "N/A"}
                            </Typography>
                          </Stack>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip color="primary" variant="outlined" label={numberFormatter.format(Number(item.siteStock ?? 0))} />
                      </TableCell>
                      <TableCell>
                        <ServiceCell item={item} service="digikala" />
                      </TableCell>
                      <TableCell>
                        <ServiceCell item={item} service="snapp" />
                      </TableCell>
                      <TableCell>
                        <ServiceCell item={item} service="basalaam" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          color={item.hasMismatch ? "warning" : "success"}
                          icon={item.hasMismatch ? <WarningAmberRounded /> : <CheckCircleRounded />}
                          label={item.hasMismatch ? "اختلاف دارد" : "هماهنگ"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant={item.hasMismatch ? "contained" : "outlined"}
                          disabled={syncing || !hasServices}
                          onClick={() => void handleSync([item.variantId])}
                        >
                          {syncing ? "در حال sync..." : "sync"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!items.length ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Stack alignItems="center" spacing={1} sx={{ py: 5 }}>
                        <Typography variant="subtitle2" fontWeight={900}>
                          نتیجه‌ای برای نمایش وجود ندارد.
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          فیلترها را تغییر دهید یا بعد از sync مارکت‌پلیس‌ها دوباره بروزرسانی کنید.
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1.5}>
          <Typography variant="caption" color="text.secondary">
              sync، موجودی سایت را مبنا قرار می‌دهد و آن را به سرویس‌های متصل ارسال می‌کند.
              اگر یک سرویس موقتاً در دسترس نباشد، سینک سرویس‌های دیگر متوقف نمی‌شود.
          </Typography>
          <Pagination
            page={page}
            count={data?.pagination.totalPages ?? 1}
            siblingCount={1}
            boundaryCount={1}
            onChange={(_, nextPage) => {
              setPage(nextPage);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
          <PageJumper pages={data?.pagination.totalPages ?? 1} onJump={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </Stack>
      </Stack>
    </Container>
  );
}
