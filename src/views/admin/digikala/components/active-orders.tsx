import { IDgkOrderResponse } from "@/digikala/services/sync-active-orders";
import { RefreshButton } from "@/components/refresh";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import {
    Box, Button, Checkbox, Chip, CircularProgress, Container, Dialog, DialogActions,
    DialogContent, DialogTitle, Divider, LinearProgress, MenuItem,
    Pagination, Paper, Skeleton, Stack, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import CancelRoundedIcon from "@mui/icons-material/CancelRounded";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";
import { copyShippingText } from "@/orders/utils/shippingText";
import ListFilterBar from "@/components/admin/list-filter-bar";
import MarketplacePresence, { type LinePresence } from "@/views/admin/orders/components/MarketplacePresence";
import { PageJumper } from "@/components/search/pagination";
import ZoomableImage from "@/components/zoomable-image";

type OrderItem = IDgkOrderResponse["data"]["items"][number];

function formatDate(iso: string) {
    try {
        return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch { return iso; }
}

function commitmentColor(iso: string): "error" | "warning" | "success" | "default" {
    const diff = new Date(iso).getTime() - Date.now();
    const hours = diff / 3_600_000;
    if (hours < 0) return "error";
    if (hours < 24) return "warning";
    return "success";
}

export default function ActiveOrders({
    vendorId,
    onNavigateTo,
}: {
    vendorId: string;
    onNavigateTo?: (tab: number) => void;
}) {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<IDgkOrderResponse["data"]>();
    const [presence, setPresence] = useState<Record<string, LinePresence>>();
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const [facets, setFacets] = useState<Record<string, string[]>>({ flags: [] });
    const abortRef = useRef<AbortController | null>(null);
    const [page, setPage] = useState(1);
    const [cancelItem, setCancelItem] = useState<OrderItem | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [cancelBusy, setCancelBusy] = useState(false);

    // ── Bulk selection + group cancel/copy (keyed by order_item_id) ───────────
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
    const [bulkReason, setBulkReason] = useState("");
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkDone, setBulkDone] = useState(0);

    const cancellationReasons = useMemo(() => {
        const raw = (response?.meta_data?.cancellation_reasons ?? {}) as Record<string, { key?: string; title?: string }>;
        return Object.entries(raw).map(([id, r]) => ({ id, title: r?.title || r?.key || id }));
    }, [response?.meta_data]);

    async function handleCancel() {
        if (!cancelItem || !cancelReason) { toast.error("یک دلیل لغو انتخاب کنید"); return; }
        setCancelBusy(true);
        try {
            const r = await fetch(`/api/digikala/orders`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    vendorId,
                    order_item_id: cancelItem.order_item_id,
                    count: cancelItem.quantity,
                    cancellation_reason_id: Number(cancelReason),
                }),
            });
            const json = await r.json().catch(() => null);
            if (!r.ok) throw new Error(json?.error || json?.message || `خطای ${r.status}`);
            toast.success("سفارش لغو شد");
            setCancelItem(null);
            setCancelReason("");
            handleLoadOrders();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "خطا در لغو سفارش");
        } finally {
            setCancelBusy(false);
        }
    }

    function handleLoadOrders() {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setError(null);
        fetch(`/api/digikala/orders/active?vendorId=${encodeURIComponent(vendorId)}&page=${page}`, {
            credentials: "include",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        })
            .then(async (r) => {
                if (!r.ok) throw new Error(await r.text());
                return r.json() as Promise<IDgkOrderResponse>;
            })
            .then((res) => {
                setResponse(res.data);
                // Bridge: which other panels each ordered product is also on.
                const dgkVariantIds = Array.from(new Set((res.data?.items ?? []).map((it: any) => it.product_variant_id).filter(Boolean)));
                if (dgkVariantIds.length) {
                    fetch("/api/digikala/variant-presence", {
                        method: "POST", credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dgkVariantIds }),
                    })
                        .then((r) => (r.ok ? r.json() : { presence: {} }))
                        .then((j) => setPresence(j?.presence ?? {}))
                        .catch(() => setPresence({}));
                } else {
                    setPresence({});
                }
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setError("خطا در بارگیری سفارشات دیجی‌کالا");
                toast.error("خطا در بارگیری سفارشات دیجی کالا");
            })
            .finally(() => { if (abortRef.current === controller) setLoading(false); });
    }

    useEffect(handleLoadOrders, [page, vendorId]);
    useEffect(() => () => { abortRef.current?.abort(); }, []);

    const filteredItems = useMemo(() => {
        const items = response?.items ?? [];
        const term = deferredQuery.trim().toLowerCase();
        const { flags = [] } = facets;
        return items.filter((item) => {
            if (term && ![item.product_variant_title, item.supplier_code,
                String(item.order_id ?? ""), String(item.order_item_id ?? ""), String(item.product_variant_id ?? "")]
                .some((v) => String(v ?? "").toLowerCase().includes(term))) return false;
            if (flags.includes("urgent")) {
                const hrs = item.commitment_date ? (new Date(item.commitment_date).getTime() - Date.now()) / 3_600_000 : Infinity;
                if (!(hrs < 24)) return false;
            }
            if (flags.includes("cancelable") && !item.cancelable) return false;
            return true;
        });
    }, [deferredQuery, response?.items, facets]);

    // Only cancelable orders can be selected for a group action.
    const selectableItems = useMemo(() => filteredItems.filter((it) => it.cancelable), [filteredItems]);
    const selectableIds = useMemo(() => selectableItems.map((it) => it.order_item_id), [selectableItems]);
    const selectedCount = selectableIds.filter((id) => selected.has(id)).length;
    const allSelected = selectableIds.length > 0 && selectedCount === selectableIds.length;
    const someSelected = selectedCount > 0 && !allSelected;

    function toggleOne(id: number, checked: boolean) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    }
    function toggleAll(checked: boolean) {
        setSelected(checked ? new Set(selectableIds) : new Set());
    }
    useEffect(() => { setSelected(new Set()); }, [page, vendorId]);

    function handleBulkCopy() {
        const chosen = selectableItems.filter((it) => selected.has(it.order_item_id));
        if (!chosen.length) return;
        copyShippingText({ items: chosen.map((it) => ({ title: it.product_variant_title, quantity: it.quantity })) })
            .then(() => toast.success(`متن ارسال ${chosen.length.toLocaleString("fa-IR")} سفارش کپی شد.`))
            .catch(() => toast.error("کپی متن ارسال انجام نشد."));
    }

    async function handleBulkCancel() {
        const chosen = selectableItems.filter((it) => selected.has(it.order_item_id));
        if (!chosen.length || !bulkReason) { toast.error("یک دلیل لغو انتخاب کنید"); return; }
        setBulkBusy(true);
        setBulkDone(0);
        let ok = 0; let fail = 0;
        for (const it of chosen) {
            try {
                const r = await fetch(`/api/digikala/orders`, {
                    method: "PATCH",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        vendorId,
                        order_item_id: it.order_item_id,
                        count: it.quantity,
                        cancellation_reason_id: Number(bulkReason),
                    }),
                });
                if (!r.ok) throw new Error();
                ok += 1;
            } catch {
                fail += 1;
            }
            setBulkDone((d) => d + 1);
        }
        setBulkBusy(false);
        if (fail) toast.warning(`${ok.toLocaleString("fa-IR")} سفارش لغو شد، ${fail.toLocaleString("fa-IR")} ناموفق`);
        else toast.success(`${ok.toLocaleString("fa-IR")} سفارش لغو شد`);
        if (!fail) { setBulkCancelOpen(false); setBulkReason(""); setSelected(new Set()); }
        handleLoadOrders();
    }

    const totalRows = Number(response?.pager.total_rows ?? response?.items.length ?? 0);
    const totalPages = Math.max(1, Number(response?.pager.total_pages ?? 1));
    const pageSize = Number(response?.pager.item_per_page ?? 50);
    const isInitialLoading = loading && !response;

    const urgentCount = useMemo(() => {
        return (response?.items ?? []).filter((it) => {
            if (!it.commitment_date) return false;
            const hours = (new Date(it.commitment_date).getTime() - Date.now()) / 3_600_000;
            return hours < 24;
        }).length;
    }, [response?.items]);

    function handleCopyOrder(item: OrderItem) {
        copyShippingText({ items: [{ title: item.product_variant_title, quantity: item.quantity }] })
            .then(() => toast.success("متن ارسال سفارش کپی شد."))
            .catch(() => toast.error("کپی متن ارسال انجام نشد."));
    }

    return (
        <Container maxWidth="lg" sx={{ my: 4 }}>
            {loading && <LinearProgress />}

            <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, mb: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
                <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between" gap={1.5}>
                    <Stack>
                        <Stack direction="row" gap={1} alignItems="center">
                            <Typography variant="h6" fontWeight={800}>سفارش‌های فعال دیجی‌کالا</Typography>
                            {urgentCount > 0 && <Chip size="small" label={`${urgentCount} فوری`} color="error" />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                            {totalRows.toLocaleString("fa-IR")} سفارش · صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
                        </Typography>
                    </Stack>
                    <RefreshButton disabled={loading} onClick={handleLoadOrders} />
                </Stack>
            </Paper>

            <ListFilterBar
                search={query}
                onSearchChange={setQuery}
                searchPlaceholder="فیلتر: شماره سفارش، عنوان، بارکد..."
                resultCount={filteredItems.length}
                onClear={() => { setQuery(""); setFacets({ flags: [] }); }}
                onFacetChange={(key, values) => setFacets((p) => ({ ...p, [key]: values }))}
                facets={[
                    { key: "flags", label: "وضعیت", value: facets.flags, options: [
                        { value: "urgent", label: "فوری (کمتر از ۲۴ ساعت)" },
                        { value: "cancelable", label: "قابل لغو" },
                    ] },
                ]}
            />

            {selectedCount > 0 && (
                <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 1.25, borderRadius: 2, bgcolor: "action.selected", border: 1, borderColor: "divider" }}>
                    <Typography variant="body2" fontWeight={700}>
                        {selectedCount.toLocaleString("fa-IR")} سفارش انتخاب شده
                    </Typography>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                        <Button size="small" variant="outlined" onClick={handleBulkCopy}>کپی متن گروهی</Button>
                        <Button size="small" variant="contained" color="error" onClick={() => { setBulkReason(""); setBulkCancelOpen(true); }}>لغو گروهی</Button>
                        <Button size="small" color="inherit" onClick={() => setSelected(new Set())}>لغو انتخاب</Button>
                    </Stack>
                </Stack>
            )}

            {error && (
                <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                    <Button variant="outlined" color="error" disabled={loading} onClick={handleLoadOrders}>تلاش دوباره</Button>
                </Stack>
            )}

            {isInitialLoading && (
                <Stack spacing={1} sx={{ mb: 2 }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Paper key={i} elevation={0} sx={{ p: 1.25, border: 1, borderColor: "divider", borderRadius: 2 }}>
                            <Stack direction="row" gap={1.5} alignItems="center">
                                <Skeleton variant="rounded" width={60} height={60} />
                                <Stack flex={1} spacing={0.75}>
                                    <Skeleton variant="text" width="60%" />
                                    <Skeleton variant="text" width="40%" />
                                </Stack>
                                <Skeleton variant="rounded" width={96} height={32} />
                            </Stack>
                        </Paper>
                    ))}
                </Stack>
            )}

            <TableContainer sx={{ overflowX: "auto", border: 1, borderColor: "divider", borderRadius: 2, display: isInitialLoading ? "none" : "block" }}>
                <Table sx={{ minWidth: 1100 }}>
                    <TableHead>
                        <TableRow>
                            <TableCell padding="checkbox">
                                <Checkbox
                                    size="small"
                                    checked={allSelected}
                                    indeterminate={someSelected}
                                    disabled={selectableIds.length === 0}
                                    onChange={(e) => toggleAll(e.target.checked)}
                                    inputProps={{ "aria-label": "انتخاب همه" }}
                                />
                            </TableCell>
                            <TableCell>#</TableCell>
                            <TableCell>کالا</TableCell>
                            <TableCell align="center">تعداد</TableCell>
                            <TableCell align="center">تاریخ سفارش</TableCell>
                            <TableCell align="center">تاریخ تعهد</TableCell>
                            <TableCell align="center">کد محصول</TableCell>
                            <TableCell>سایر پنل‌ها</TableCell>
                            <TableCell align="right">عملیات</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredItems.map((item, i) => (
                            <TableRow key={`${item.order_id}-${item.order_item_id}`} selected={selected.has(item.order_item_id)}>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        size="small"
                                        checked={selected.has(item.order_item_id)}
                                        disabled={!item.cancelable}
                                        onChange={(e) => toggleOne(item.order_item_id, e.target.checked)}
                                        inputProps={{ "aria-label": `انتخاب سفارش ${item.order_id}` }}
                                    />
                                </TableCell>
                                <TableCell>{(i + 1) + ((page - 1) * pageSize)}</TableCell>
                                <TableCell>
                                    <Stack direction="row" alignItems="center" gap={1}>
                                        <ZoomableImage
                                            src={item.product_image_url}
                                            width={52}
                                            height={52}
                                            alt={item.product_variant_title}
                                        />
                                        <Stack gap={0.5}>
                                            <Typography
                                                variant="body2"
                                                component={Link}
                                                target="_blank"
                                                href={`https://seller.digikala.com/pwa/orders?sort=variant_id&page=1&search=${item.product_variant_id}`}
                                                sx={{ color: "inherit", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                                            >
                                                {item.product_variant_title}
                                            </Typography>
                                            <Stack direction="row" gap={0.5} flexWrap="wrap">
                                                <Chip size="small" label={`سفارش ${item.order_id}`} color="primary" />
                                                <Chip size="small" variant="outlined" label={`${(item.total_price / 10).toLocaleString("fa-IR")} تومان`} color="primary" />
                                                {item.cancelable && <Chip size="small" label="قابل لغو" color="warning" variant="outlined" />}
                                            </Stack>
                                        </Stack>
                                    </Stack>
                                </TableCell>
                                <TableCell align="center">
                                    <Typography variant="body2" fontWeight={600}>{item.quantity}</Typography>
                                </TableCell>
                                <TableCell align="center">
                                    <Typography variant="caption" color="text.secondary">
                                        {item.order_created_at ? formatDate(item.order_created_at) : "—"}
                                    </Typography>
                                </TableCell>
                                <TableCell align="center">
                                    {item.commitment_date ? (
                                        <Tooltip title={new Date(item.commitment_date).toLocaleString("fa-IR")}>
                                            <Chip
                                                size="small"
                                                label={formatDate(item.commitment_date)}
                                                color={commitmentColor(item.commitment_date)}
                                            />
                                        </Tooltip>
                                    ) : "—"}
                                </TableCell>
                                <TableCell align="center">
                                    {item.supplier_code ? (
                                        <Button size="small" variant="outlined" color="info" component={Link} target="_blank" href={`/admin/catalog/variants?q=${item.supplier_code}`}>
                                            {item.supplier_code}
                                        </Button>
                                    ) : "N/A"}
                                </TableCell>
                                <TableCell>
                                    <MarketplacePresence presence={presence?.[String(item.product_variant_id)]} />
                                </TableCell>
                                <TableCell align="right">
                                    <Stack direction="row" gap={0.5} justifyContent="flex-end">
                                        <Button size="small" variant="outlined" onClick={() => handleCopyOrder(item)}>
                                            کپی متن
                                        </Button>
                                        {item.cancelable && (
                                            <Tooltip title="لغو این سفارش">
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    color="error"
                                                    startIcon={<CancelRoundedIcon fontSize="small" />}
                                                    onClick={() => { setCancelItem(item); setCancelReason(""); }}
                                                >
                                                    لغو
                                                </Button>
                                            </Tooltip>
                                        )}
                                        {onNavigateTo && (
                                            <Tooltip title="رفتن به بخش مرسوله‌ها">
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    color="secondary"
                                                    onClick={() => onNavigateTo(5)}
                                                    startIcon={<LocalShippingRoundedIcon fontSize="small" />}
                                                >
                                                    مرسوله
                                                </Button>
                                            </Tooltip>
                                        )}
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))}
                        {!loading && response && response.items.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9}>
                                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>
                                        سفارش فعالی برای نمایش دریافت نشد.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && response && response.items.length > 0 && filteredItems.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9}>
                                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>
                                        برای فیلتر «{query}» در این صفحه سفارشی پیدا نشد.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1.5} sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    تاریخ تعهد: 🟢 بیش از ۲۴ ساعت · 🟠 کمتر از ۲۴ ساعت · 🔴 گذشته
                </Typography>
                <Pagination
                    page={page}
                    count={totalPages}
                    siblingCount={1}
                    boundaryCount={1}
                    onChange={(_, n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                />
                <PageJumper pages={totalPages} onJump={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            </Stack>

            <Dialog open={Boolean(cancelItem)} onClose={() => !cancelBusy && setCancelItem(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ position: "relative", pr: 6 }}>
                    لغو سفارش
                    <DialogCloseButton onClose={() => setCancelItem(null)} disabled={cancelBusy} />
                </DialogTitle>
                <Divider />
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            {cancelItem?.product_variant_title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            سفارش {cancelItem?.order_id} · تعداد {cancelItem?.quantity}
                        </Typography>
                        <TextField
                            select size="small" label="دلیل لغو" fullWidth
                            value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                        >
                            {cancellationReasons.length === 0 && <MenuItem value="" disabled>دلیلی در دسترس نیست</MenuItem>}
                            {cancellationReasons.map((r) => (
                                <MenuItem key={r.id} value={r.id}>{r.title}</MenuItem>
                            ))}
                        </TextField>
                        <Typography variant="caption" color="error.main">
                            لغو سفارش روی پنل دیجی‌کالا اعمال می‌شود و قابل بازگشت نیست.
                        </Typography>
                    </Stack>
                </DialogContent>
                <Divider />
                <DialogActions>
                    <Button onClick={() => setCancelItem(null)} disabled={cancelBusy}>انصراف</Button>
                    <Button variant="contained" color="error" onClick={handleCancel} disabled={cancelBusy || !cancelReason}>
                        {cancelBusy ? <CircularProgress size={16} color="inherit" /> : "تأیید لغو"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Bulk cancel — one reason applied to every selected cancelable order. */}
            <Dialog open={bulkCancelOpen} onClose={() => !bulkBusy && setBulkCancelOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ position: "relative", pr: 6 }}>
                    لغو گروهی سفارش‌ها
                    <DialogCloseButton onClose={() => setBulkCancelOpen(false)} disabled={bulkBusy} />
                </DialogTitle>
                <Divider />
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            {selectedCount.toLocaleString("fa-IR")} سفارش انتخاب‌شده با یک دلیل لغو می‌شوند.
                        </Typography>
                        <TextField
                            select size="small" label="دلیل لغو" fullWidth
                            value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} disabled={bulkBusy}
                        >
                            {cancellationReasons.length === 0 && <MenuItem value="" disabled>دلیلی در دسترس نیست</MenuItem>}
                            {cancellationReasons.map((r) => (
                                <MenuItem key={r.id} value={r.id}>{r.title}</MenuItem>
                            ))}
                        </TextField>
                        {bulkBusy && (
                            <Stack spacing={0.5}>
                                <LinearProgress variant="determinate" value={(bulkDone / Math.max(1, selectedCount)) * 100} />
                                <Typography variant="caption" color="text.secondary">
                                    {bulkDone.toLocaleString("fa-IR")} از {selectedCount.toLocaleString("fa-IR")}
                                </Typography>
                            </Stack>
                        )}
                        <Typography variant="caption" color="error.main">
                            لغو روی پنل دیجی‌کالا اعمال می‌شود و قابل بازگشت نیست.
                        </Typography>
                    </Stack>
                </DialogContent>
                <Divider />
                <DialogActions>
                    <Button onClick={() => setBulkCancelOpen(false)} disabled={bulkBusy}>انصراف</Button>
                    <Button variant="contained" color="error" onClick={handleBulkCancel} disabled={bulkBusy || !bulkReason}>
                        {bulkBusy ? <CircularProgress size={16} color="inherit" /> : "تأیید لغو گروهی"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}
