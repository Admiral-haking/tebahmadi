"use client";

import { RefreshButton } from "@/components/refresh";
import {
    Box, Button, Checkbox, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, FormControlLabel, IconButton, LinearProgress, Menu, MenuItem, Pagination,
    Skeleton, Stack, Tab, Tabs, Tooltip, Typography,
} from "@mui/material";
import LocalOfferRoundedIcon from "@mui/icons-material/LocalOfferRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";
import { PageJumper } from "@/components/search/pagination";

function formatDate(iso: string) {
    try {
        return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "short", day: "numeric" }).format(new Date(iso));
    } catch { return iso; }
}

function toman(rial: number) {
    return Math.round(rial / 10).toLocaleString("fa-IR");
}

interface Promotion {
    id: number;
    title?: string;
    name?: string;
    start_at?: string;
    end_at?: string;
    status?: string;
    type?: string;
    discount_percent?: number;
    joined_variants_count?: number;
}

interface PromotionVariant {
    id: number;
    promotion_id?: number;
    variant_id?: number;
    variant_title?: string;
    product_title?: string;
    product_image?: string;
    price?: number;
    selling_price?: number;
    discount_percent?: number;
    status?: string;
    created_at?: string;
}

interface EligibleVariant {
    id: number;
    title?: string;
    product_title?: string;
    product_image?: string;
    price?: number;
    selling_price?: number;
    discount_percent?: number;
}

const STATUS_LABELS: Record<string, { label: string; color: "default" | "primary" | "success" | "warning" | "error" }> = {
    active: { label: "فعال", color: "success" },
    inactive: { label: "غیرفعال", color: "default" },
    pending: { label: "در انتظار", color: "warning" },
    rejected: { label: "رد شده", color: "error" },
    approved: { label: "تایید شده", color: "success" },
    ended: { label: "پایان یافته", color: "default" },
};

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

// ─── Join Variants Dialog ────────────────────────────────────────────────────

function JoinVariantsDialog({
    open,
    onClose,
    vendorId,
    promotion,
    onJoined,
}: {
    open: boolean;
    onClose: () => void;
    vendorId: string;
    promotion: Promotion | null;
    onJoined: () => void;
}) {
    const [eligible, setEligible] = useState<EligibleVariant[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [submitting, setSubmitting] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!open || !promotion) return;
        setEligible([]);
        setSelected(new Set());
        setLoading(true);
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        // Eligible variants that can be joined to this promotion. The correct DGK
        // path is `.../variants/eligible` (the previous `/eligible-variants` 404'd
        // every time, so the list was always empty).
        callProxy(vendorId, "GET", `pricing/promotions/${promotion.id}/variants/eligible?page=1&size=100`, undefined, ctrl.signal)
            .then((json) => {
                const d = json?.data?.data ?? json?.data ?? {};
                const rawItems = d?.items ?? (Array.isArray(d) ? d : []);
                // Map DGK field names to our interface
                const mapped: EligibleVariant[] = (rawItems as Record<string, unknown>[]).map((it) => ({
                    id: Number(it.product_variant_id ?? it.id ?? 0),
                    title: String(it.product_variant_title ?? it.title ?? ""),
                    product_title: String(it.product_variant_title ?? it.title ?? ""),
                    product_image: String(it.image_link ?? it.image ?? ""),
                    price: Number(it.selling_price ?? 0),
                    selling_price: Number(it.selling_price ?? 0),
                    discount_percent: Number(it.min_incredible_discount ?? it.min_category_discount ?? 0),
                }));
                setEligible(mapped);
            })
            .catch((err) => {
                if (err.name !== "AbortError") {
                    // 404 means endpoint not available for this promotion — show empty gracefully
                    setEligible([]);
                }
            })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, [open, promotion, vendorId]);

    function toggle(id: number) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    function handleJoin() {
        if (!promotion || selected.size === 0) return;
        setSubmitting(true);
        // DGK expects { data: [{ variant_id, promotion_price, order_limit, price_limit }] }.
        // Default the promotion price to the minimum required discount off the
        // current selling price (a valid, conservative offer the seller can refine).
        const data = Array.from(selected).map((variant_id) => {
            const v = eligible.find((e) => e.id === variant_id);
            const sell = Math.max(0, Number(v?.selling_price) || 0);
            const disc = Math.max(0, Number(v?.discount_percent) || 0);
            const promotion_price = disc > 0 ? Math.floor((sell * (100 - disc)) / 100) : sell;
            return { variant_id, promotion_price, order_limit: 1, price_limit: 1 };
        });
        callProxy(vendorId, "POST", `pricing/promotions/${promotion.id}/variants`, { data })
            .then(() => { toast.success("واریانت‌ها به کمپین اضافه شدند"); onJoined(); onClose(); })
            .catch((err) => toast.error(`خطا: ${err.message}`))
            .finally(() => setSubmitting(false));
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ position: "relative", pr: 6 }}>
                افزودن واریانت به کمپین: {promotion?.title ?? promotion?.name}
                <DialogCloseButton onClose={onClose} />
            </DialogTitle>
            <DialogContent dividers>
                {loading ? (
                    <Stack spacing={1}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={56} />)}</Stack>
                ) : eligible.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>واریانت واجد شرایطی یافت نشد</Typography>
                ) : (
                    <Stack spacing={1}>
                        {eligible.map((v) => (
                            <Stack
                                key={v.id}
                                direction="row"
                                alignItems="center"
                                gap={1.5}
                                sx={{
                                    p: 1, borderRadius: 1, border: 1,
                                    borderColor: selected.has(v.id) ? "primary.main" : "divider",
                                    bgcolor: selected.has(v.id) ? "primary.50" : "transparent",
                                    cursor: "pointer",
                                }}
                                onClick={() => toggle(v.id)}
                            >
                                {v.product_image && (
                                    <Box component="img" src={v.product_image} width={40} height={40} sx={{ borderRadius: 0.5, flexShrink: 0 }} />
                                )}
                                <Stack flex={1} spacing={0.2}>
                                    <Typography variant="body2" fontWeight={600}>{v.product_title ?? v.title}</Typography>
                                    {v.selling_price && (
                                        <Typography variant="caption" color="text.secondary">
                                            قیمت: {toman(v.selling_price)} تومان
                                            {v.discount_percent ? ` · ${v.discount_percent}% تخفیف` : ""}
                                        </Typography>
                                    )}
                                </Stack>
                                <Chip
                                    size="small"
                                    label={selected.has(v.id) ? "انتخاب شده" : "انتخاب"}
                                    color={selected.has(v.id) ? "primary" : "default"}
                                    variant={selected.has(v.id) ? "filled" : "outlined"}
                                />
                            </Stack>
                        ))}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={submitting}>بازگشت</Button>
                <Button
                    variant="contained"
                    disabled={selected.size === 0 || submitting}
                    onClick={handleJoin}
                    startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <AddRoundedIcon />}
                >
                    افزودن {selected.size > 0 ? `(${selected.size})` : ""}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Promotion Variants Panel ───────────────────────────────────────────────

function PromotionVariants({
    vendorId,
    promotion,
}: {
    vendorId: string;
    promotion: Promotion;
}) {
    const [items, setItems] = useState<PromotionVariant[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [joinOpen, setJoinOpen] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    function load() {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        setError(null);
        callProxy(vendorId, "GET", `pricing/promotions/${promotion.id}/variants?page=1&size=100`, undefined, ctrl.signal)
            .then((json) => {
                const d = json?.data?.data ?? json?.data ?? {};
                const rawItems: Record<string, unknown>[] = d?.items ?? (Array.isArray(d) ? d : []);
                // Map DGK field names to our PromotionVariant interface
                const mapped: PromotionVariant[] = rawItems.map((it) => ({
                    // `id` holds the promotion_variant_id (used for delete).
                    id: Number(it.promotion_variant_id ?? it.id ?? 0),
                    variant_id: Number(it.product_variant_id ?? it.id ?? 0),
                    variant_title: String(it.title ?? ""),
                    product_title: String(it.title ?? ""),
                    product_image: String(it.image ?? ""),
                    selling_price: Number(it.selling_price ?? 0),
                    discount_percent: Number(it.discount ?? 0),
                    status: String(it.status ?? ""),
                    created_at: String(it.created_at ?? ""),
                }));
                setItems(mapped);
            })
            .catch((err) => {
                if (err.name === "AbortError") return;
                setError(err.message);
            })
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); return () => abortRef.current?.abort(); }, [promotion.id, vendorId]);

    function handleDelete(variantId: number) {
        if (!confirm("از حذف این واریانت از کمپین اطمینان دارید؟")) return;
        // DGK expects { ids: [...] } not { variant_ids: [...] }
        callProxy(vendorId, "DELETE", `pricing/promotions/${promotion.id}/variants`, { ids: [variantId] })
            .then(() => { toast.success("واریانت از کمپین حذف شد"); setItems((prev) => prev.filter((v) => v.variant_id !== variantId && v.id !== variantId)); })
            .catch((err) => toast.error(`خطا: ${err.message}`));
    }

    const selectedCount = items.filter((v) => selected.has(v.id)).length;
    const allSelected = items.length > 0 && selectedCount === items.length;
    function toggleOne(id: number, checked: boolean) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    }
    useEffect(() => { setSelected(new Set()); }, [promotion.id]);

    function handleBulkDelete() {
        const ids = items.filter((v) => selected.has(v.id)).map((v) => v.id);
        if (!ids.length) return;
        if (!confirm(`حذف ${ids.length} واریانت از کمپین؟`)) return;
        setBulkBusy(true);
        // DGK accepts many ids in one call.
        callProxy(vendorId, "DELETE", `pricing/promotions/${promotion.id}/variants`, { ids })
            .then(() => {
                toast.success(`${ids.length.toLocaleString("fa-IR")} واریانت از کمپین حذف شد`);
                setItems((prev) => prev.filter((v) => !selected.has(v.id)));
                setSelected(new Set());
            })
            .catch((err) => toast.error(`خطا: ${err.message}`))
            .finally(() => setBulkBusy(false));
    }

    return (
        <Box>
            {loading && <LinearProgress sx={{ mb: 1 }} />}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }} flexWrap="wrap" gap={1}>
                <Stack direction="row" alignItems="center" gap={1}>
                    {items.length > 0 && (
                        <FormControlLabel
                            sx={{ m: 0 }}
                            control={
                                <Checkbox
                                    size="small"
                                    checked={allSelected}
                                    indeterminate={selectedCount > 0 && !allSelected}
                                    onChange={(e) => setSelected(e.target.checked ? new Set(items.map((v) => v.id)) : new Set())}
                                />
                            }
                            label={<Typography variant="caption">انتخاب همه</Typography>}
                        />
                    )}
                    <Typography variant="subtitle2" color="text.secondary">{items.length} واریانت در این کمپین</Typography>
                </Stack>
                <Stack direction="row" gap={1} flexWrap="wrap">
                    {selectedCount > 0 && (
                        <Button size="small" variant="contained" color="error" disabled={bulkBusy}
                            startIcon={bulkBusy ? <CircularProgress size={14} color="inherit" /> : <DeleteRoundedIcon />}
                            onClick={handleBulkDelete}>
                            حذف گروهی ({selectedCount.toLocaleString("fa-IR")})
                        </Button>
                    )}
                    <RefreshButton disabled={loading} onClick={load} />
                    <Button size="small" variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => setJoinOpen(true)}>
                        افزودن واریانت
                    </Button>
                </Stack>
            </Stack>
            {error && <Typography variant="body2" color="error">{error}</Typography>}
            <Stack spacing={1}>
                {items.map((v) => {
                    const st = STATUS_LABELS[v.status ?? ""] ?? { label: v.status ?? "—", color: "default" as const };
                    return (
                        <Stack key={v.id} direction="row" gap={1.5} alignItems="center"
                            sx={{ p: 1.5, border: 1, borderColor: selected.has(v.id) ? "primary.main" : "divider", borderRadius: 1.5 }}>
                            <Checkbox
                                size="small" sx={{ p: 0.5 }}
                                checked={selected.has(v.id)}
                                onChange={(e) => toggleOne(v.id, e.target.checked)}
                                inputProps={{ "aria-label": `انتخاب ${v.product_title ?? v.variant_title}` }}
                            />
                            {v.product_image && (
                                <Box component="img" src={v.product_image} width={40} height={40} sx={{ borderRadius: 0.5, flexShrink: 0 }} />
                            )}
                            <Stack flex={1} spacing={0.2}>
                                <Typography variant="body2" fontWeight={600}>{v.product_title ?? v.variant_title}</Typography>
                                <Stack direction="row" gap={1}>
                                    {v.selling_price && (
                                        <Typography variant="caption" color="text.secondary">
                                            {toman(v.selling_price)} تومان
                                        </Typography>
                                    )}
                                    {v.discount_percent && (
                                        <Chip size="small" label={`${v.discount_percent}% تخفیف`} color="primary" variant="outlined" />
                                    )}
                                    <Chip size="small" label={st.label} color={st.color} />
                                </Stack>
                            </Stack>
                            <Tooltip title="حذف از کمپین">
                                <IconButton size="small" color="error" onClick={() => handleDelete(v.id ?? v.variant_id)}>
                                    <DeleteRoundedIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Stack>
                    );
                })}
                {!loading && items.length === 0 && !error && (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                        هیچ واریانتی در این کمپین نیست
                    </Typography>
                )}
            </Stack>

            <JoinVariantsDialog
                open={joinOpen}
                onClose={() => setJoinOpen(false)}
                vendorId={vendorId}
                promotion={promotion}
                onJoined={load}
            />
        </Box>
    );
}

// ─── Promotion Row ──────────────────────────────────────────────────────────

function PromotionRow({
    promo,
    vendorId,
    expanded,
    onToggle,
}: {
    promo: Promotion;
    vendorId: string;
    expanded: boolean;
    onToggle: () => void;
}) {
    const st = STATUS_LABELS[promo.status ?? ""] ?? { label: promo.status ?? "—", color: "default" as const };

    return (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
            <Stack
                direction="row"
                gap={1.5}
                alignItems="center"
                sx={{ p: 1.5, cursor: "pointer", "&:hover": { bgcolor: "action.hover" } }}
                onClick={onToggle}
            >
                <Box component={LocalOfferRoundedIcon} sx={{ color: "primary.main", fontSize: 20, flexShrink: 0 }} />
                <Stack flex={1} spacing={0.3}>
                    <Typography variant="body2" fontWeight={700}>{promo.title ?? promo.name ?? `کمپین #${promo.id}`}</Typography>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                        <Chip size="small" label={st.label} color={st.color} />
                        {promo.type && <Chip size="small" label={promo.type} variant="outlined" />}
                        {promo.discount_percent && (
                            <Chip size="small" label={`${promo.discount_percent}% تخفیف`} color="secondary" variant="outlined" />
                        )}
                        {promo.start_at && (
                            <Typography variant="caption" color="text.secondary">
                                از {formatDate(promo.start_at)}
                                {promo.end_at ? ` تا ${formatDate(promo.end_at)}` : ""}
                            </Typography>
                        )}
                        {promo.joined_variants_count != null && (
                            <Typography variant="caption" color="text.secondary">
                                · {promo.joined_variants_count} واریانت
                            </Typography>
                        )}
                    </Stack>
                </Stack>
                <Typography variant="caption" color="primary">{expanded ? "بستن ▲" : "مشاهده واریانت‌ها ▼"}</Typography>
            </Stack>
            {expanded && (
                <>
                    <Divider />
                    <Box sx={{ p: 1.5, bgcolor: "action.hover" }}>
                        <PromotionVariants vendorId={vendorId} promotion={promo} />
                    </Box>
                </>
            )}
        </Box>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function PromotionsSpec({ vendorId }: { vendorId: string }) {
    const [tab, setTab] = useState<"active" | "eligible" | "unjoined">("active");
    const [items, setItems] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const ENDPOINTS: Record<typeof tab, string> = {
        active: "pricing/promotions",
        eligible: "pricing/promotions/eligible",
        unjoined: "pricing/promotions/unjoined",
    };

    function load() {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ page: String(page), size: "20" });
        callProxy(vendorId, "GET", `${ENDPOINTS[tab]}?${params}`, undefined, ctrl.signal)
            .then((json) => {
                const data = json?.data?.data ?? json?.data ?? {};
                setItems(data?.items ?? (Array.isArray(data) ? data : []));
                setTotalPages(Math.max(1, data?.pager?.total_pages ?? 1));
            })
            .catch((err) => { if (err.name !== "AbortError") { setError(err.message); toast.error(`خطا: ${err.message}`); } })
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); return () => abortRef.current?.abort(); }, [tab, page, vendorId]);

    const tabLabels: { key: typeof tab; label: string }[] = [
        { key: "active", label: "کمپین‌های فعال" },
        { key: "eligible", label: "واجد شرایط" },
        { key: "unjoined", label: "نپیوسته" },
    ];

    return (
        <Container maxWidth={false} sx={{ my: 4, px: { xs: 1, md: 3 } }}>
            {loading && <LinearProgress />}

            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1.5} sx={{ mb: 2 }}>
                <Stack>
                    <Typography variant="h6" fontWeight={800}>کمپین‌های تخفیفاتی دیجی‌کالا</Typography>
                    <Typography variant="caption" color="text.secondary">{items.length} مورد</Typography>
                </Stack>
                <RefreshButton disabled={loading} onClick={load} />
            </Stack>

            <Tabs value={tab} onChange={(_, v) => { setTab(v); setPage(1); setExpandedId(null); }} sx={{ mb: 2 }}>
                {tabLabels.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
            </Tabs>

            {error && (
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                    <Button variant="outlined" color="error" size="small" onClick={load}>تلاش دوباره</Button>
                </Stack>
            )}

            {loading && items.length === 0 ? (
                <Stack spacing={1.5}>
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={70} sx={{ borderRadius: 2 }} />)}
                </Stack>
            ) : (
                <Stack spacing={1.5}>
                    {items.map((promo) => (
                        <PromotionRow
                            key={promo.id}
                            promo={promo}
                            vendorId={vendorId}
                            expanded={expandedId === promo.id}
                            onToggle={() => setExpandedId((v) => v === promo.id ? null : promo.id)}
                        />
                    ))}
                    {!loading && items.length === 0 && (
                        <Stack alignItems="center" spacing={1} sx={{ py: 6 }}>
                            <Typography variant="subtitle2" color="text.secondary">کمپینی یافت نشد</Typography>
                        </Stack>
                    )}
                </Stack>
            )}

            {totalPages > 1 && (
                <Stack alignItems="center" sx={{ mt: 3 }}>
                    <Pagination
                        page={page}
                        count={totalPages}
                        onChange={(_, n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    />
                    <PageJumper pages={totalPages} onJump={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
                </Stack>
            )}
        </Container>
    );
}
