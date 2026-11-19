"use client";

import { RefreshButton } from "@/components/refresh";
import {
    Box, Button, Card, CardContent, Chip, Container,
    Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, IconButton, LinearProgress, Skeleton, Stack, Tab, Tabs,
    Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography,
} from "@mui/material";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import TrendingDownRoundedIcon from "@mui/icons-material/TrendingDownRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import MonetizationOnRoundedIcon from "@mui/icons-material/MonetizationOnRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import ShoppingBagRoundedIcon from "@mui/icons-material/ShoppingBagRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";

// ─── CSV export helper ─────────────────────────────────────────────────────────

function exportCsv(filename: string, rows: Record<string, unknown>[], columns: { key: string; label: string }[]) {
    if (!rows.length) { toast.error("داده‌ای برای خروجی وجود ندارد"); return; }
    const esc = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.map((c) => esc(c.label)).join(",");
    const body = rows.map((row) => columns.map((c) => esc(row[c.key])).join(",")).join("\n");
    const csv = "﻿" + header + "\n" + body; // BOM for Excel UTF-8
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("خروجی CSV دانلود شد");
}

function toman(rial: number) {
    if (!rial) return "۰";
    const t = Math.round(rial / 10);
    if (t >= 1_000_000_000) return `${(t / 1_000_000_000).toFixed(1)} میلیارد`;
    if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(1)} میلیون`;
    return t.toLocaleString("fa-IR");
}

function n(v: number) { return v.toLocaleString("fa-IR"); }

function callProxy(vendorId: string, path: string, signal?: AbortSignal) {
    const sep = path.includes("?") ? "&" : "?";
    return fetch(`/api/digikala/open-api/${path}${sep}vendorId=${encodeURIComponent(vendorId)}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal,
    }).then(async (r) => {
        const json = await r.json().catch(() => null);
        if (!r.ok) throw new Error(json?.error || json?.data?.message || `خطای ${r.status}`);
        return json;
    });
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
    title,
    value,
    sub,
    pct,
    icon,
    color,
    loading,
}: {
    title: string;
    value: string;
    sub?: string;
    pct?: number;
    icon: React.ReactNode;
    color: string;
    loading?: boolean;
}) {
    const pctColor = pct == null ? undefined : pct >= 0 ? "success.main" : "error.main";
    return (
        <Card variant="outlined" sx={{ flex: 1, minWidth: 160 }}>
            <CardContent sx={{ p: "12px !important" }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
                    <Stack spacing={0.5} flex={1}>
                        <Typography variant="caption" color="text.secondary">{title}</Typography>
                        {loading
                            ? <Skeleton width="70%" height={32} />
                            : <Typography variant="h5" fontWeight={800} color={color}>{value}</Typography>
                        }
                        {!loading && (sub || pct != null) && (
                            <Stack direction="row" gap={0.5} alignItems="center">
                                {pct != null && (
                                    <>
                                        {pct >= 0
                                            ? <TrendingUpRoundedIcon sx={{ fontSize: 14, color: "success.main" }} />
                                            : <TrendingDownRoundedIcon sx={{ fontSize: 14, color: "error.main" }} />
                                        }
                                        <Typography variant="caption" color={pctColor}>{Math.abs(pct)}%</Typography>
                                    </>
                                )}
                                {sub && <Typography variant="caption" color="text.disabled">{sub}</Typography>}
                            </Stack>
                        )}
                    </Stack>
                    <Box sx={{ color, opacity: 0.7, mt: 0.25 }}>{icon}</Box>
                </Stack>
            </CardContent>
        </Card>
    );
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

interface ChartItem {
    label: string;
    revenue: number;
    orders: number;
    date?: string;
}

function MiniBarChart({ items, valueKey, color }: { items: ChartItem[]; valueKey: "revenue" | "orders"; color: string }) {
    if (!items.length) return null;
    const values = items.map((it) => it[valueKey]);
    const max = Math.max(...values, 1);

    return (
        <Stack direction="row" alignItems="flex-end" gap="3px" sx={{ height: 80, px: 0.5 }}>
            {items.map((it, i) => {
                const val = values[i];
                const pct = (val / max) * 100;
                return (
                    <Tooltip
                        key={i}
                        title={
                            <Stack>
                                <Typography variant="caption">{it.label}</Typography>
                                <Typography variant="caption" fontWeight={700}>
                                    {valueKey === "revenue" ? `${toman(val)} تومان` : n(val)}
                                </Typography>
                            </Stack>
                        }
                        arrow
                    >
                        <Box
                            sx={{
                                flex: 1,
                                bgcolor: color,
                                borderRadius: "3px 3px 0 0",
                                height: `${Math.max(pct, 3)}%`,
                                opacity: 0.7 + (i / items.length) * 0.3,
                                transition: "height .3s",
                                cursor: "default",
                                "&:hover": { opacity: 1 },
                            }}
                        />
                    </Tooltip>
                );
            })}
        </Stack>
    );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
    { value: "last_7_days", label: "۷ روز" },
    { value: "last_30_days", label: "۳۰ روز" },
];

interface TrendKpi {
    netSales: number;
    netSalesPct: number;
    orderCount: number;
    orderCountPct: number;
    itemsSold: number;
    itemsSoldPct: number;
    visitCount: number;
    visitCountPct: number;
}

function OverviewTab({ vendorId }: { vendorId: string }) {
    const [kpi, setKpi] = useState<TrendKpi | null>(null);
    const [chart, setChart] = useState<ChartItem[]>([]);
    const [deactivated, setDeactivated] = useState<Record<string, unknown>[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState("last_30_days");
    const abortRef = useRef<AbortController | null>(null);

    function load() {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        setError(null);

        Promise.allSettled([
            callProxy(vendorId, `insight/trend-sales-reports?range=${range}`, ctrl.signal),
            callProxy(vendorId, "insight/top-deactivated", ctrl.signal),
        ]).then(([tr, dea]) => {
            if (tr.status === "fulfilled") {
                // items is a DICT (not array): { net_sales, order_count, ..., chart: [...] }
                const d = tr.value?.data?.data ?? tr.value?.data ?? {};
                const items = d?.items ?? {};

                const safeNum = (obj: unknown, key: string) => {
                    if (typeof obj !== "object" || obj === null) return 0;
                    const val = (obj as Record<string, unknown>)[key];
                    return typeof val === "number" ? val : 0;
                };
                const safePct = (obj: unknown, key: string) => {
                    if (typeof obj !== "object" || obj === null) return 0;
                    const val = (obj as Record<string, unknown>)[key];
                    return typeof val === "number" && isFinite(val) ? val : 0;
                };

                setKpi({
                    netSales: safeNum(items.net_sales, "amount"),
                    netSalesPct: safePct(items.net_sales, "percentage"),
                    orderCount: safeNum(items.order_count, "count"),
                    orderCountPct: safePct(items.order_count, "percentage"),
                    itemsSold: safeNum(items.net_item_sold, "count"),
                    itemsSoldPct: safePct(items.net_item_sold, "percentage"),
                    visitCount: safeNum(items.visit_count, "count"),
                    visitCountPct: safePct(items.visit_count, "percentage"),
                });

                const chartArr = Array.isArray(items.chart) ? items.chart : [];
                setChart(chartArr.map((it: Record<string, unknown>) => ({
                    label: String(it.date ?? "").slice(0, 10),
                    revenue: Number(it.net_sales_amount ?? 0),
                    orders: Number(it.order_count ?? 0),
                })));
            }
            if (dea.status === "fulfilled") {
                const d = dea.value?.data?.data ?? dea.value?.data ?? {};
                setDeactivated((d?.items ?? (Array.isArray(d) ? d : [])) as Record<string, unknown>[]);
            }
            const allFailed = [tr, dea].every((r) => r.status === "rejected");
            if (allFailed) {
                const err = (tr as PromiseRejectedResult).reason as Error;
                if (err.name !== "AbortError") setError(err.message);
            }
        }).finally(() => setLoading(false));
    }

    useEffect(() => { load(); return () => abortRef.current?.abort(); }, [vendorId, range]);

    const str = (v: unknown) => (v != null ? String(v) : null);
    const num = (v: unknown) => (v != null && isFinite(Number(v)) ? Number(v) : 0);

    return (
        <Box>
            {loading && !kpi && <LinearProgress sx={{ mb: 2 }} />}

            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1} sx={{ mb: 2 }}>
                <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle2" color="text.secondary" sx={{ ml: 0.5 }}>بازه زمانی:</Typography>
                    {RANGE_OPTIONS.map((opt) => (
                        <Chip
                            key={opt.value}
                            label={opt.label}
                            size="small"
                            color={range === opt.value ? "primary" : "default"}
                            variant={range === opt.value ? "filled" : "outlined"}
                            onClick={() => setRange(opt.value)}
                            clickable
                        />
                    ))}
                </Stack>
                <RefreshButton disabled={loading} onClick={load} />
            </Stack>

            {error && (
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                    <Button variant="outlined" color="error" size="small" onClick={load}>تلاش دوباره</Button>
                </Stack>
            )}

            {/* KPI Cards */}
            <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ mb: 3 }}>
                <KpiCard
                    title="فروش خالص"
                    value={`${toman(kpi?.netSales ?? 0)} تومان`}
                    pct={kpi?.netSalesPct}
                    icon={<MonetizationOnRoundedIcon />}
                    color="success.main"
                    loading={loading && !kpi}
                />
                <KpiCard
                    title="تعداد سفارشات"
                    value={n(kpi?.orderCount ?? 0)}
                    pct={kpi?.orderCountPct}
                    icon={<ShoppingCartRoundedIcon />}
                    color="primary.main"
                    loading={loading && !kpi}
                />
                <KpiCard
                    title="آیتم فروخته‌شده"
                    value={n(kpi?.itemsSold ?? 0)}
                    pct={kpi?.itemsSoldPct}
                    icon={<ShoppingBagRoundedIcon />}
                    color="secondary.main"
                    loading={loading && !kpi}
                />
                <KpiCard
                    title="بازدید"
                    value={n(kpi?.visitCount ?? 0)}
                    pct={kpi?.visitCountPct}
                    icon={<VisibilityRoundedIcon />}
                    color="info.main"
                    loading={loading && !kpi}
                />
            </Stack>

            {/* Trend Chart */}
            {(chart.length > 0 || (loading && chart.length === 0)) && (
                <Card variant="outlined" sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>روند روزانه فروش</Typography>
                        {loading && chart.length === 0
                            ? <Skeleton height={80} sx={{ borderRadius: 1 }} />
                            : (
                                <>
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>فروش خالص (ریال)</Typography>
                                    <MiniBarChart items={chart} valueKey="revenue" color="var(--mui-palette-success-main, #2e7d32)" />
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, mb: 0.5, display: "block" }}>تعداد سفارشات</Typography>
                                    <MiniBarChart items={chart} valueKey="orders" color="var(--mui-palette-primary-main, #1976d2)" />
                                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                                        <Typography variant="caption" color="text.disabled">{chart[0]?.label}</Typography>
                                        <Typography variant="caption" color="text.disabled">{chart[chart.length - 1]?.label}</Typography>
                                    </Stack>
                                </>
                            )
                        }
                    </CardContent>
                </Card>
            )}

            {/* Top Deactivated */}
            {deactivated.length > 0 && (
                <Card variant="outlined">
                    <CardContent>
                        <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1.5 }}>
                            <WarningAmberRoundedIcon color="warning" fontSize="small" />
                            <Typography variant="subtitle2" fontWeight={700}>محصولات غیرفعال پرفروش</Typography>
                        </Stack>
                        <Stack spacing={1}>
                            {deactivated.slice(0, 10).map((item, i) => (
                                <Stack key={i} direction="row" alignItems="center" gap={1.5} sx={{ py: 0.5 }}>
                                    {!!item.product_image && (
                                        <Box component="img" src={str(item.product_image) ?? ""} width={36} height={36}
                                            sx={{ borderRadius: 0.5, flexShrink: 0 }} />
                                    )}
                                    <Stack flex={1} spacing={0.2}>
                                        <Typography variant="body2" fontWeight={500}>
                                            {str(item.product_title) ?? `#${i + 1}`}
                                        </Typography>
                                        <Stack direction="row" gap={1} flexWrap="wrap">
                                            {str(item.category_title) && (
                                                <Chip size="small" label={str(item.category_title) ?? ""} variant="outlined" />
                                            )}
                                            {!!item.gross_amount && (
                                                <Typography variant="caption" color="error.main">
                                                    فروش قبلی: {toman(num(item.gross_amount))} تومان
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Stack>
                                </Stack>
                            ))}
                        </Stack>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}

// ─── Sales Reports Tab ────────────────────────────────────────────────────────

interface SalesReportItem {
    product_id?: number;
    title?: string;
    category_title?: string;
    image?: string;
    net_sales_amount?: number;
    gross_sales_amount?: number;
    net_item_sold?: number;
    gross_item_sold?: number;
    order_count?: number;
    visit_count?: number;
    conversion_rate?: number;
    [key: string]: unknown;
}

function SalesReportsTab({ vendorId }: { vendorId: string }) {
    const [items, setItems] = useState<SalesReportItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [range, setRange] = useState("last_30_days");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const abortRef = useRef<AbortController | null>(null);

    function load() {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        setError(null);
        callProxy(vendorId, `insight/sales-reports?range=${range}&page=${page}&size=50`, ctrl.signal)
            .then((json) => {
                const d = json?.data?.data ?? json?.data ?? {};
                setItems(d?.items ?? (Array.isArray(d) ? d : []));
                setTotalPages(Math.max(1, d?.pager?.total_pages ?? 1));
            })
            .catch((err) => { if (err.name !== "AbortError") { setError(err.message); toast.error(`خطا: ${err.message}`); } })
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); return () => abortRef.current?.abort(); }, [vendorId, range, page]);

    const tomanFn = (v: number) => Math.round(v / 10).toLocaleString("fa-IR");

    if (loading && items.length === 0) {
        return <Stack spacing={1}>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} height={60} sx={{ borderRadius: 1 }} />)}</Stack>;
    }

    if (error) {
        return (
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
                sx={{ p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                <Typography variant="body2" color="error.main">{error}</Typography>
                <Button variant="outlined" color="error" size="small" onClick={load}>تلاش دوباره</Button>
            </Stack>
        );
    }

    return (
        <Box>
            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1} sx={{ mb: 1.5 }}>
                <Stack direction="row" gap={0.75} alignItems="center">
                    <Typography variant="caption" color="text.secondary">بازه:</Typography>
                    {RANGE_OPTIONS.map((opt) => (
                        <Chip key={opt.value} label={opt.label} size="small"
                            color={range === opt.value ? "primary" : "default"}
                            variant={range === opt.value ? "filled" : "outlined"}
                            onClick={() => { setRange(opt.value); setPage(1); }} clickable />
                    ))}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>{items.length} محصول</Typography>
                </Stack>
                <Stack direction="row" gap={1} alignItems="center">
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DownloadRoundedIcon fontSize="small" />}
                        disabled={!items.length}
                        onClick={() => exportCsv("gozaresh-foroosh", items as Record<string, unknown>[], [
                            { key: "title", label: "عنوان" },
                            { key: "category_title", label: "دسته" },
                            { key: "net_sales_amount", label: "فروش خالص (ریال)" },
                            { key: "gross_sales_amount", label: "فروش ناخالص (ریال)" },
                            { key: "net_item_sold", label: "تعداد فروش" },
                            { key: "order_count", label: "سفارشات" },
                            { key: "visit_count", label: "بازدید" },
                            { key: "conversion_rate", label: "نرخ تبدیل" },
                        ])}
                    >
                        خروجی CSV
                    </Button>
                    <RefreshButton disabled={loading} onClick={load} />
                </Stack>
            </Stack>

            {items.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>داده‌ای یافت نشد</Typography>
            ) : (
                <Stack spacing={0} divider={<Divider />} sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
                    {items.map((it, i) => (
                        <Stack key={it.product_id ?? i} direction="row" gap={1.5} alignItems="center"
                            sx={{ px: 2, py: 1.25, "&:hover": { bgcolor: "action.hover" } }}>
                            {!!it.image && (
                                <Box component="img" src={String(it.image)} width={40} height={40}
                                    sx={{ borderRadius: 0.5, flexShrink: 0 }} />
                            )}
                            <Stack flex={1} spacing={0.2} minWidth={0}>
                                <Typography variant="body2" fontWeight={600} noWrap>{it.title ?? `محصول ${i + 1}`}</Typography>
                                {it.category_title && (
                                    <Typography variant="caption" color="text.secondary">{it.category_title}</Typography>
                                )}
                            </Stack>
                            <Stack direction="row" gap={2} alignItems="center" flexShrink={0} flexWrap="wrap" justifyContent="flex-end">
                                <Stack alignItems="flex-end">
                                    <Typography variant="caption" color="text.secondary">فروش خالص</Typography>
                                    <Typography variant="body2" fontWeight={700} color="success.main">
                                        {it.net_sales_amount != null ? `${tomanFn(Number(it.net_sales_amount))} ت` : "—"}
                                    </Typography>
                                </Stack>
                                <Stack alignItems="flex-end">
                                    <Typography variant="caption" color="text.secondary">فروخته شده</Typography>
                                    <Typography variant="body2">{it.net_item_sold ?? "—"}</Typography>
                                </Stack>
                                <Stack alignItems="flex-end">
                                    <Typography variant="caption" color="text.secondary">سفارشات</Typography>
                                    <Typography variant="body2">{it.order_count ?? "—"}</Typography>
                                </Stack>
                                {it.conversion_rate != null && (
                                    <Stack alignItems="flex-end">
                                        <Typography variant="caption" color="text.secondary">نرخ تبدیل</Typography>
                                        <Typography variant="body2">{Number(it.conversion_rate).toFixed(2)}%</Typography>
                                    </Stack>
                                )}
                            </Stack>
                        </Stack>
                    ))}
                </Stack>
            )}

            {totalPages > 1 && (
                <Stack alignItems="center" sx={{ mt: 2 }}>
                    <Chip
                        label={`صفحه ${page} از ${totalPages}`}
                        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                        clickable
                        color="primary"
                        variant="outlined"
                        size="small"
                    />
                </Stack>
            )}
        </Box>
    );
}

// ─── Accounting Tab ───────────────────────────────────────────────────────────

// The Digikala invoice/wallet payloads use varying amount field names, so pick
// the most relevant numeric field instead of guessing a single key (which left
// every invoice showing ۰ ت). Tax/discount/commission/fee keys are excluded so
// we don't pick a sub-amount.
function pickFinancialAmount(obj: unknown): number {
    if (!obj || typeof obj !== "object") return 0;
    const record = obj as Record<string, unknown>;
    const blocked = /tax|discount|commission|vat|fee|count|id$|page/i;
    const priority = [/settle/i, /payable/i, /payment/i, /final/i, /total/i, /amount/i, /price/i, /balance|credit|value/i];
    const numericKeys = Object.keys(record).filter(
        (k) => typeof record[k] === "number" && Number.isFinite(record[k] as number) && !blocked.test(k),
    );
    for (const re of priority) {
        const key = numericKeys.find((k) => re.test(k));
        if (key) return Number(record[key]);
    }
    // Nested { amount } / { value } objects.
    for (const k of Object.keys(record)) {
        const v = record[k];
        if (v && typeof v === "object") {
            const inner = v as Record<string, unknown>;
            const candidate = inner.amount ?? inner.value;
            if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
        }
    }
    return 0;
}

interface InvoiceRow {
    id?: number;
    invoice_id?: number;
    title?: string;
    status?: string;
    status_title?: string;
    amount?: number;
    payable_amount?: number;
    settlement_amount?: number;
    date?: string;
    created_at?: string;
    [key: string]: unknown;
}

interface InvoiceNotation {
    id?: number;
    title?: string;
    item_count?: number | string;
    total_amount?: number | string;
    calculation_model_type?: string;
}
interface InvoiceDetails {
    start_date?: string;
    end_date?: string;
    vat_amount?: number;
    total_income?: number;
    total_paid_amount?: number | null;
    cash?: { maturity_date?: string; total_amount?: number; status?: { title?: string } };
    credit?: { maturity_date?: string; total_amount?: number; status?: { title?: string } };
    payout_order_status?: { title?: string };
    sales?: { notations?: InvoiceNotation[]; total_amount?: number | string };
    sales_return?: { notations?: InvoiceNotation[]; total_amount?: number | string };
    others?: { notations?: InvoiceNotation[]; total_amount?: number | string };
    [key: string]: unknown;
}

function InvoiceDetailsDialog({ vendorId, invoice, onClose }: {
    vendorId: string; invoice: InvoiceRow | null; onClose: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [details, setDetails] = useState<InvoiceDetails | null>(null);
    const invId = invoice ? (invoice.id ?? invoice.invoice_id) : null;

    useEffect(() => {
        if (invId == null) return;
        const ctrl = new AbortController();
        setLoading(true);
        setError(null);
        setDetails(null);
        callProxy(vendorId, `invoices/${invId}/details`, ctrl.signal)
            .then((json) => setDetails((json?.data?.data ?? json?.data ?? {}) as InvoiceDetails))
            .catch((e) => { if (e?.name !== "AbortError") setError(e?.message ?? "خطا در بارگیری جزئیات صورتحساب"); })
            .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
        return () => ctrl.abort();
    }, [vendorId, invId]);

    const notationRows: InvoiceNotation[] = details
        ? [...(details.sales?.notations ?? []), ...(details.sales_return?.notations ?? []), ...(details.others?.notations ?? [])]
        : [];

    return (
        <Dialog open={Boolean(invoice)} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ position: "relative", pr: 6 }}>
                <Stack direction="row" alignItems="center" gap={1}>
                    <ReceiptLongRoundedIcon fontSize="small" color="primary" />
                    <span>جزئیات صورتحساب {invId != null ? n(Number(invId)) : ""}</span>
                </Stack>
                <DialogCloseButton onClose={onClose} />
            </DialogTitle>
            <Divider />
            <DialogContent>
                {loading && <LinearProgress sx={{ mb: 2 }} />}
                {error && <Typography variant="body2" color="error.main" sx={{ py: 2 }}>{error}</Typography>}
                {!loading && !error && details && (
                    <Stack spacing={2}>
                        <Typography variant="caption" color="text.secondary">
                            دوره: {String(details.start_date ?? "").slice(0, 10)} تا {String(details.end_date ?? "").slice(0, 10)}
                            {details.payout_order_status?.title ? ` — ${details.payout_order_status.title}` : ""}
                        </Typography>

                        <Stack direction="row" gap={1.5} flexWrap="wrap">
                            <KpiCard title="کل درآمد" value={`${toman(Number(details.total_income ?? 0))} ت`} icon={<MonetizationOnRoundedIcon />} color="success.main" />
                            <KpiCard title="مالیات بر ارزش افزوده" value={`${toman(Number(details.vat_amount ?? 0))} ت`} icon={<ReceiptLongRoundedIcon />} color="warning.main" />
                            {details.cash && (
                                <KpiCard title={`نقدی${details.cash.status?.title ? ` — ${details.cash.status.title}` : ""}`}
                                    value={`${toman(Number(details.cash.total_amount ?? 0))} ت`} icon={<AccountBalanceWalletRoundedIcon />} color="primary.main" />
                            )}
                            {details.credit && (
                                <KpiCard title={`اعتباری${details.credit.status?.title ? ` — ${details.credit.status.title}` : ""}`}
                                    value={`${toman(Number(details.credit.total_amount ?? 0))} ت`} icon={<AccountBalanceWalletRoundedIcon />} color="info.main" />
                            )}
                        </Stack>

                        {notationRows.length > 0 && (
                            <Box sx={{ overflowX: "auto" }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>شرح</TableCell>
                                            <TableCell align="center">تعداد</TableCell>
                                            <TableCell align="left">مبلغ (تومان)</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {notationRows.map((row, i) => {
                                            const amount = Number(row.total_amount ?? 0);
                                            return (
                                                <TableRow key={`${row.id}-${i}`}>
                                                    <TableCell>{row.title ?? "—"}</TableCell>
                                                    <TableCell align="center">{row.item_count != null ? n(Number(row.item_count)) : "—"}</TableCell>
                                                    <TableCell align="left">
                                                        <Typography variant="body2" fontWeight={600} color={amount < 0 ? "error.main" : "success.main"}>
                                                            {toman(amount)}
                                                        </Typography>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </Box>
                        )}
                    </Stack>
                )}
                {!loading && !error && details && notationRows.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                        جزئیات بیشتری برای این صورتحساب موجود نیست
                    </Typography>
                )}
            </DialogContent>
            <Divider />
            <DialogActions>
                <Button onClick={onClose}>بستن</Button>
            </DialogActions>
        </Dialog>
    );
}

function AccountingTab({ vendorId }: { vendorId: string }) {
    const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    function load() {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        setError(null);

        // Only the invoices and wallet-balance endpoints are queried here. The
        // commissions and wallet/transactions endpoints returned 404/400 for this
        // seller, so they're omitted to avoid spamming the error log.
        Promise.allSettled([
            callProxy(vendorId, "invoices?page=1&size=50", ctrl.signal),
            callProxy(vendorId, "shipping-services/wallet/balance", ctrl.signal),
        ]).then(([inv, bal]) => {
            const pick = (v: any) => v?.data?.data ?? v?.data ?? {};
            if (inv.status === "fulfilled") {
                const d = pick(inv.value);
                setInvoices((d?.items ?? (Array.isArray(d) ? d : [])) as InvoiceRow[]);
            }
            if (bal.status === "fulfilled") {
                const d = pick(bal.value);
                const direct = d?.balance ?? d?.amount ?? d?.wallet_balance ?? d?.credit;
                const b = typeof direct === "number" ? direct : pickFinancialAmount(d);
                setWalletBalance(b ? b : null);
            }
            if (inv.status === "rejected" && bal.status === "rejected") {
                const err = (inv as PromiseRejectedResult).reason as Error;
                if (err?.name !== "AbortError") setError(err?.message ?? "خطا در بارگیری اطلاعات مالی");
            }
        }).finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    }

    useEffect(() => { load(); return () => abortRef.current?.abort(); }, [vendorId]);

    const totalInvoices = invoices.reduce((s, it) => s + pickFinancialAmount(it), 0);

    if (loading && !invoices.length) {
        return <Stack spacing={1}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={64} sx={{ borderRadius: 1 }} />)}</Stack>;
    }

    return (
        <Box>
            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">گزارش مالی، صورتحساب‌ها و کیف پول</Typography>
                <RefreshButton disabled={loading} onClick={load} />
            </Stack>

            {error && (
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                    <Button variant="outlined" color="error" size="small" onClick={load}>تلاش دوباره</Button>
                </Stack>
            )}

            {/* Financial KPIs */}
            <Stack direction="row" gap={1.5} flexWrap="wrap" sx={{ mb: 3 }}>
                <KpiCard title="مجموع قابل تسویه" value={`${toman(totalInvoices)} ت`} icon={<MonetizationOnRoundedIcon />} color="success.main" />
                <KpiCard title="موجودی کیف پول" value={walletBalance != null ? `${toman(walletBalance)} ت` : "—"} icon={<AccountBalanceWalletRoundedIcon />} color="primary.main" />
                <KpiCard title="تعداد صورتحساب" value={n(invoices.length)} icon={<ReceiptLongRoundedIcon />} color="info.main" />
            </Stack>

            {/* Invoices */}
            <Card variant="outlined" sx={{ mb: 3 }}>
                <CardContent>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                        <Stack direction="row" gap={1} alignItems="center">
                            <ReceiptLongRoundedIcon color="primary" fontSize="small" />
                            <Typography variant="subtitle2" fontWeight={700}>صورتحساب‌های فروشنده</Typography>
                        </Stack>
                        <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon fontSize="small" />}
                            disabled={!invoices.length}
                            onClick={() => exportCsv("sourat-hesab", invoices.map((it) => ({
                                id: it.id ?? it.invoice_id,
                                start_date: String(it.start_date ?? "").slice(0, 10),
                                end_date: String(it.end_date ?? "").slice(0, 10),
                                amount: pickFinancialAmount(it),
                                status: ((it.settlement_status ?? it.payout_order_status) as { title?: string } | undefined)?.title ?? "",
                            })) as Record<string, unknown>[], [
                                { key: "id", label: "شناسه" },
                                { key: "start_date", label: "از تاریخ" },
                                { key: "end_date", label: "تا تاریخ" },
                                { key: "amount", label: "مبلغ کل (ریال)" },
                                { key: "status", label: "وضعیت" },
                            ])}
                        >خروجی CSV</Button>
                    </Stack>
                    {invoices.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>صورتحسابی یافت نشد</Typography>
                    ) : (
                        <Stack spacing={0} divider={<Divider />}>
                            {invoices.slice(0, 30).map((it, i) => {
                                // Digikala invoice fields: id, start_date/end_date,
                                // invoice_total_amount, payout_order_status/settlement_status {key,title}.
                                const invId = it.id ?? it.invoice_id ?? i + 1;
                                const dateRange = [it.start_date, it.end_date]
                                    .filter(Boolean)
                                    .map((d) => String(d).slice(0, 10))
                                    .join(" تا ");
                                const statusObj = (it.settlement_status ?? it.payout_order_status) as { title?: string } | undefined;
                                const statusLabel = statusObj?.title ?? (typeof it.status === "string" ? it.status : undefined);
                                return (
                                    <Stack key={String(invId)} direction="row" gap={1.5} alignItems="center"
                                        onClick={() => setSelectedInvoice(it)}
                                        sx={{ py: 1, cursor: "pointer", borderRadius: 1, px: 1, mx: -1, "&:hover": { bgcolor: "action.hover" } }}>
                                        <Stack flex={1} minWidth={0} spacing={0.2}>
                                            <Typography variant="body2" fontWeight={600} noWrap>
                                                {`صورتحساب ${invId}`}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {dateRange || String(it.created_at ?? it.date ?? "").slice(0, 10)}
                                            </Typography>
                                        </Stack>
                                        {statusLabel && (
                                            <Chip size="small" variant="outlined" label={statusLabel} />
                                        )}
                                        <Typography variant="body2" fontWeight={700} color="success.main">
                                            {toman(pickFinancialAmount(it))} ت
                                        </Typography>
                                        <Tooltip title="مشاهده جزئیات صورتحساب">
                                            <IconButton size="small" color="primary"><VisibilityRoundedIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                    </Stack>
                                );
                            })}
                        </Stack>
                    )}
                </CardContent>
            </Card>

            <InvoiceDetailsDialog vendorId={vendorId} invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
        </Box>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function InsightDashboard({ vendorId }: { vendorId: string }) {
    const [tab, setTab] = useState<"overview" | "reports" | "accounting">("overview");

    return (
        <Container maxWidth={false} sx={{ my: 4, px: { xs: 1, md: 3 } }}>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
                <TrendingUpRoundedIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>آمار و گزارش‌گیری</Typography>
            </Stack>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
                <Tab value="overview" label="خلاصه و روند" />
                <Tab value="reports" label="گزارش فروش محصولات" />
                <Tab value="accounting" label="حسابداری و مالی" />
            </Tabs>

            {tab === "overview" && <OverviewTab vendorId={vendorId} />}
            {tab === "reports" && <SalesReportsTab vendorId={vendorId} />}
            {tab === "accounting" && <AccountingTab vendorId={vendorId} />}
        </Container>
    );
}
