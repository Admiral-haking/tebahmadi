"use client";

import {
    Alert,
    Avatar,
    Box,
    Chip,
    Container,
    Divider,
    Grid,
    IconButton,
    LinearProgress,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Paper,
    Skeleton,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tabs,
    Tooltip,
    Typography
} from "@mui/material";
import type { ChipProps } from "@mui/material/Chip";
import { alpha, useTheme } from "@mui/material/styles";
import {
    TrendingUp as TrendingUpIcon,
    ShoppingBag as ShoppingBagIcon,
    LocalShipping as LocalShippingIcon,
    PeopleAlt as PeopleAltIcon,
    MoreHoriz as MoreHorizIcon,
    RefreshOutlined as RefreshOutlinedIcon
} from "@mui/icons-material";
import { DateTime } from "luxon";
import useSWR from "swr";
import { useId, useMemo, useState } from "react";

const currencyFormatter = new Intl.NumberFormat("fa-IR");
const percentFormatter = new Intl.NumberFormat("fa-IR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
});
const dateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    month: "long",
    day: "numeric"
});

const TEHRAN_ZONE = "Asia/Tehran";

type TrendRange = "week" | "month" | "quarter";

type InvoiceStatus = "draft" | "pending" | "paid" | "canceled" | "refunded";

interface SeriesPoint {
    date: string;
    total: number;
}

interface DashboardData {
    lastUpdated: string;
    stats: {
        salesToday: { value: number; change: number };
        ordersToday: { value: number; change: number };
        pendingOrders: { value: number; change: number };
        activeCustomers: { value: number; change: number };
    };
    revenueSeries: {
        week: SeriesPoint[];
        month: SeriesPoint[];
        quarter: SeriesPoint[];
    };
    topProducts: Array<{
        productId?: string;
        title: string;
        variantSummary?: string;
        revenue: number;
        units: number;
    }>;
    recentOrders: Array<{
        id: string;
        number: string;
        customer: string;
        total: number;
        status: InvoiceStatus;
        createdAt: string;
        city?: string;
        items: number;
    }>;
    statusBreakdown: Array<{
        status: InvoiceStatus;
        count: number;
        value: number;
    }>;
    conversion: {
        rate: number;
        paid: number;
        total: number;
    };
}

interface DashboardResponse {
    data: DashboardData;
}

type AccentKey = "primary" | "secondary" | "info" | "success" | "warning" | "error";

interface StatCardItem {
    id: string;
    title: string;
    metric: number;
    suffix?: string;
    change: number;
    icon: typeof TrendingUpIcon;
    accentKey: AccentKey;
    trend?: number[];
}

async function fetchDashboard(url: string): Promise<DashboardResponse> {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
        const message = await response.text().catch(() => "");
        throw new Error(message || "خطا در دریافت داده‌های داشبورد");
    }
    return response.json() as Promise<DashboardResponse>;
}

function StatCard({ item }: { item: StatCardItem }) {
    const theme = useTheme();
    const gradientId = useId();
    // SVG presentation attributes can't resolve CSS var(), so resolve the
    // actual color here for the gradient/stroke only. All sx styling uses
    // --mui-palette-* vars below.
    const accent = theme.palette[item.accentKey].main;
    const accentVar = `var(--mui-palette-${item.accentKey}-main)`;
    const accentChannel = `var(--mui-palette-${item.accentKey}-mainChannel)`;
    const trend = Array.isArray(item.trend) && item.trend.length > 0 ? item.trend : null;
    const hasGraph = Boolean(trend && trend.length > 1);
    const width = 220;
    const height = 80;
    let points = "";
    let areaPoints = "";
    let min = 0;
    let max = 0;
    let range = 1;

    if (trend) {
        min = Math.min(...trend);
        max = Math.max(...trend);
        range = max - min || 1;
        if (hasGraph) {
            points = trend.map((value, index) => {
                const x = trend.length > 1 ? (index / (trend.length - 1)) * width : width / 2;
                const y = height - ((value - min) / range) * height;
                return `${x},${y}`;
            }).join(" ");
            areaPoints = `${points} ${width},${height} 0,${height}`;
        }
    }

    const positive = item.change >= 0;
    const safeChange = Number.isFinite(item.change) ? item.change : 0;

    return (
        <Paper
            elevation={0}
            sx={{
                p: 3,
                borderRadius: 3,
                position: "relative",
                overflow: "hidden",
                border: "1px solid rgba(var(--mui-palette-dividerChannel) / 0.7)",
                background: `linear-gradient(140deg, rgba(${accentChannel} / 0.14), rgba(${accentChannel} / 0.04))`,
                minHeight: 190,
                display: "flex",
                flexDirection: "column"
            }}
        >
            <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        display: "grid",
                        placeItems: "center",
                        background: `linear-gradient(135deg, rgba(${accentChannel} / 0.18), rgba(${accentChannel} / 0.06))`,
                        color: accentVar
                    }}
                >
                    <item.icon />
                </Box>
                <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                        {item.title}
                    </Typography>
                    <Typography variant="h5" fontWeight={700}>
                        {currencyFormatter.format(Math.round(item.metric))}
                        {item.suffix ? (
                            <Typography component="span" variant="subtitle2" sx={{ ml: 0.5 }}>
                                {item.suffix}
                            </Typography>
                        ) : null}
                    </Typography>
                </Stack>
            </Stack>

            <Box flex={1} />

            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: trend ? 2 : 0 }}>
                <Chip
                    label={`${positive ? "+" : ""}${percentFormatter.format(safeChange)}٪`}
                    size="small"
                    color={positive ? "success" : "error"}
                    variant={positive ? "outlined" : "filled"}
                />
                <Typography variant="caption" color="text.secondary">
                    تغییر نسبت به بازه قبل
                </Typography>
            </Stack>

            {trend ? (
                <Box sx={{ height: height, width: "100%", position: "relative" }}>
                    {hasGraph ? (
                        <svg
                            width="100%"
                            height={height}
                            viewBox={`0 0 ${width} ${height}`}
                            preserveAspectRatio="none"
                        >
                            <defs>
                                <linearGradient id={`${gradientId}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor={alpha(accent, 0.4)} />
                                    <stop offset="100%" stopColor={alpha(accent, 0)} />
                                </linearGradient>
                                <linearGradient id={`${gradientId}-stroke`} x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor={accent} />
                                    <stop offset="100%" stopColor={alpha(accent, 0.8)} />
                                </linearGradient>
                            </defs>
                            <polygon points={areaPoints} fill={`url(#${gradientId}-fill)`} stroke="none" />
                            <polyline
                                points={points}
                                fill="none"
                                stroke={`url(#${gradientId}-stroke)`}
                                strokeWidth={3}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    ) : (
                        <Stack
                            alignItems="center"
                            justifyContent="center"
                            sx={{ height: "100%", bgcolor: `rgba(${accentChannel} / 0.05)`, borderRadius: 2 }}
                        >
                            <Typography variant="caption" color="text.secondary">
                                داده‌ی کافی برای نمودار نیست
                            </Typography>
                        </Stack>
                    )}
                </Box>
            ) : null}
        </Paper>
    );
}

function RevenueTrend({
    data,
    labels,
    accentKey
}: {
    data: number[];
    labels: string[];
    accentKey: AccentKey;
}) {
    const theme = useTheme();
    const gradientId = useId();
    // Resolved color is used only for SVG attributes (var() not supported there).
    const accent = theme.palette[accentKey].main;
    const accentVar = `var(--mui-palette-${accentKey}-main)`;
    const accentChannel = `var(--mui-palette-${accentKey}-mainChannel)`;
    const hasData = data.length > 0 && labels.length > 0;

    if (!hasData) {
        return (
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 2.5, md: 3 },
                    borderRadius: 3,
                    border: "1px solid rgba(var(--mui-palette-dividerChannel) / 0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 220
                }}
            >
                <Typography variant="body2" color="text.secondary">
                    داده‌ای برای نمایش روند فروش در این بازه موجود نیست.
                </Typography>
            </Paper>
        );
    }

    const width = 420;
    const height = 180;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((value, index) => {
        const x = data.length > 1 ? (index / (data.length - 1)) * width : width / 2;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
    }).join(" ");
    const areaPoints = `${points} ${width},${height} 0,${height}`;
    const lastValue = data[data.length - 1] ?? 0;
    const firstValue = data[0] ?? 0;
    const growth = firstValue === 0 ? (lastValue > 0 ? 100 : 0) : ((lastValue - firstValue) / firstValue) * 100;
    const chipStart = Math.max(0, labels.length - 3);
    const summaryChips = labels.slice(chipStart).map((label, index) => ({
        label,
        value: data[chipStart + index] ?? 0
    }));

    return (
        <Paper
            elevation={0}
            sx={{
                p: { xs: 2.5, md: 3 },
                borderRadius: 3,
                border: "1px solid rgba(var(--mui-palette-dividerChannel) / 0.6)",
                background: `radial-gradient(circle at top right, rgba(${accentChannel} / 0.16), transparent 55%)`
            }}
        >
            <Stack direction="row" alignItems={{ xs: "stretch", md: "center" }} spacing={2.5}>
                <Box flex={1} minWidth={0}>
                    <Typography variant="subtitle2" color="text.secondary">
                        نمودار فروش آنلاین
                    </Typography>
                    <Typography variant="h4" fontWeight={700} sx={{ mt: 1 }}>
                        {currencyFormatter.format(Math.round(lastValue))} تومان
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                        میانگین رشد {percentFormatter.format(growth)}٪ طی دوره انتخابی
                    </Typography>

                    <Stack direction="row" spacing={1.5} sx={{ mt: 3 }} flexWrap="wrap">
                        {summaryChips.map((item) => (
                            <Chip
                                key={item.label}
                                label={`${item.label} • ${currencyFormatter.format(Math.round(item.value))}`}
                                size="small"
                                sx={{
                                    bgcolor: `rgba(${accentChannel} / 0.08)`,
                                    color: accentVar,
                                    borderRadius: 2,
                                    mb: 1
                                }}
                            />
                        ))}
                    </Stack>
                </Box>

        <Box sx={{ flex: { xs: 1, md: 1.2 }, minWidth: 280, position: "relative" }}>
                    <Box sx={{ height: height }}>
                        <svg
                            width="100%"
                            height={height}
                            viewBox={`0 0 ${width} ${height}`}
                            preserveAspectRatio="none"
                        >
                            <defs>
                                <linearGradient id={`${gradientId}-main`} x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor={alpha(accent, 0.4)} />
                                    <stop offset="100%" stopColor={alpha(accent, 0)} />
                                </linearGradient>
                                <linearGradient id={`${gradientId}-stroke`} x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor={accent} />
                                    <stop offset="100%" stopColor={alpha(accent, 0.7)} />
                                </linearGradient>
                            </defs>
                            <polygon points={areaPoints} fill={`url(#${gradientId}-main)`} stroke="none" />
                            <polyline
                                points={points}
                                fill="none"
                                stroke={`url(#${gradientId}-stroke)`}
                                strokeWidth={3.2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            {data.map((value, index) => {
                                const x = data.length > 1 ? (index / (data.length - 1)) * width : width / 2;
                                const y = height - ((value - min) / range) * height;
                                return (
                                    <circle
                                        key={`${value}-${index}`}
                                        cx={x}
                                        cy={y}
                                        r={5}
                                        fill={theme.palette.background.paper}
                                        stroke={accent}
                                        strokeWidth={2}
                                    />
                                );
                            })}
                        </svg>
                    </Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
                        {labels.map((label) => (
                            <Typography key={label} variant="caption" color="text.secondary">
                                {label}
                            </Typography>
                        ))}
                    </Stack>
                </Box>
            </Stack>
        </Paper>
    );
}

const statusIntentions: Record<InvoiceStatus, { label: string; color: ChipProps["color"] }> = {
    draft: { label: "پیش‌نویس", color: "default" },
    pending: { label: "در انتظار پرداخت", color: "info" },
    paid: { label: "پرداخت شده", color: "success" },
    canceled: { label: "لغو شده", color: "error" },
    refunded: { label: "مرجوع شده", color: "secondary" }
};

function formatSeriesLabel(range: TrendRange, isoDate: string): string {
    const date = DateTime.fromISO(isoDate, { zone: TEHRAN_ZONE }).setLocale("fa-IR");
    if (!date.isValid) {
        return isoDate;
    }
    if (range === "week") {
        return date.toLocaleString({ weekday: "long" });
    }
    if (range === "month") {
        return date.toFormat("d LLL");
    }
    return date.toLocaleString({ month: "long" });
}

function formatOrderTimestamp(isoDate: string): string {
    const date = DateTime.fromISO(isoDate, { zone: TEHRAN_ZONE }).setLocale("fa-IR");
    if (!date.isValid) {
        return isoDate;
    }
    return date.toFormat("HH:mm - d LLL");
}

function clampRate(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value < 0) {
        return 0;
    }
    if (value > 100) {
        return 100;
    }
    return value;
}

export default function Page() {
    const [range, setRange] = useState<TrendRange>("week");
    const { data, error, isLoading, isValidating, mutate } = useSWR<DashboardResponse>(
        "/api/admin/dashboard",
        fetchDashboard,
        { refreshInterval: 60_000 }
    );
    const dashboard = data?.data;
    const now = useMemo(() => new Date(), []);

    const lastUpdatedLabel = useMemo(() => {
        if (!dashboard?.lastUpdated) {
            return null;
        }
        const date = DateTime.fromISO(dashboard.lastUpdated, { zone: TEHRAN_ZONE }).setLocale("fa-IR");
        if (!date.isValid) {
            return null;
        }
        return date.toFormat("HH:mm");
    }, [dashboard?.lastUpdated]);

    const trend = useMemo(() => {
        if (!dashboard) {
            return { labels: [] as string[], data: [] as number[] };
        }
        const series =
            range === "week"
                ? dashboard.revenueSeries.week
                : range === "month"
                    ? dashboard.revenueSeries.month
                    : dashboard.revenueSeries.quarter;
        return {
            labels: series.map((point) => formatSeriesLabel(range, point.date)),
            data: series.map((point) => point.total)
        };
    }, [dashboard, range]);

    const statCards = useMemo<StatCardItem[]>(() => {
        return [
            {
                id: "sales",
                title: "فروش امروز",
                metric: dashboard?.stats.salesToday.value ?? 0,
                suffix: " تومان",
                change: dashboard?.stats.salesToday.change ?? 0,
                icon: TrendingUpIcon,
                accentKey: "primary",
                trend: dashboard?.revenueSeries.week.map((point) => point.total)
            },
            {
                id: "orders",
                title: "سفارش‌های امروز",
                metric: dashboard?.stats.ordersToday.value ?? 0,
                suffix: " سفارش",
                change: dashboard?.stats.ordersToday.change ?? 0,
                icon: ShoppingBagIcon,
                accentKey: "secondary"
            },
            {
                id: "pending",
                title: "سفارش‌های در انتظار",
                metric: dashboard?.stats.pendingOrders.value ?? 0,
                suffix: " سفارش",
                change: dashboard?.stats.pendingOrders.change ?? 0,
                icon: LocalShippingIcon,
                accentKey: "info"
            },
            {
                id: "customers",
                title: "مشتریان فعال",
                metric: dashboard?.stats.activeCustomers.value ?? 0,
                suffix: " نفر",
                change: dashboard?.stats.activeCustomers.change ?? 0,
                icon: PeopleAltIcon,
                accentKey: "success"
            }
        ];
    }, [
        dashboard?.revenueSeries.week,
        dashboard?.stats.activeCustomers.change,
        dashboard?.stats.activeCustomers.value,
        dashboard?.stats.ordersToday.change,
        dashboard?.stats.ordersToday.value,
        dashboard?.stats.pendingOrders.change,
        dashboard?.stats.pendingOrders.value,
        dashboard?.stats.salesToday.change,
        dashboard?.stats.salesToday.value
    ]);

    const fulfillmentStats = useMemo(() => {
        if (!dashboard) {
            return [];
        }
        const total = dashboard.statusBreakdown.reduce((sum, stat) => sum + stat.count, 0);
        const breakdownMap = new Map(dashboard.statusBreakdown.map((item) => [item.status, item]));

        const items: Array<{
            id: string;
            title: string;
            accentKey: AccentKey;
            count: number;
            value: number;
        }> = [
            {
                id: "paid",
                title: "سفارش‌های تکمیل شده",
                accentKey: "success",
                count: breakdownMap.get("paid")?.count ?? 0,
                value: breakdownMap.get("paid")?.value ?? 0
            },
            {
                id: "pending",
                title: "در انتظار پردازش",
                accentKey: "warning",
                count: breakdownMap.get("pending")?.count ?? 0,
                value: breakdownMap.get("pending")?.value ?? 0
            },
            {
                id: "canceled",
                title: "لغو شده",
                accentKey: "error",
                count: breakdownMap.get("canceled")?.count ?? 0,
                value: breakdownMap.get("canceled")?.value ?? 0
            },
            {
                id: "refunded",
                title: "مرجوعی‌ها",
                accentKey: "info",
                count: breakdownMap.get("refunded")?.count ?? 0,
                value: breakdownMap.get("refunded")?.value ?? 0
            }
        ];

        return items.map((item) => {
            const progress = total === 0 ? 0 : (item.count / total) * 100;
            return {
                ...item,
                progress: progress > 100 ? 100 : progress,
                caption: `${item.count} سفارش`,
                detail: `${currencyFormatter.format(Math.round(item.value))} تومان`
            };
        });
    }, [dashboard]);

    const topProducts = useMemo(() => {
        const palette: AccentKey[] = ["primary", "secondary", "info", "success", "warning"];

        if (!dashboard) {
            return [];
        }
        return dashboard.topProducts.map((product, index) => ({
            ...product,
            colorKey: palette[index % palette.length]
        }));
    }, [dashboard]);

    const conversionRate = clampRate(dashboard?.conversion.rate ?? 0);
    const isFetching = isLoading || isValidating;

    return (
        <Container maxWidth="lg" sx={{ overflowX: "hidden" }}>
            <Box sx={{ px: { xs: 2, md: 4 }, pb: 6, maxWidth: 1480, mx: "auto" }}>
                {isFetching ? (
                    <LinearProgress sx={{ mb: 3, borderRadius: 999 }} />
                ) : null}

                {error ? (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        خطا در بارگیری داده‌های داشبورد. لطفا دقایقی دیگر دوباره تلاش کنید.
                    </Alert>
                ) : null}

                <Paper
                    elevation={0}
                    sx={{
                        px: { xs: 3, md: 4 },
                        py: { xs: 3, md: 4 },
                        mb: 4,
                        borderRadius: 3,
                        border: "1px solid rgba(var(--mui-palette-dividerChannel) / 0.7)",
                        background: "linear-gradient(120deg, rgba(var(--mui-palette-primary-mainChannel) / 0.16), rgba(var(--mui-palette-background-defaultChannel) / 0.92))",
                        position: "relative",
                        overflow: "hidden"
                    }}
                >
                    <Box
                        sx={{
                            position: "absolute",
                            inset: "auto 16% -40% auto",
                            width: 280,
                            height: 280,
                            borderRadius: "50%",
                            background: "radial-gradient(circle, rgba(var(--mui-palette-primary-mainChannel) / 0.12), transparent 65%)",
                            filter: "blur(0px)",
                            pointerEvents: "none"
                        }}
                    />

                    <Stack direction={{ xs: "column", md: "row" }} spacing={3} alignItems={{ xs: "flex-start", md: "center" }}>
                        <Box flex={1}>
                            <Typography variant="overline" color="text.secondary">
                                داشبورد مدیریت فروشگاه
                            </Typography>
                            <Typography variant="h4" fontWeight={800} sx={{ mt: 1 }}>
                                خوش آمدید، امروز {dateFormatter.format(now)} است
                            </Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ mt: 2, maxWidth: 520, lineHeight: 1.7 }}>
                                عملکرد امروز فروشگاه را دنبال کنید، سفارش‌های در انتظار را بررسی نمایید و روند رشد فروش را از نزدیک ببینید.
                            </Typography>
                            <Stack direction="row" spacing={1.5} sx={{ mt: 3 }} flexWrap="wrap">
                                {lastUpdatedLabel ? (
                                    <Chip
                                        label={`آخرین بروزرسانی ${lastUpdatedLabel}`}
                                        size="small"
                                        icon={<RefreshOutlinedIcon fontSize="small" />}
                                        color="primary"
                                        variant="outlined"
                                    />
                                ) : null}
                                <Chip
                                    label={`سفارش‌های امروز ${currencyFormatter.format(Math.round(dashboard?.stats.ordersToday.value ?? 0))}`}
                                    variant="outlined"
                                    sx={{
                                        borderRadius: 2,
                                        bgcolor: "rgba(var(--mui-palette-secondary-mainChannel) / 0.08)",
                                        color: "var(--mui-palette-secondary-main)"
                                    }}
                                />
                            </Stack>
                        </Box>

                        <Stack alignItems="flex-start" spacing={2}>
                            <Typography variant="body2" color="text.secondary">
                                نرخ تبدیل ۳۰ روز اخیر
                            </Typography>
                            <Typography variant="h3" fontWeight={800}>
                                {percentFormatter.format(conversionRate)}٪
                            </Typography>
                            <Stack spacing={1}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: "50%",
                                            bgcolor: "rgba(var(--mui-palette-success-mainChannel) / 0.9)"
                                        }}
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                        سفارش‌های پرداخت شده {currencyFormatter.format(dashboard?.conversion.paid ?? 0)} مورد
                                    </Typography>
                                </Stack>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: "50%",
                                            bgcolor: "rgba(var(--mui-palette-info-mainChannel) / 0.85)"
                                        }}
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                        کل سفارش‌های ۳۰ روز اخیر {currencyFormatter.format(dashboard?.conversion.total ?? 0)} مورد
                                    </Typography>
                                </Stack>
                            </Stack>
                        </Stack>
                    </Stack>
                </Paper>

                <Grid container spacing={3}>
                    {statCards.map((item) => (
                        <Grid key={item.id} size={{ xs: 12, sm: 6, xl: 3 }}>
                            <StatCard item={item} />
                        </Grid>
                    ))}
                </Grid>

                <Grid container spacing={3} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12, lg: 7 }}>
                        <Tabs
                            value={range}
                            onChange={(_, value) => setRange(value)}
                            sx={{
                                mb: 2,
                                ".MuiTabs-flexContainer": {
                                    justifyContent: { xs: "space-between", sm: "flex-start" }
                                },
                                ".MuiTab-root": {
                                    minHeight: 0,
                                    py: 1.2,
                                    px: 2.5,
                                    borderRadius: "10px",
                                    mr: 1,
                                    bgcolor: "background.paper",
                                    textTransform: "none",
                                    fontWeight: 600,
                                    border: "1px solid rgba(var(--mui-palette-dividerChannel) / 0.6)"
                                },
                                ".Mui-selected": {
                                    bgcolor: "rgba(var(--mui-palette-primary-mainChannel) / 0.12) !important",
                                    color: "var(--mui-palette-primary-main) !important",
                                    borderColor: "rgba(var(--mui-palette-primary-mainChannel) / 0.4)"
                                },
                                ".MuiTabs-indicator": {
                                    display: "none"
                                }
                            }}
                        >
                            <Tab disableRipple value="week" label="نمای کلی هفتگی" />
                            <Tab disableRipple value="month" label="روند هفتگی اخیر" />
                            <Tab disableRipple value="quarter" label="سه‌ماهه جاری" />
                        </Tabs>
                        <RevenueTrend
                            data={trend.data}
                            labels={trend.labels}
                            accentKey="primary"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, lg: 5 }}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: { xs: 2.5, md: 3 },
                                borderRadius: 3,
                                height: "100%",
                                border: "1px solid rgba(var(--mui-palette-dividerChannel) / 0.6)",
                                display: "flex",
                                flexDirection: "column"
                            }}
                        >
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="h6" fontWeight={700}>
                                    وضعیت سفارش‌ها
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Tooltip title="تازه‌سازی داده‌ها">
                                        <IconButton size="small" onClick={() => mutate()} color="primary">
                                            <RefreshOutlinedIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="جزئیات بیشتر">
                                        <IconButton size="small" color="primary">
                                            <MoreHorizIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                توزیع سفارش‌ها بر اساس وضعیت جاری
                            </Typography>

                            <Stack spacing={2.8} sx={{ mt: 3, flex: 1 }}>
                                {fulfillmentStats.length > 0 ? (
                                    fulfillmentStats.map((item) => (
                                        <Stack key={item.id} spacing={1.2}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                <Typography variant="subtitle2">
                                                    {item.title}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {item.caption}
                                                </Typography>
                                            </Stack>
                                            <LinearProgress
                                                variant="determinate"
                                                value={item.progress}
                                                sx={{
                                                    height: 10,
                                                    borderRadius: 999,
                                                    bgcolor: `rgba(var(--mui-palette-${item.accentKey}-mainChannel) / 0.12)`,
                                                    "& .MuiLinearProgress-bar": {
                                                        borderRadius: 999,
                                                        bgcolor: `var(--mui-palette-${item.accentKey}-main)`
                                                    }
                                                }}
                                            />
                                            <Typography variant="caption" color="text.secondary">
                                                {item.detail}
                                            </Typography>
                                        </Stack>
                                    ))
                                ) : (
                                    <Typography variant="body2" color="text.secondary">
                                        {isFetching ? "در حال بارگذاری وضعیت سفارش‌ها..." : "سفارشی برای نمایش وجود ندارد."}
                                    </Typography>
                                )}
                            </Stack>

                            <Divider sx={{ my: 3 }} />

                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle2" color="text.secondary">
                                    میانگین نرخ تبدیل
                                </Typography>
                                <Chip
                                    label={`${percentFormatter.format(conversionRate)}٪`}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                />
                            </Stack>
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                {dashboard?.conversion.paid ?? 0} سفارش به ارزش {currencyFormatter.format(Math.round(dashboard?.stats.salesToday.value ?? 0))} تومان امروز پرداخت شده است.
                            </Typography>
                        </Paper>
                    </Grid>
                </Grid>

                <Grid container spacing={3} sx={{ mt: 1 }}>
                    <Grid size={{ xs: 12, lg: 7 }}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: { xs: 2, md: 3 },
                                borderRadius: 3,
                                border: "1px solid rgba(var(--mui-palette-dividerChannel) / 0.6)"
                            }}
                        >
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Stack spacing={0.5}>
                                    <Typography variant="h6" fontWeight={700}>
                                        آخرین سفارش‌ها
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        جزئیات سفارش‌های اخیر برای پیگیری سریع وضعیت
                                    </Typography>
                                </Stack>
                                <Chip
                                    label={`سفارش‌های امروز ${dashboard?.stats.ordersToday.value ?? 0}`}
                                    size="small"
                                    sx={{
                                        bgcolor: "rgba(var(--mui-palette-info-mainChannel) / 0.1)",
                                        color: "var(--mui-palette-info-main)",
                                        borderRadius: "8px"
                                    }}
                                />
                            </Stack>

                            <Box sx={{ mt: 2, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                                <Table sx={{ minWidth: 560 }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>کد سفارش</TableCell>
                                            <TableCell>مشتری</TableCell>
                                            <TableCell align="center">تعداد</TableCell>
                                            <TableCell align="center">شهر</TableCell>
                                            <TableCell align="right">مبلغ</TableCell>
                                            <TableCell align="right">وضعیت</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {dashboard?.recentOrders.length ? (
                                            dashboard.recentOrders.map((order) => {
                                                const intention = statusIntentions[order.status] ?? statusIntentions.pending;
                                                return (
                                                    <TableRow key={order.id}>
                                                        <TableCell>
                                                            <Stack spacing={0.5}>
                                                                <Typography fontWeight={600}>
                                                                    {order.number}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {formatOrderTimestamp(order.createdAt)}
                                                                </Typography>
                                                            </Stack>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography fontWeight={500}>{order.customer}</Typography>
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            {order.items || "-"}
                                                        </TableCell>
                                                        <TableCell align="center">
                                                            {order.city ?? "—"}
                                                        </TableCell>
                                                        <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                                                            {currencyFormatter.format(Math.round(order.total))} تومان
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            <Chip
                                                                label={intention.label}
                                                                size="small"
                                                                color={intention.color}
                                                                variant="outlined"
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center">
                                                    <Typography variant="body2" color="text.secondary">
                                                        {isFetching ? (
                                                            <Skeleton width={200} />
                                                        ) : "سفارشی برای نمایش وجود ندارد."}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, lg: 5 }}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: { xs: 2.5, md: 3 },
                                borderRadius: 3,
                                height: "100%",
                                border: "1px solid rgba(var(--mui-palette-dividerChannel) / 0.6)",
                                display: "flex",
                                flexDirection: "column"
                            }}
                        >
                            <Stack direction="row" alignItems="center" justifyContent="space-between">
                                <Typography variant="h6" fontWeight={700}>
                                    پرفروش‌ترین محصولات
                                </Typography>
                                <Chip
                                    label="۳۰ روز اخیر"
                                    size="small"
                                    variant="outlined"
                                />
                            </Stack>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                گزارش ترکیبی درآمد محصولات به همراه تعداد فروش
                            </Typography>

                            <List sx={{ mt: 2, flex: 1 }}>
                                {topProducts.length ? (
                                    topProducts.map((product) => (
                                        <ListItem
                                            key={product.productId ?? product.title}
                                            sx={{
                                                borderRadius: 2,
                                                mb: 1,
                                                border: `1px solid rgba(var(--mui-palette-${product.colorKey}-mainChannel) / 0.18)`,
                                                bgcolor: `rgba(var(--mui-palette-${product.colorKey}-mainChannel) / 0.05)`
                                            }}
                                            secondaryAction={
                                                <Chip
                                                    label={`${currencyFormatter.format(Math.round(product.revenue))} تومان`}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: "rgba(var(--mui-palette-success-mainChannel) / 0.16)",
                                                        color: "var(--mui-palette-success-main)",
                                                        borderRadius: "8px"
                                                    }}
                                                />
                                            }
                                        >
                                            <ListItemAvatar>
                                                <Avatar
                                                    sx={{
                                                        bgcolor: `rgba(var(--mui-palette-${product.colorKey}-mainChannel) / 0.15)`,
                                                        color: `var(--mui-palette-${product.colorKey}-main)`,
                                                        fontWeight: 700
                                                    }}
                                                >
                                                    {product.title.slice(0, 1)}
                                                </Avatar>
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={
                                                    <Typography variant="subtitle1" fontWeight={600}>
                                                        {product.title}
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Stack direction="row" spacing={2} alignItems="center">
                                                        <Typography variant="caption" color="text.secondary">
                                                            {product.variantSummary ?? "بدون تنوع مشخص"}
                                                        </Typography>
                                                        <Divider orientation="vertical" flexItem />
                                                        <Typography variant="caption" color="text.primary">
                                                            {currencyFormatter.format(Math.round(product.units))} واحد فروش
                                                        </Typography>
                                                    </Stack>
                                                }
                                            />
                                        </ListItem>
                                    ))
                                ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                        {isFetching ? <Skeleton width={180} /> : "داده‌ای از فروش محصولات در دسترس نیست."}
                                    </Typography>
                                )}
                            </List>

                            <Stack spacing={1.2} sx={{ mt: 1 }}>
                                <Typography variant="subtitle2">
                                    نرخ تکمیل سفارش‌ها
                                </Typography>
                                <LinearProgress
                                    variant="determinate"
                                    value={conversionRate}
                                    sx={{
                                        height: 8,
                                        borderRadius: 999,
                                        bgcolor: "rgba(var(--mui-palette-secondary-mainChannel) / 0.12)",
                                        "& .MuiLinearProgress-bar": {
                                            borderRadius: 999,
                                            bgcolor: "var(--mui-palette-secondary-main)"
                                        }
                                    }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                    {dashboard?.conversion.paid ?? 0} سفارش از {dashboard?.conversion.total ?? 0} مورد در ۳۰ روز گذشته به پرداخت کامل تبدیل شده است.
                                </Typography>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Container>
    );
}
