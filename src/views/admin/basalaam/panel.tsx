"use client";

import {
    Box, Button, Chip, CircularProgress, Container, Divider, Fade, Stack, Tab, Tabs, Tooltip, Typography,
} from "@mui/material";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import basalaam from "@/layout/assets/basalaam.png";
import { Get } from "@/utils/fetch";
import BslProducts from "./components/products";
import BslOrders from "./components/orders";
import BslTools from "./components/tools";

const fa = (n: number) => Number(n || 0).toLocaleString("fa-IR");

// ─── Quick stats banner (order counts per status) ───────────────────────────
function StatsBanner({ vendorId, refreshKey }: { vendorId: string; refreshKey: number }) {
    const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        Get(`/api/basalaam/stats?vendorId=${encodeURIComponent(vendorId)}`)
            .then((res) => { if (alive) setStats(res); })
            .catch(() => { /* banner is best-effort */ })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [vendorId, refreshKey]);

    if (loading && !stats) {
        return (
            <Stack direction="row" sx={{ mb: 1.5, px: 0.5 }}>
                <Chip size="small" icon={<CircularProgress size={12} />} label="در حال بارگیری آمار…" variant="outlined" />
            </Stack>
        );
    }
    if (!stats) return null;

    const top = Object.entries(stats.byStatus).slice(0, 4);
    return (
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 1.5, px: 0.5 }}>
            <Chip size="small" color={stats.total > 0 ? "primary" : "default"} variant={stats.total > 0 ? "filled" : "outlined"}
                label={`📦 ${fa(stats.total)} سفارش`} />
            {top.map(([k, v]) => (
                <Chip key={k} size="small" variant="outlined" label={`${k}: ${fa(v)}`} />
            ))}
        </Stack>
    );
}

// ─── Sync controls (orders / stock from services) ───────────────────────────
function SyncControls({ onSyncDone }: { onSyncDone: () => void }) {
    const [busy, setBusy] = useState<null | "orders-from-services" | "stock-from-services">(null);

    async function triggerSync(type: "orders-from-services" | "stock-from-services") {
        const label = type === "orders-from-services" ? "سفارشات" : "موجودی";
        setBusy(type);
        try {
            const r = await fetch(`/api/sync/${type}`, { method: "GET", credentials: "include" });
            const j = await r.json().catch(() => ({}));
            if (r.ok) {
                toast.success(`همگام‌سازی ${label} در صف قرار گرفت — وضعیت: ${j.status ?? "در صف"}`);
                onSyncDone();
            } else {
                toast.error(`خطا در همگام‌سازی ${label}`);
            }
        } catch {
            toast.error(`خطا در همگام‌سازی ${label}`);
        } finally {
            setBusy(null);
        }
    }

    return (
        <Stack direction="row" gap={1} alignItems="center">
            <Tooltip title="همگام‌سازی سفارشات از باسلام">
                <span>
                    <Button size="small" variant="outlined" disabled={!!busy} onClick={() => triggerSync("orders-from-services")}
                        startIcon={busy === "orders-from-services" ? <CircularProgress size={14} /> : <SyncRoundedIcon fontSize="small" />}
                        sx={{ minWidth: 0, px: 1.5 }}>
                        سفارشات
                    </Button>
                </span>
            </Tooltip>
            <Tooltip title="همگام‌سازی موجودی از باسلام">
                <span>
                    <Button size="small" variant="outlined" disabled={!!busy} onClick={() => triggerSync("stock-from-services")}
                        startIcon={busy === "stock-from-services" ? <CircularProgress size={14} /> : <SyncRoundedIcon fontSize="small" />}
                        sx={{ minWidth: 0, px: 1.5 }}>
                        موجودی
                    </Button>
                </span>
            </Tooltip>
        </Stack>
    );
}

const TABS = [
    { value: 1, label: "سفارشات" },
    { value: 2, label: "موجودی‌ها" },
    { value: 3, label: "ابزارها" },
];

export default function BasalaamPanel({ vendorId }: { vendorId: string }) {
    const searchParams = useSearchParams();
    const tab = searchParams?.get("tab") ?? "1";
    const [tabIndex, setTabIndex] = useState(Number(tab) || 1);
    const [refreshKey, setRefreshKey] = useState(0);
    const bump = () => setRefreshKey((k) => k + 1);

    return (
        <Container maxWidth={false} sx={{ my: 2, px: { xs: 1, md: 2 } }}>
            {/* Header */}
            <Stack direction="row" gap={2} alignItems="center" sx={{ mb: 1 }}>
                <Box component={Image} src={basalaam} width={40} height={40} alt="basalaam" sx={{ borderRadius: 0.6, flexShrink: 0 }} />
                <Stack sx={{ display: { xs: "none", sm: "flex" } }}>
                    <Typography variant="subtitle1" fontWeight={700}>شعبه {vendorId}</Typography>
                    <Typography variant="caption" color="text.secondary">پنل مدیریت باسلام</Typography>
                </Stack>
                <Box flex="1 1 auto" />
                <SyncControls onSyncDone={bump} />
            </Stack>

            <StatsBanner vendorId={vendorId} refreshKey={refreshKey} />

            <Divider sx={{ mb: 1 }} />

            <Tabs
                onChange={(_, v) => setTabIndex(v)}
                value={tabIndex}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 0.5, "& .MuiTab-root": { minHeight: 44, py: 0.5, fontWeight: 600 }, "& .Mui-selected": { color: "primary.main" } }}
            >
                {TABS.map((t) => <Tab key={t.value} value={t.value} label={t.label} />)}
            </Tabs>

            <Fade in key={`${tabIndex}-${refreshKey}`} timeout={200}>
                <Box>
                    {tabIndex === 1 && <BslOrders key={`orders-${refreshKey}`} vendorId={vendorId} />}
                    {tabIndex === 2 && <BslProducts key={`prod-${refreshKey}`} vendorId={vendorId} />}
                    {tabIndex === 3 && <BslTools key={`tools-${refreshKey}`} vendorId={vendorId} />}
                </Box>
            </Fade>
        </Container>
    );
}
