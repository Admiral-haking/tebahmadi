"use client";

import {
    Box, Button, Chip, CircularProgress, Container,
    Divider, Fade, Paper, Stack, Tab, Tabs, Tooltip, Typography,
} from "@mui/material";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import digikala from "@/layout/assets/digikala.jpeg";
import Inventory from "./components/inventory";
import ActiveOrders from "./components/active-orders";
import ProductsDgk from "./components/products";
import VariantsSpec from "./components/variants-spec";
import PackagesSpec from "./components/packages-spec";
import QuestionsSpec from "./components/questions-spec";
import DkShipments from "./components/dk-shipments";
import PromotionsSpec from "./components/promotions-spec";
import PricingSpec from "./components/pricing-spec";
import SellerProfile from "./components/seller-profile";
import InsightDashboard from "./components/insight-dashboard";
import PanelDataResetButton from "./components/panel-data-reset";
import LightningDealSpec from "./components/lightning-deal-spec";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import InventoryRoundedIcon from "@mui/icons-material/InventoryRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import CampaignRoundedIcon from "@mui/icons-material/CampaignRounded";
import { toast } from "sonner";

// ─── Sub-tab panel ────────────────────────────────────────────────────────────

function SubTabPanel({
    tabs,
    refreshKey,
    children,
}: {
    tabs: Array<{ value: string; label: string; icon?: React.ReactNode }>;
    refreshKey: number;
    children: (sub: string, rk: number) => React.ReactNode;
}) {
    const [sub, setSub] = useState(tabs[0].value);
    return (
        <Box>
            <Paper
                elevation={0}
                sx={{
                    borderBottom: 1,
                    borderColor: "divider",
                    bgcolor: "action.hover",
                    borderRadius: "8px 8px 0 0",
                    px: 1,
                }}
            >
                <Tabs
                    value={sub}
                    onChange={(_, v) => setSub(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        "& .MuiTab-root": {
                            minHeight: 38,
                            py: 0.5,
                            fontSize: "0.8rem",
                            gap: 0.5,
                        },
                    }}
                >
                    {tabs.map((t) => (
                        <Tab
                            key={t.value}
                            value={t.value}
                            label={t.label}
                            icon={t.icon as any}
                            iconPosition="start"
                        />
                    ))}
                </Tabs>
            </Paper>
            <Fade in key={`${sub}-${refreshKey}`} timeout={180}>
                <Box>{children(sub, refreshKey)}</Box>
            </Fade>
        </Box>
    );
}

// ─── Quick stats banner ───────────────────────────────────────────────────────

interface QuickStats {
    activeOrders: number;
    unansweredQuestions: number;
    pendingPackages: number;
    variantsCount: number;
}

function QuickStatsBanner({ vendorId, refreshKey }: { vendorId: string; refreshKey: number }) {
    const [stats, setStats] = useState<QuickStats | null>(null);
    const [loading, setLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const load = useCallback(() => {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);

        Promise.allSettled([
            fetch(`/api/digikala/orders/active?vendorId=${encodeURIComponent(vendorId)}&page=1`, {
                credentials: "include", signal: ctrl.signal,
            }).then((r) => r.ok ? r.json() : null),
            fetch(`/api/digikala/open-api/questions?vendorId=${encodeURIComponent(vendorId)}&page=1&size=50`, {
                credentials: "include", signal: ctrl.signal,
            }).then((r) => r.ok ? r.json() : null),
            fetch(`/api/digikala/open-api/packages?vendorId=${encodeURIComponent(vendorId)}&page=1&size=1`, {
                credentials: "include", signal: ctrl.signal,
            }).then((r) => r.ok ? r.json() : null),
            fetch(`/api/digikala/open-api/variants?vendorId=${encodeURIComponent(vendorId)}&page=1&size=1`, {
                credentials: "include", signal: ctrl.signal,
            }).then((r) => r.ok ? r.json() : null),
        ]).then(([ordersRes, questionsRes, packagesRes, variantsRes]) => {
            if (ctrl.signal.aborted) return;

            const orders = ordersRes.status === "fulfilled" ? ordersRes.value : null;
            const questions = questionsRes.status === "fulfilled" ? questionsRes.value : null;
            const packages = packagesRes.status === "fulfilled" ? packagesRes.value : null;
            const variants = variantsRes.status === "fulfilled" ? variantsRes.value : null;

            const qItems: { answer_count: number }[] = questions?.data?.data?.items ?? [];
            const unanswered = qItems.filter((q) => !q.answer_count).length;

            setStats({
                activeOrders: orders?.data?.pager?.total_rows ?? 0,
                unansweredQuestions: unanswered,
                pendingPackages: packages?.data?.data?.pager?.total_rows ?? 0,
                variantsCount: variants?.data?.data?.pager?.total_rows ?? 0,
            });
        }).finally(() => {
            if (!ctrl.signal.aborted) setLoading(false);
        });
    }, [vendorId]);

    useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load, refreshKey]);

    if (!stats && !loading) return null;

    return (
        <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 1.5, px: 0.5 }}>
            {loading && !stats ? (
                <Chip size="small" icon={<CircularProgress size={12} />} label="در حال بارگیری آمار…" variant="outlined" />
            ) : stats ? (
                <>
                    <Chip
                        size="small"
                        label={`📦 ${stats.activeOrders.toLocaleString("fa-IR")} سفارش فعال`}
                        color={stats.activeOrders > 0 ? "primary" : "default"}
                        variant={stats.activeOrders > 0 ? "filled" : "outlined"}
                    />
                    <Chip
                        size="small"
                        label={`❓ ${stats.unansweredQuestions.toLocaleString("fa-IR")} سوال بی‌پاسخ`}
                        color={stats.unansweredQuestions > 0 ? "warning" : "default"}
                        variant={stats.unansweredQuestions > 0 ? "filled" : "outlined"}
                    />
                    <Chip
                        size="small"
                        label={`🚚 ${stats.pendingPackages.toLocaleString("fa-IR")} مرسوله`}
                        color="info"
                        variant="outlined"
                    />
                    <Chip
                        size="small"
                        label={`🏷️ ${stats.variantsCount.toLocaleString("fa-IR")} واریانت`}
                        variant="outlined"
                    />
                </>
            ) : null}
        </Stack>
    );
}

// ─── Sync controls ────────────────────────────────────────────────────────────

function SyncControls({ vendorId, onSyncDone }: { vendorId: string; onSyncDone: () => void }) {
    const [syncingOrders, setSyncingOrders] = useState(false);
    const [syncingStock, setSyncingStock] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    async function triggerSync(type: "orders-from-services" | "stock-from-services") {
        const label = type === "orders-from-services" ? "سفارشات" : "موجودی";
        const setter = type === "orders-from-services" ? setSyncingOrders : setSyncingStock;
        setter(true);
        try {
            const r = await fetch(`/api/sync/${type}`, { method: "GET", credentials: "include" });
            const j = await r.json().catch(() => ({}));
            if (r.ok) {
                toast.success(`همگام‌سازی ${label} در صف قرار گرفت — وضعیت: ${j.status ?? "در صف"}`);
                setLastSync(new Date());
                onSyncDone();
            } else {
                toast.error(`خطا در همگام‌سازی ${label}`);
            }
        } catch {
            toast.error(`خطا در همگام‌سازی ${label}`);
        } finally {
            setter(false);
        }
    }

    return (
        <Stack direction="row" gap={1} alignItems="center">
            {lastSync && (
                <Typography variant="caption" color="text.disabled">
                    {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { hour: "2-digit", minute: "2-digit" }).format(lastSync)}
                </Typography>
            )}
            <Tooltip title="همگام‌سازی سفارشات از دیجی‌کالا">
                <span>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={syncingOrders ? <CircularProgress size={14} /> : <SyncRoundedIcon fontSize="small" />}
                        disabled={syncingOrders || syncingStock}
                        onClick={() => triggerSync("orders-from-services")}
                        sx={{ minWidth: 0, px: 1.5 }}
                    >
                        سفارشات
                    </Button>
                </span>
            </Tooltip>
            <Tooltip title="همگام‌سازی موجودی از دیجی‌کالا">
                <span>
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={syncingStock ? <CircularProgress size={14} /> : <SyncRoundedIcon fontSize="small" />}
                        disabled={syncingOrders || syncingStock}
                        onClick={() => triggerSync("stock-from-services")}
                        sx={{ minWidth: 0, px: 1.5 }}
                    >
                        موجودی
                    </Button>
                </span>
            </Tooltip>
        </Stack>
    );
}

// ─── Tab definitions (8 top-level tabs, merged groups use SubTabPanel) ────────

const TABS = [
    { value: 1, label: "سفارشات" },
    { value: 2, label: "موجودی و انبار" },
    { value: 3, label: "کالاها" },
    { value: 4, label: "مرسولات" },
    { value: 5, label: "سوالات" },
    { value: 6, label: "بازاریابی" },
    { value: 7, label: "آمار" },
    { value: 8, label: "پروفایل" },
];

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function DigikalaPanel({ vendorId }: { vendorId: string }) {
    const [tabIndex, setTabIndex] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);

    function bumpRefresh() {
        setRefreshKey((k) => k + 1);
    }

    return (
        <Container maxWidth={false} sx={{ my: 2, px: { xs: 1, md: 2 } }}>
            {/* Header */}
            <Stack direction="row" gap={2} alignItems="center" sx={{ mb: 1 }}>
                <Box
                    component={Image}
                    src={digikala}
                    width={40}
                    height={40}
                    alt="digikala"
                    sx={{ borderRadius: 0.6, flexShrink: 0 }}
                />
                <Stack sx={{ display: { xs: "none", sm: "flex" } }}>
                    <Typography variant="subtitle1" fontWeight={700}>شعبه {vendorId}</Typography>
                    <Typography variant="caption" color="text.secondary">پنل مدیریت دیجی‌کالا</Typography>
                </Stack>
                <Box flex="1 1 auto" />
                <PanelDataResetButton />
                <SyncControls vendorId={vendorId} onSyncDone={bumpRefresh} />
            </Stack>

            <QuickStatsBanner vendorId={vendorId} refreshKey={refreshKey} />

            <Divider sx={{ mb: 1 }} />

            {/* Top-level tabs */}
            <Tabs
                onChange={(_, v) => setTabIndex(v)}
                value={tabIndex}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                    mb: 0.5,
                    "& .MuiTab-root": { minHeight: 44, py: 0.5, fontWeight: 600 },
                    "& .Mui-selected": { color: "primary.main" },
                }}
            >
                {TABS.map((t) => <Tab key={t.value} value={t.value} label={t.label} />)}
            </Tabs>

            {/* Tab content with Fade transition */}
            <Fade in key={tabIndex} timeout={200}>
                <Box>
                    {tabIndex === 1 && (
                        <ActiveOrders key={`orders-${refreshKey}`} vendorId={vendorId} onNavigateTo={setTabIndex} />
                    )}

                    {tabIndex === 2 && (
                        <SubTabPanel
                            refreshKey={refreshKey}
                            tabs={[
                                { value: "inv", label: "موجودی‌ها", icon: <InventoryRoundedIcon sx={{ fontSize: 16 }} /> },
                                { value: "var", label: "واریانت‌ها", icon: <Box component="span" sx={{ fontSize: 14 }}>🏷️</Box> },
                            ]}
                        >
                            {(sub, rk) => (
                                <>
                                    {sub === "inv" && <Inventory key={`inv-${rk}`} vendorId={vendorId} />}
                                    {sub === "var" && <VariantsSpec key={`var-${rk}`} vendorId={vendorId} />}
                                </>
                            )}
                        </SubTabPanel>
                    )}

                    {tabIndex === 3 && (
                        <ProductsDgk key={`prod-${refreshKey}`} vendorId={vendorId} />
                    )}

                    {tabIndex === 4 && (
                        <SubTabPanel
                            refreshKey={refreshKey}
                            tabs={[
                                { value: "pkg", label: "مرسوله‌های در راه", icon: <LocalShippingRoundedIcon sx={{ fontSize: 16 }} /> },
                                { value: "ship", label: "مرسله‌های DK", icon: <Box component="span" sx={{ fontSize: 14 }}>🏭</Box> },
                            ]}
                        >
                            {(sub, rk) => (
                                <>
                                    {sub === "pkg"  && <PackagesSpec key={`pkg-${rk}`}  vendorId={vendorId} />}
                                    {sub === "ship" && <DkShipments  key={`ship-${rk}`} vendorId={vendorId} />}
                                </>
                            )}
                        </SubTabPanel>
                    )}

                    {tabIndex === 5 && (
                        <QuestionsSpec key={`q-${refreshKey}`} vendorId={vendorId} />
                    )}

                    {tabIndex === 6 && (
                        <SubTabPanel
                            refreshKey={refreshKey}
                            tabs={[
                                { value: "promo", label: "کمپین‌ها", icon: <CampaignRoundedIcon sx={{ fontSize: 16 }} /> },
                                { value: "price", label: "قیمت‌گذاری هوشمند", icon: <Box component="span" sx={{ fontSize: 14 }}>💰</Box> },
                                { value: "ld",    label: "برق‌آسا",            icon: <Box component="span" sx={{ fontSize: 14 }}>⚡</Box> },
                            ]}
                        >
                            {(sub, rk) => (
                                <>
                                    {sub === "promo" && <PromotionsSpec    key={`promo-${rk}`} vendorId={vendorId} />}
                                    {sub === "price" && <PricingSpec       key={`price-${rk}`} vendorId={vendorId} />}
                                    {sub === "ld"    && <LightningDealSpec key={`ld-${rk}`}    vendorId={vendorId} />}
                                </>
                            )}
                        </SubTabPanel>
                    )}

                    {tabIndex === 7 && (
                        <InsightDashboard key={`ins-${refreshKey}`} vendorId={vendorId} />
                    )}

                    {tabIndex === 8 && (
                        <SellerProfile key={`prof-${refreshKey}`} vendorId={vendorId} />
                    )}
                </Box>
            </Fade>
        </Container>
    );
}
