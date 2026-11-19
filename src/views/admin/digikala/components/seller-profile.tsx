"use client";

import { RefreshButton } from "@/components/refresh";
import {
    Box, Button, Card, CardContent, Chip, CircularProgress, Container, Divider,
    LinearProgress, Skeleton, Stack, Tab, Tabs, Typography,
} from "@mui/material";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
    if (value == null || value === "") return null;
    return (
        <Stack direction="row" gap={1} alignItems="flex-start" sx={{ py: 0.75 }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 140, flexShrink: 0 }}>{label}</Typography>
            <Typography variant="body2" fontWeight={500}>{String(value)}</Typography>
        </Stack>
    );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

function ProfileTab({ vendorId }: { vendorId: string }) {
    const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
    const [store, setStore] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    function load() {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        setError(null);

        Promise.allSettled([
            callProxy(vendorId, "profile", ctrl.signal),
            callProxy(vendorId, "profile/store", ctrl.signal),
        ]).then(([profileRes, storeRes]) => {
            if (profileRes.status === "fulfilled") {
                // DGK profile returns { business: {...}, financial: {...}, store: {...}, addresses: [...], ... }
                const raw = profileRes.value?.data?.data ?? profileRes.value?.data ?? {};
                // Flatten nested structure for display
                const business = (raw?.business ?? {}) as Record<string, unknown>;
                const financial = (raw?.financial ?? {}) as Record<string, unknown>;
                const flatProfile: Record<string, unknown> = {
                    ...business,
                    ...financial,
                    _addresses: raw?.addresses,
                    _warehouses: raw?.warehouses,
                };
                setProfile(flatProfile);
            }
            if (storeRes.status === "fulfilled") {
                const d = storeRes.value?.data?.data ?? storeRes.value?.data ?? {};
                setStore(d);
            }
            if (profileRes.status === "rejected" && storeRes.status === "rejected") {
                const err = profileRes.reason as Error;
                if (err.name !== "AbortError") { setError(err.message); }
            }
        }).finally(() => setLoading(false));
    }

    useEffect(() => { load(); return () => abortRef.current?.abort(); }, [vendorId]);

    const str = (v: unknown) => (v != null ? String(v) : undefined);

    return (
        <Box>
            {loading && <LinearProgress sx={{ mb: 2 }} />}
            {error && (
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                    <Button variant="outlined" color="error" size="small" onClick={load}>تلاش دوباره</Button>
                </Stack>
            )}
            <Stack direction={{ xs: "column", md: "row" }} gap={2} alignItems="stretch">
                {/* Profile card */}
                <Card variant="outlined" sx={{ flex: 1 }}>
                    <CardContent>
                        <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 2 }}>
                            <PersonRoundedIcon color="primary" />
                            <Typography variant="subtitle1" fontWeight={700}>اطلاعات فروشنده</Typography>
                        </Stack>
                        {loading && !profile ? (
                            <Stack spacing={1}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={28} />)}</Stack>
                        ) : profile ? (
                            <Stack divider={<Divider />}>
                                <InfoRow label="نام" value={`${str(profile.first_name) ?? ""} ${str(profile.last_name) ?? ""}`.trim() || undefined} />
                                <InfoRow label="نوع کسب‌وکار" value={str(profile.business_type)} />
                                <InfoRow label="ایمیل" value={str(profile.email)} />
                                <InfoRow label="تلفن ثبت‌نام" value={str(profile.register_phone)} />
                                <InfoRow label="موبایل" value={str(profile.mobile_phone)} />
                                <InfoRow label="کد ملی" value={str(profile.national_id)} />
                                <InfoRow label="شبا" value={str(profile.shaba_number)} />
                                <InfoRow label="شناسه حساب" value={str(profile.account_id)} />
                            </Stack>
                        ) : (
                            !error && <Typography variant="body2" color="text.secondary">اطلاعاتی یافت نشد</Typography>
                        )}
                    </CardContent>
                </Card>

                {/* Store card */}
                <Card variant="outlined" sx={{ flex: 1 }}>
                    <CardContent>
                        <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 2 }}>
                            <StorefrontRoundedIcon color="secondary" />
                            <Typography variant="subtitle1" fontWeight={700}>اطلاعات فروشگاه</Typography>
                        </Stack>
                        {loading && !store ? (
                            <Stack spacing={1}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={28} />)}</Stack>
                        ) : store ? (
                            <Stack divider={<Divider />}>
                                <InfoRow label="نام فروشگاه" value={str(store.name)} />
                                <InfoRow label="نام انگلیسی" value={str(store.name_en) ?? str(store.name_latin)} />
                                <InfoRow label="توضیحات" value={str(store.description)} />
                                <InfoRow label="شهر" value={str(store.city) ?? str((store.address as Record<string,unknown>)?.city)} />
                                <InfoRow label="آدرس" value={str(store.address_text) ?? str((store.address as Record<string,unknown>)?.text)} />
                                <InfoRow label="کد پستی" value={str(store.postal_code) ?? str((store.address as Record<string,unknown>)?.postal_code)} />
                                <InfoRow label="وضعیت" value={str(store.status)} />
                                <InfoRow label="امتیاز" value={str(store.score) ?? str(store.rating)} />
                            </Stack>
                        ) : (
                            !error && <Typography variant="body2" color="text.secondary">اطلاعاتی یافت نشد</Typography>
                        )}
                    </CardContent>
                </Card>
            </Stack>
        </Box>
    );
}

// ─── Performance Tab ─────────────────────────────────────────────────────────

function PerformanceTab({ vendorId }: { vendorId: string }) {
    const [data, setData] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    function load() {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        setError(null);
        callProxy(vendorId, "profile/performance", ctrl.signal)
            .then((json) => {
                const d = json?.data?.data ?? json?.data ?? {};
                setData(d);
            })
            .catch((err) => { if (err.name !== "AbortError") { setError(err.message); toast.error(`خطا: ${err.message}`); } })
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); return () => abortRef.current?.abort(); }, [vendorId]);

    const str = (v: unknown) => (v != null ? String(v) : undefined);

    function renderSection(title: string, obj: Record<string, unknown> | null | undefined) {
        if (!obj || typeof obj !== "object") return null;
        const entries = Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && typeof v !== "object");
        if (entries.length === 0) return null;
        return (
            <Card variant="outlined">
                <CardContent>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>
                    <Stack divider={<Divider />}>
                        {entries.map(([k, v]) => (
                            <InfoRow key={k} label={k} value={str(v)} />
                        ))}
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    return (
        <Box>
            {loading && <LinearProgress sx={{ mb: 2 }} />}
            {error && (
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                    <Button variant="outlined" color="error" size="small" onClick={load}>تلاش دوباره</Button>
                </Stack>
            )}
            {loading && !data ? (
                <Stack spacing={2}>
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={120} sx={{ borderRadius: 2 }} />)}
                </Stack>
            ) : data ? (
                <Stack spacing={2}>
                    {typeof data === "object" && Object.entries(data).map(([key, val]) => {
                        if (val === null || val === undefined) return null;
                        if (typeof val === "object" && !Array.isArray(val)) {
                            return renderSection(key, val as Record<string, unknown>);
                        }
                        return (
                            <Card key={key} variant="outlined">
                                <CardContent>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="body2" color="text.secondary">{key}</Typography>
                                        <Chip size="small" label={String(val)} color="primary" />
                                    </Stack>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {Object.keys(data).length === 0 && (
                        <Typography variant="body2" color="text.secondary">داده‌ای یافت نشد</Typography>
                    )}
                </Stack>
            ) : (
                !error && <Typography variant="body2" color="text.secondary">داده‌ای یافت نشد</Typography>
            )}
        </Box>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SellerProfile({ vendorId }: { vendorId: string }) {
    const [tab, setTab] = useState<"profile" | "performance">("profile");

    return (
        <Container maxWidth={false} sx={{ my: 4, px: { xs: 1, md: 3 } }}>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
                <PersonRoundedIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>پروفایل فروشنده</Typography>
            </Stack>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
                <Tab value="profile" label="اطلاعات فروشنده" icon={<StorefrontRoundedIcon fontSize="small" />} iconPosition="start" />
                <Tab value="performance" label="عملکرد" icon={<BarChartRoundedIcon fontSize="small" />} iconPosition="start" />
            </Tabs>

            {tab === "profile" && <ProfileTab vendorId={vendorId} />}
            {tab === "performance" && <PerformanceTab vendorId={vendorId} />}
        </Container>
    );
}
