"use client";

import { RefreshButton } from "@/components/refresh";
import {
    Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent,
    DialogTitle, IconButton, LinearProgress, Pagination, Skeleton, Stack,
    Tab, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";
import { PageJumper } from "@/components/search/pagination";

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

interface SmartDiscountVariant {
    id?: number;
    variant_id?: number;
    product_id?: number;
    title?: string;
    product_title?: string;
    product_image?: string;
    selling_price?: number;
    discount_percent?: number;
    smart_discount_percent?: number;
    status?: string;
    active?: boolean;
}

interface EligibleVariant {
    id?: number;
    variant_id?: number;
    title?: string;
    product_title?: string;
    product_image?: string;
    selling_price?: number;
    min_discount_percent?: number;
    max_discount_percent?: number;
    current_discount_percent?: number;
}

// ─── Create Smart Discount Dialog ────────────────────────────────────────────

function CreateSmartDiscountDialog({
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
    const [eligible, setEligible] = useState<EligibleVariant[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Map<number, number>>(new Map()); // variant_id -> discount_percent
    const [submitting, setSubmitting] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!open) return;
        setEligible([]);
        setSelected(new Map());
        setLoading(true);
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        callProxy(vendorId, "GET", "pricing/smart-discount/variants/eligible?page=1&size=100", undefined, ctrl.signal)
            .then((json) => {
                const d = json?.data?.data ?? json?.data ?? {};
                const rawItems: Record<string, unknown>[] = d?.items ?? (Array.isArray(d) ? d : []);
                // Map DGK field names to EligibleVariant interface
                const mapped: EligibleVariant[] = rawItems.map((it) => ({
                    id: Number(it.product_variant_id ?? it.id ?? 0),
                    variant_id: Number(it.product_variant_id ?? it.id ?? 0),
                    title: String(it.product_variant_title ?? it.title ?? ""),
                    product_title: String(it.product_variant_title ?? it.title ?? ""),
                    product_image: String(it.image_link ?? it.image ?? ""),
                    selling_price: Number(it.selling_price ?? 0),
                    min_discount_percent: Number(it.min_incredible_discount ?? it.min_category_discount ?? 0),
                    max_discount_percent: Number(it.max_allowable_price ?? 0) > 0 ? 90 : 90,
                    current_discount_percent: Number(it.cash_discount ?? 0),
                }));
                setEligible(mapped);
            })
            .catch((err) => { if (err.name !== "AbortError") toast.error(`خطا: ${err.message}`); })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, [open, vendorId]);

    function toggleSelect(variantId: number, defaultPct: number) {
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(variantId)) next.delete(variantId);
            else next.set(variantId, defaultPct || 10);
            return next;
        });
    }

    function handleCreate() {
        if (selected.size === 0) return;
        setSubmitting(true);
        const variants = Array.from(selected.entries()).map(([variant_id, pct]) => ({
            variant_id,
            discount_percent: pct,
        }));
        // DGK expects { data: [...] } not { variants: [...] }
        callProxy(vendorId, "POST", "pricing/smart-discount/variants/batch", { data: variants })
            .then(() => { toast.success("تخفیف هوشمند ایجاد شد"); onCreated(); onClose(); })
            .catch((err) => toast.error(`خطا: ${err.message}`))
            .finally(() => setSubmitting(false));
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ position: "relative", pr: 6 }}>
                ایجاد تخفیف هوشمند
                <DialogCloseButton onClose={onClose} />
            </DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Stack spacing={1}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={60} />)}</Stack>
                ) : eligible.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>واریانت واجد شرایطی یافت نشد</Typography>
                ) : (
                    <Stack spacing={1}>
                        {eligible.map((v) => {
                            const vid = v.variant_id ?? v.id ?? 0;
                            const isSelected = selected.has(vid);
                            return (
                                <Stack
                                    key={vid}
                                    direction="row"
                                    alignItems="center"
                                    gap={1.5}
                                    sx={{
                                        p: 1, borderRadius: 1, border: 1,
                                        borderColor: isSelected ? "secondary.main" : "divider",
                                        bgcolor: isSelected ? "secondary.50" : "transparent",
                                    }}
                                >
                                    <Box
                                        sx={{ cursor: "pointer", display: "flex", flex: 1, gap: 1.5, alignItems: "center" }}
                                        onClick={() => toggleSelect(vid, v.min_discount_percent ?? 10)}
                                    >
                                        {v.product_image && (
                                            <Box component="img" src={v.product_image} width={40} height={40} sx={{ borderRadius: 0.5, flexShrink: 0 }} />
                                        )}
                                        <Stack flex={1} spacing={0.2}>
                                            <Typography variant="body2" fontWeight={600}>{v.product_title ?? v.title}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {v.selling_price ? `${toman(v.selling_price)} تومان ` : ""}
                                                {v.min_discount_percent ? `· حداقل ${v.min_discount_percent}%` : ""}
                                                {v.max_discount_percent ? ` - حداکثر ${v.max_discount_percent}%` : ""}
                                            </Typography>
                                        </Stack>
                                    </Box>
                                    {isSelected && (
                                        <TextField
                                            size="small"
                                            label="درصد"
                                            type="number"
                                            value={selected.get(vid) ?? ""}
                                            onChange={(e) => {
                                                const pct = Math.max(1, Math.min(90, Number(e.target.value)));
                                                setSelected((prev) => new Map(prev).set(vid, pct));
                                            }}
                                            slotProps={{ htmlInput: { min: 1, max: 90, step: 1 } }}
                                            sx={{ width: 80 }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    )}
                                    <Chip
                                        size="small"
                                        label={isSelected ? "انتخاب شده" : "انتخاب"}
                                        color={isSelected ? "secondary" : "default"}
                                        variant={isSelected ? "filled" : "outlined"}
                                        onClick={() => toggleSelect(vid, v.min_discount_percent ?? 10)}
                                    />
                                </Stack>
                            );
                        })}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={submitting}>بازگشت</Button>
                <Button
                    variant="contained"
                    disabled={selected.size === 0 || submitting}
                    onClick={handleCreate}
                    startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <AddRoundedIcon />}
                >
                    ایجاد ({selected.size})
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Smart Discounts Tab ─────────────────────────────────────────────────────

function SmartDiscountsTab({ vendorId }: { vendorId: string }) {
    const [items, setItems] = useState<SmartDiscountVariant[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    function load() {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        setError(null);
        callProxy(vendorId, "GET", `pricing/smart-discount/variants/active?page=${page}&size=30`, undefined, ctrl.signal)
            .then((json) => {
                const data = json?.data?.data ?? json?.data ?? {};
                const rawItems: Record<string, unknown>[] = data?.items ?? (Array.isArray(data) ? data : []);
                // Map DGK field names to SmartDiscountVariant interface
                const mapped: SmartDiscountVariant[] = rawItems.map((it) => ({
                    id: Number(it.promotion_variant_id ?? it.id ?? 0),
                    variant_id: Number(it.variant_id ?? 0),
                    product_id: Number(it.product_id ?? 0),
                    title: String(it.title ?? ""),
                    product_title: String(it.title ?? ""),
                    product_image: String(it.image_link ?? ""),
                    selling_price: Number(it.selling_price ?? 0),
                    discount_percent: Number(it.discount ?? 0),
                    smart_discount_percent: Number(it.discount ?? 0),
                    status: String(it.promotion_status ?? "active"),
                    active: true,
                }));
                setItems(mapped);
                setTotalPages(Math.max(1, data?.pager?.total_pages ?? 1));
            })
            .catch((err) => { if (err.name !== "AbortError") { setError(err.message); } })
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); return () => abortRef.current?.abort(); }, [page, vendorId]);

    function handleDelete(variantId: number) {
        if (!confirm("از حذف این تخفیف هوشمند اطمینان دارید؟")) return;
        setDeleting(variantId);
        // DGK DELETE expects { ids: [...] } not { variant_ids: [...] }
        callProxy(vendorId, "DELETE", "pricing/smart-discount/variants", { ids: [variantId] })
            .then(() => { toast.success("تخفیف هوشمند حذف شد"); setItems((prev) => prev.filter((v) => (v.variant_id ?? v.id) !== variantId)); })
            .catch((err) => toast.error(`خطا: ${err.message}`))
            .finally(() => setDeleting(null));
    }

    return (
        <Box>
            {loading && <LinearProgress sx={{ mb: 1 }} />}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">{items.length} تخفیف هوشمند فعال</Typography>
                <Stack direction="row" gap={1}>
                    <RefreshButton disabled={loading} onClick={load} />
                    <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}>
                        تخفیف جدید
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
                {loading && items.length === 0
                    ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={64} sx={{ borderRadius: 2 }} />)
                    : items.map((v) => {
                        const vid = v.variant_id ?? v.id ?? 0;
                        return (
                            <Stack key={vid} direction="row" alignItems="center" gap={1.5}
                                sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2 }}>
                                {v.product_image && (
                                    <Box component="img" src={v.product_image} width={44} height={44} sx={{ borderRadius: 0.5, flexShrink: 0 }} />
                                )}
                                <Stack flex={1} spacing={0.3}>
                                    <Typography variant="body2" fontWeight={600}>{v.product_title ?? v.title}</Typography>
                                    <Stack direction="row" gap={1} flexWrap="wrap">
                                        {v.selling_price && (
                                            <Typography variant="caption" color="text.secondary">{toman(v.selling_price)} تومان</Typography>
                                        )}
                                        {(v.smart_discount_percent ?? v.discount_percent) && (
                                            <Chip size="small" label={`${v.smart_discount_percent ?? v.discount_percent}% تخفیف هوشمند`} color="secondary" />
                                        )}
                                        {v.status && (
                                            <Chip size="small" label={v.status} variant="outlined" />
                                        )}
                                    </Stack>
                                </Stack>
                                <Tooltip title="حذف تخفیف هوشمند">
                                    <span>
                                        <IconButton
                                            size="small"
                                            color="error"
                                            disabled={deleting === vid}
                                            onClick={() => handleDelete(vid)}
                                        >
                                            {deleting === vid ? <CircularProgress size={16} /> : <DeleteRoundedIcon fontSize="small" />}
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Stack>
                        );
                    })}
                {!loading && items.length === 0 && !error && (
                    <Stack alignItems="center" spacing={1} sx={{ py: 6 }}>
                        <Typography variant="subtitle2" color="text.secondary">تخفیف هوشمند فعالی یافت نشد</Typography>
                        <Button variant="outlined" onClick={() => setCreateOpen(true)} startIcon={<AddRoundedIcon />}>
                            ایجاد تخفیف هوشمند
                        </Button>
                    </Stack>
                )}
            </Stack>

            {totalPages > 1 && (
                <Stack alignItems="center" sx={{ mt: 3 }}>
                    <Pagination page={page} count={totalPages} onChange={(_, n) => setPage(n)} />
                    <PageJumper pages={totalPages} onJump={setPage} />
                </Stack>
            )}

            <CreateSmartDiscountDialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                vendorId={vendorId}
                onCreated={load}
            />
        </Box>
    );
}

// ─── Price Suggestion Tab ────────────────────────────────────────────────────

interface PriceSuggestion {
    variant_id?: number;
    title?: string;
    product_title?: string;
    product_image?: string;
    selling_price?: number;
    winning_price?: number;
    suggested_price?: number;
    rank?: number;
    has_buybox?: boolean;
}

function PriceSuggestionTab({ vendorId }: { vendorId: string }) {
    const [items, setItems] = useState<PriceSuggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const abortRef = useRef<AbortController | null>(null);

    function load() {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        setError(null);
        // Use buy-box data from variants list (includes is_buy_box_winner, buy_box_price)
        callProxy(vendorId, "GET", `variants?page=${page}&size=30`, undefined, ctrl.signal)
            .then((json) => {
                const data = json?.data?.data ?? json?.data ?? {};
                const rawItems: Record<string, unknown>[] = data?.items ?? (Array.isArray(data) ? data : []);
                const mapped: PriceSuggestion[] = rawItems.map((it) => ({
                    variant_id: Number(it.product_variant_id ?? it.id ?? 0),
                    title: String(it.title ?? it.product_title ?? ""),
                    product_title: String(it.product_title ?? ""),
                    product_image: String(it.image_src ?? ""),
                    selling_price: Number(it.price_sale ?? it.cash_selling_price ?? 0),
                    winning_price: Number(it.buy_box_price ?? 0),
                    suggested_price: Number(it.buy_box_price ?? 0),
                    has_buybox: Boolean(it.is_buy_box_winner || it.is_seller_buy_box_winner),
                }));
                setItems(mapped);
                setTotalPages(Math.max(1, data?.pager?.total_pages ?? 1));
            })
            .catch((err) => { if (err.name !== "AbortError") { setError(err.message); toast.error(`خطا: ${err.message}`); } })
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); return () => abortRef.current?.abort(); }, [page, vendorId]);

    return (
        <Box>
            {loading && <LinearProgress sx={{ mb: 1 }} />}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">پیشنهاد قیمت بای‌باکس</Typography>
                <RefreshButton disabled={loading} onClick={load} />
            </Stack>

            {error && (
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                    <Button variant="outlined" color="error" size="small" onClick={load}>تلاش دوباره</Button>
                </Stack>
            )}

            <Stack spacing={1.5}>
                {loading && items.length === 0
                    ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={72} sx={{ borderRadius: 2 }} />)
                    : items.map((v, i) => (
                        <Stack key={v.variant_id ?? i} direction="row" alignItems="center" gap={1.5}
                            sx={{ p: 1.5, border: 1, borderColor: v.has_buybox ? "success.light" : "divider", borderRadius: 2 }}>
                            {v.product_image && (
                                <Box component="img" src={v.product_image} width={44} height={44} sx={{ borderRadius: 0.5, flexShrink: 0 }} />
                            )}
                            <Stack flex={1} spacing={0.3}>
                                <Typography variant="body2" fontWeight={600}>{v.product_title ?? v.title}</Typography>
                                <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
                                    {v.selling_price != null && (
                                        <Typography variant="caption" color="text.secondary">
                                            قیمت شما: {toman(v.selling_price)} تومان
                                        </Typography>
                                    )}
                                    {v.winning_price != null && (
                                        <Chip size="small" label={`بای‌باکس: ${toman(v.winning_price)} تومان`} color="primary" variant="outlined" />
                                    )}
                                    {v.suggested_price != null && (
                                        <Chip size="small" label={`پیشنهاد: ${toman(v.suggested_price)} تومان`} color="secondary" />
                                    )}
                                    {v.has_buybox && <Chip size="small" label="دارنده بای‌باکس" color="success" />}
                                    {v.rank != null && (
                                        <Typography variant="caption" color="text.secondary">رتبه: {v.rank}</Typography>
                                    )}
                                </Stack>
                            </Stack>
                        </Stack>
                    ))}
                {!loading && items.length === 0 && !error && (
                    <Stack alignItems="center" sx={{ py: 6 }}>
                        <Typography variant="subtitle2" color="text.secondary">داده‌ای یافت نشد</Typography>
                    </Stack>
                )}
            </Stack>

            {totalPages > 1 && (
                <Stack alignItems="center" sx={{ mt: 3 }}>
                    <Pagination page={page} count={totalPages} onChange={(_, n) => setPage(n)} />
                    <PageJumper pages={totalPages} onJump={setPage} />
                </Stack>
            )}
        </Box>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PricingSpec({ vendorId }: { vendorId: string }) {
    const [tab, setTab] = useState<"smart" | "buybox">("smart");

    return (
        <Container maxWidth={false} sx={{ my: 4, px: { xs: 1, md: 3 } }}>
            <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 2 }}>
                <TrendingUpRoundedIcon color="primary" />
                <Typography variant="h6" fontWeight={800}>قیمت‌گذاری و تخفیف هوشمند</Typography>
            </Stack>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
                <Tab value="smart" label="تخفیف هوشمند" />
                <Tab value="buybox" label="پیشنهاد قیمت بای‌باکس" />
            </Tabs>

            {tab === "smart" && <SmartDiscountsTab vendorId={vendorId} />}
            {tab === "buybox" && <PriceSuggestionTab vendorId={vendorId} />}
        </Container>
    );
}
