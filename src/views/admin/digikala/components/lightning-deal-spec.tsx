"use client";

import { RefreshButton } from "@/components/refresh";
import {
    Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent,
    DialogTitle, LinearProgress, MenuItem, Select, Skeleton, Stack, Tab, Tabs,
    TextField, Tooltip, Typography,
} from "@mui/material";
import BoltRoundedIcon from "@mui/icons-material/BoltRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";

function toman(rial: number) {
    return Math.round(rial / 10).toLocaleString("fa-IR");
}

function callProxy(vendorId: string, method: string, path: string, body?: unknown, signal?: AbortSignal) {
    const sep = path.includes("?") ? "&" : "?";
    const url = `/api/digikala/open-api/${path}${sep}vendorId=${encodeURIComponent(vendorId)}`;
    return fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
    }).then(async (r) => {
        const json = await r.json().catch(() => null);
        if (!r.ok) throw new Error(json?.error || json?.data?.message || `خطای ${r.status}`);
        return json;
    });
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface LightningProduct {
    product_id?: number;
    id?: number;
    title?: string;
    product_title?: string;
    image?: string;
    product_image?: string;
    variants?: LightningVariant[];
}

interface LightningVariant {
    id?: number;
    variant_id?: number;
    title?: string;
    selling_price?: number;
    min_discount_percent?: number;
    max_discount_percent?: number;
}

interface LightningBid {
    id?: number;
    bid_id?: number;
    product_id?: number;
    variant_id?: number;
    product_title?: string;
    variant_title?: string;
    product_image?: string;
    discount_percent?: number;
    selling_price?: number;
    status?: string;
    promotion_title?: string;
    start_at?: string;
    end_at?: string;
    payment_method?: string;
}

const BID_STATUS: Record<string, { label: string; color: "default" | "primary" | "success" | "warning" | "error" }> = {
    pending: { label: "در انتظار", color: "warning" },
    approved: { label: "تایید شده", color: "success" },
    rejected: { label: "رد شده", color: "error" },
    active: { label: "فعال", color: "success" },
    ended: { label: "پایان", color: "default" },
};

// ─── Create Bid Dialog ────────────────────────────────────────────────────────

function CreateBidDialog({
    open,
    onClose,
    vendorId,
    onCreated,
}: {
    open: boolean;
    onClose: () => void;
    vendorId: string;
    onCreated: () => void;
}) {
    const [products, setProducts] = useState<LightningProduct[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<LightningProduct | null>(null);
    const [variants, setVariants] = useState<LightningVariant[]>([]);
    const [selectedVariantId, setSelectedVariantId] = useState<number | "">("");
    const [discountPct, setDiscountPct] = useState<number>(10);
    const [loadingVariants, setLoadingVariants] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!open) return;
        setProducts([]);
        setSelectedProduct(null);
        setVariants([]);
        setSelectedVariantId("");
        setLoadingProducts(true);
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        callProxy(vendorId, "GET", "lightening-deal/products", undefined, ctrl.signal)
            .then((json) => {
                const d = json?.data?.data ?? json?.data ?? {};
                setProducts(d?.items ?? (Array.isArray(d) ? d : []));
            })
            .catch((err) => { if (err.name !== "AbortError") toast.error(`خطا: ${err.message}`); })
            .finally(() => setLoadingProducts(false));
        return () => ctrl.abort();
    }, [open, vendorId]);

    function handleSelectProduct(prod: LightningProduct) {
        setSelectedProduct(prod);
        setSelectedVariantId("");
        const pid = prod.product_id ?? prod.id;
        if (!pid) { setVariants(prod.variants ?? []); return; }
        setLoadingVariants(true);
        callProxy(vendorId, "GET", `lightening-deal/products/${pid}`)
            .then((json) => {
                const d = json?.data?.data ?? json?.data ?? {};
                setVariants(d?.variants ?? d?.items ?? prod.variants ?? []);
            })
            .catch(() => setVariants(prod.variants ?? []))
            .finally(() => setLoadingVariants(false));
    }

    function handleSubmit() {
        const vid = selectedVariantId;
        if (!vid) { toast.error("واریانت را انتخاب کنید"); return; }
        setSubmitting(true);
        callProxy(vendorId, "POST", "lightening-deal/bids", {
            variant_id: vid,
            discount_percent: discountPct,
        })
            .then(() => { toast.success("پیشنهاد معامله برق‌آسا ثبت شد"); onCreated(); onClose(); })
            .catch((err) => toast.error(`خطا: ${err.message}`))
            .finally(() => setSubmitting(false));
    }

    const selectedVariant = variants.find((v) => (v.variant_id ?? v.id) === selectedVariantId);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ position: "relative", pr: 6 }}>
                ثبت پیشنهاد معامله برق‌آسا
                <DialogCloseButton onClose={onClose} />
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    {/* Product selection */}
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                            انتخاب محصول
                        </Typography>
                        {loadingProducts
                            ? <Stack spacing={1}>{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={52} />)}</Stack>
                            : products.length === 0
                                ? <Typography variant="body2" color="text.secondary">محصول واجد شرایطی یافت نشد</Typography>
                                : (
                                    <Stack spacing={0.5} sx={{ maxHeight: 200, overflowY: "auto" }}>
                                        {products.map((p) => {
                                            const pid = p.product_id ?? p.id;
                                            const isSelected = selectedProduct && (selectedProduct.product_id ?? selectedProduct.id) === pid;
                                            return (
                                                <Stack
                                                    key={pid}
                                                    direction="row"
                                                    alignItems="center"
                                                    gap={1.5}
                                                    onClick={() => handleSelectProduct(p)}
                                                    sx={{
                                                        p: 1, borderRadius: 1, border: 1, cursor: "pointer",
                                                        borderColor: isSelected ? "primary.main" : "divider",
                                                        bgcolor: isSelected ? "primary.50" : "transparent",
                                                    }}
                                                >
                                                    {(p.image ?? p.product_image) && (
                                                        <Box component="img" src={p.image ?? p.product_image} width={36} height={36} sx={{ borderRadius: 0.5, flexShrink: 0 }} />
                                                    )}
                                                    <Typography variant="body2">{p.product_title ?? p.title}</Typography>
                                                </Stack>
                                            );
                                        })}
                                    </Stack>
                                )
                        }
                    </Box>

                    {/* Variant selection */}
                    {selectedProduct && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>واریانت</Typography>
                            {loadingVariants
                                ? <CircularProgress size={20} />
                                : (
                                    <Select
                                        size="small"
                                        fullWidth
                                        value={selectedVariantId}
                                        onChange={(e) => setSelectedVariantId(Number(e.target.value))}
                                        displayEmpty
                                    >
                                        <MenuItem value="" disabled>واریانت را انتخاب کنید</MenuItem>
                                        {variants.map((v) => {
                                            const vid = v.variant_id ?? v.id ?? 0;
                                            return (
                                                <MenuItem key={vid} value={vid}>
                                                    {v.title ?? `واریانت #${vid}`}
                                                    {v.selling_price ? ` · ${toman(v.selling_price)} تومان` : ""}
                                                    {v.min_discount_percent ? ` (min ${v.min_discount_percent}%)` : ""}
                                                </MenuItem>
                                            );
                                        })}
                                    </Select>
                                )
                            }
                        </Box>
                    )}

                    {/* Discount */}
                    {selectedVariantId && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                                درصد تخفیف
                                {selectedVariant?.min_discount_percent ? ` (حداقل ${selectedVariant.min_discount_percent}%)` : ""}
                                {selectedVariant?.max_discount_percent ? ` (حداکثر ${selectedVariant.max_discount_percent}%)` : ""}
                            </Typography>
                            <TextField
                                size="small"
                                type="number"
                                value={discountPct}
                                onChange={(e) => setDiscountPct(Math.max(1, Math.min(90, Number(e.target.value))))}
                                slotProps={{
                                    htmlInput: {
                                        min: selectedVariant?.min_discount_percent ?? 1,
                                        max: selectedVariant?.max_discount_percent ?? 90,
                                        step: 1,
                                    }
                                }}
                                sx={{ width: 120 }}
                            />
                        </Box>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={submitting}>بازگشت</Button>
                <Button
                    variant="contained"
                    disabled={!selectedVariantId || submitting}
                    onClick={handleSubmit}
                    startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <BoltRoundedIcon />}
                >
                    ثبت پیشنهاد
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Bids Tab ────────────────────────────────────────────────────────────────

function BidsTab({ vendorId }: { vendorId: string }) {
    const [bids, setBids] = useState<LightningBid[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    function load() {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        setError(null);
        callProxy(vendorId, "GET", "lightening-deal/bids", undefined, ctrl.signal)
            .then((json) => {
                const d = json?.data?.data ?? json?.data ?? {};
                setBids(d?.items ?? d?.bids ?? (Array.isArray(d) ? d : []));
            })
            .catch((err) => { if (err.name !== "AbortError") { setError(err.message); toast.error(`خطا: ${err.message}`); } })
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); return () => abortRef.current?.abort(); }, [vendorId]);

    return (
        <Box>
            {loading && <LinearProgress sx={{ mb: 1 }} />}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">{bids.length} پیشنهاد</Typography>
                <Stack direction="row" gap={1}>
                    <RefreshButton disabled={loading} onClick={load} />
                    <Button size="small" variant="contained" color="warning" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}>
                        پیشنهاد جدید
                    </Button>
                </Stack>
            </Stack>

            {error && (
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                    <Button variant="outlined" color="error" size="small" onClick={load}>تلاش دوباره</Button>
                </Stack>
            )}

            <Stack spacing={1.5}>
                {loading && bids.length === 0
                    ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={72} sx={{ borderRadius: 2 }} />)
                    : bids.map((bid, i) => {
                        const st = BID_STATUS[bid.status ?? ""] ?? { label: bid.status ?? "—", color: "default" as const };
                        return (
                            <Stack key={bid.id ?? bid.bid_id ?? i} direction="row" alignItems="center" gap={1.5}
                                sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
                                {bid.product_image && (
                                    <Box component="img" src={bid.product_image} width={44} height={44} sx={{ borderRadius: 0.5, flexShrink: 0 }} />
                                )}
                                <Stack flex={1} spacing={0.3}>
                                    <Typography variant="body2" fontWeight={600}>{bid.product_title ?? bid.variant_title}</Typography>
                                    <Stack direction="row" gap={1} flexWrap="wrap">
                                        <Chip size="small" label={st.label} color={st.color} />
                                        {bid.discount_percent && (
                                            <Chip size="small" label={`${bid.discount_percent}% تخفیف`} color="warning" />
                                        )}
                                        {bid.selling_price && (
                                            <Typography variant="caption" color="text.secondary">{toman(bid.selling_price)} تومان</Typography>
                                        )}
                                        {bid.promotion_title && (
                                            <Typography variant="caption" color="text.secondary">{bid.promotion_title}</Typography>
                                        )}
                                    </Stack>
                                </Stack>
                            </Stack>
                        );
                    })
                }
                {!loading && bids.length === 0 && !error && (
                    <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}>
                        <BoltRoundedIcon sx={{ fontSize: 48, color: "text.disabled" }} />
                        <Typography variant="subtitle2" color="text.secondary">هیچ پیشنهادی ثبت نشده</Typography>
                        <Button variant="contained" color="warning" onClick={() => setCreateOpen(true)} startIcon={<AddRoundedIcon />}>
                            اولین پیشنهاد را ثبت کنید
                        </Button>
                    </Stack>
                )}
            </Stack>

            <CreateBidDialog open={createOpen} onClose={() => setCreateOpen(false)} vendorId={vendorId} onCreated={load} />
        </Box>
    );
}

// ─── Summary Tab ─────────────────────────────────────────────────────────────

function SummaryTab({ vendorId }: { vendorId: string }) {
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
        callProxy(vendorId, "GET", "lightening-deal/bidsSummary", undefined, ctrl.signal)
            .then((json) => {
                const d = json?.data?.data ?? json?.data ?? {};
                setData(typeof d === "object" ? d as Record<string, unknown> : null);
            })
            .catch((err) => { if (err.name !== "AbortError") setError(err.message); })
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); return () => abortRef.current?.abort(); }, [vendorId]);

    if (loading && !data) return <Stack spacing={1}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={44} />)}</Stack>;
    if (error) return <Typography variant="body2" color="error">{error}</Typography>;
    if (!data) return <Typography variant="body2" color="text.secondary">داده‌ای یافت نشد</Typography>;

    return (
        <Stack spacing={1}>
            {Object.entries(data).map(([k, v]) => {
                if (v == null || typeof v === "object") return null;
                return (
                    <Stack key={k} direction="row" alignItems="center" justifyContent="space-between"
                        sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
                        <Typography variant="body2" color="text.secondary">{k}</Typography>
                        <Chip size="small" label={String(v)} color="warning" variant="outlined" />
                    </Stack>
                );
            })}
        </Stack>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LightningDealSpec({ vendorId }: { vendorId: string }) {
    const [tab, setTab] = useState<"bids" | "summary">("bids");

    return (
        <Container maxWidth={false} sx={{ my: 4, px: { xs: 1, md: 3 } }}>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
                <BoltRoundedIcon color="warning" />
                <Typography variant="h6" fontWeight={800}>معامله برق‌آسا (Lightning Deal)</Typography>
            </Stack>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
                <Tab value="bids" label="پیشنهادهای من" />
                <Tab value="summary" label="خلاصه" />
            </Tabs>

            {tab === "bids" && <BidsTab vendorId={vendorId} />}
            {tab === "summary" && <SummaryTab vendorId={vendorId} />}
        </Container>
    );
}
