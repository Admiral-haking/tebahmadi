"use client";

import { RefreshButton } from "@/components/refresh";
import ListFilterBar from "@/components/admin/list-filter-bar";
import { PageJumper } from "@/components/search/pagination";
import ZoomableImage from "@/components/zoomable-image";
import {
    Box, Button, Checkbox, Chip, CircularProgress, Container, Dialog,
    DialogActions, DialogContent, DialogTitle, Divider,
    IconButton, LinearProgress, Menu, MenuItem,
    Pagination, Skeleton, Stack, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, TextField,
    Tooltip, Typography,
} from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";

interface VariantItem {
    id: number;
    image_src: string;
    product_id: number;
    product_variant_id: number;
    product_url: string;
    supplier_code: string;
    title: string;
    product_title: string;
    active: boolean;
    lead_time: number;
    price_sale: number;
    cash_selling_price: number;
    marketplace_seller_stock: number;
    warehouse_stock: number;
    on_the_way_stock: number;
    is_buy_box_winner: boolean;
    is_sku_winner: boolean;
    is_in_promotion: boolean;
    is_archived: boolean;
    main_category_title: string;
    sku_config: { color: string; size: string };
    theme_values: { themeLabel: string; themeValue: { titleFa: string } }[];
}

interface VariantsPager {
    page: number; item_per_page: number; total_pages: number; total_rows: number;
}

interface VariantsData {
    pager: VariantsPager;
    items: VariantItem[];
}

// ─── per-row action menu (no dialogs — dialogs live in VariantRow) ────────────

function VariantActions({
    variant, vendorId, onUpdated, onOpenStock, onOpenPrice,
}: {
    variant: VariantItem;
    vendorId: string;
    onUpdated: (patch: Partial<VariantItem>) => void;
    onOpenStock: () => void;
    onOpenPrice: () => void;
}) {
    const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
    const [busy, setBusy] = useState(false);

    async function callProxy(method: string, path: string, body?: unknown) {
        const r = await fetch(`/api/digikala/open-api/${path}?vendorId=${encodeURIComponent(vendorId)}`, {
            method, credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const json = await r.json().catch(() => null);
        if (!r.ok) {
            const msg = json?.error || json?.data?.message || `خطای ${r.status}`;
            throw new Error(msg);
        }
        return json;
    }

    async function handleToggleActive() {
        setMenuAnchor(null);
        setBusy(true);
        try {
            // DGK expects { activation: bool } not { active: bool }
            await callProxy("PUT", `variants/${variant.product_variant_id}/activation`, { activation: !variant.active });
            toast.success(variant.active ? "واریانت غیرفعال شد" : "واریانت فعال شد");
            onUpdated({ active: !variant.active });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "خطا در تغییر وضعیت");
        } finally {
            setBusy(false);
        }
    }

    async function handleArchive() {
        setMenuAnchor(null);
        if (!window.confirm(`آرشیو کردن واریانت "${variant.title}"؟ این عمل برگشت‌پذیر نیست.`)) return;
        setBusy(true);
        try {
            await callProxy("PUT", `variants/${variant.product_variant_id}/archive`);
            toast.success("واریانت آرشیو شد");
            onUpdated({ is_archived: true, active: false });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "خطا در آرشیو کردن");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <Tooltip title="عملیات">
                <span>
                    <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} disabled={busy}>
                        {busy ? <CircularProgress size={16} /> : <MoreVertRoundedIcon fontSize="small" />}
                    </IconButton>
                </span>
            </Tooltip>

            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
                <MenuItem onClick={handleToggleActive}>
                    {variant.active ? "غیرفعال کردن" : "فعال کردن"}
                </MenuItem>
                <MenuItem onClick={() => { setMenuAnchor(null); onOpenStock(); }}>
                    بروزرسانی موجودی
                </MenuItem>
                <MenuItem onClick={() => { setMenuAnchor(null); onOpenPrice(); }}>
                    بروزرسانی قیمت
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleArchive} sx={{ color: "error.main" }} disabled={variant.is_archived}>
                    آرشیو کردن
                </MenuItem>
            </Menu>
        </>
    );
}

// ─── per-row component holding dialog state ───────────────────────────────────

function VariantRow({ v, index, vendorId, onUpdated, selected, onToggleSelect }: {
    v: VariantItem; index: number; vendorId: string;
    onUpdated: (patch: Partial<VariantItem>) => void;
    selected: boolean;
    onToggleSelect: (checked: boolean) => void;
}) {
    const [dialog, setDialog] = useState<null | "stock" | "price">(null);
    const [inputVal, setInputVal] = useState("");
    const [leadTimeInput, setLeadTimeInput] = useState("");
    const [busy, setBusy] = useState(false);

    const priceInToman = Math.round((v.price_sale || v.cash_selling_price || 0) / 10);

    async function callProxy(method: string, path: string, body?: unknown) {
        const r = await fetch(`/api/digikala/open-api/${path}?vendorId=${encodeURIComponent(vendorId)}`, {
            method, credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const json = await r.json().catch(() => null);
        if (!r.ok) {
            const msg = json?.error || json?.data?.message || `خطای ${r.status}`;
            throw new Error(msg);
        }
        return json;
    }

    function openStock() {
        setInputVal(String(v.marketplace_seller_stock));
        setDialog("stock");
    }

    function openPrice() {
        setInputVal(String(priceInToman));
        setLeadTimeInput(String(v.lead_time || 2));
        setDialog("price");
    }

    async function handleUpdateStock() {
        const n = parseInt(inputVal, 10);
        if (!Number.isFinite(n) || n < 0) { toast.error("عدد معتبر وارد کنید"); return; }
        setBusy(true);
        try {
            await callProxy("PATCH", `variants/${v.product_variant_id}/seller-stock`, { seller_stock: n });
            toast.success("موجودی بروز شد");
            setDialog(null);
            onUpdated({ marketplace_seller_stock: n });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "خطا در بروزرسانی موجودی");
        } finally {
            setBusy(false);
        }
    }

    async function handleUpdatePrice() {
        const toman = parseInt(inputVal, 10);
        if (!Number.isFinite(toman) || toman <= 0) { toast.error("قیمت معتبر وارد کنید"); return; }
        const leadTimeVal = parseInt(leadTimeInput, 10);
        const sellerLeadTime = Number.isFinite(leadTimeVal) && leadTimeVal > 0 ? leadTimeVal : (v.lead_time || 2);
        const rial = toman * 10;
        setBusy(true);
        try {
            // DGK PUT variants/{id} requires seller_lead_time (mandatory)
            await callProxy("PUT", `variants/${v.product_variant_id}`, {
                price_sale: rial,
                price_list: rial,
                seller_lead_time: sellerLeadTime,
            });
            toast.success("قیمت بروز شد");
            setDialog(null);
            onUpdated({ price_sale: rial, cash_selling_price: rial, lead_time: sellerLeadTime });
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "خطا در بروزرسانی قیمت");
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <TableRow sx={{ opacity: v.is_archived ? 0.45 : 1 }} selected={selected}>
                <TableCell padding="checkbox">
                    <Checkbox
                        size="small"
                        checked={selected}
                        disabled={v.is_archived}
                        onChange={(e) => onToggleSelect(e.target.checked)}
                        inputProps={{ "aria-label": `انتخاب ${v.title}` }}
                    />
                </TableCell>
                <TableCell><Typography variant="caption">{index}</Typography></TableCell>
                <TableCell>
                    <Stack direction="row" gap={1} alignItems="flex-start">
                        <ZoomableImage src={v.image_src} width={48} height={48} alt={v.title} sx={{ mt: 0.25 }} />
                        <Stack spacing={0.2}>
                            <Typography variant="body2" component={Link} href={v.product_url ?? "#"} target="_blank"
                                sx={{ color: "text.primary", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                                {v.title || v.product_title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">واریانت: {v.product_variant_id}</Typography>
                            <Typography variant="caption" color="text.secondary">بارکد: {v.supplier_code || "—"}</Typography>
                        </Stack>
                    </Stack>
                </TableCell>
                <TableCell>
                    <Stack spacing={0.25} alignItems="flex-start">
                        <Typography variant="body2" fontWeight={700}>{priceInToman.toLocaleString("fa-IR")}</Typography>
                        <Tooltip title="ویرایش قیمت و مهلت تحویل">
                            <Chip
                                size="small"
                                icon={<EditRoundedIcon sx={{ fontSize: "12px !important" }} />}
                                label="ویرایش"
                                variant="outlined"
                                clickable
                                onClick={openPrice}
                                sx={{ fontSize: 11 }}
                            />
                        </Tooltip>
                    </Stack>
                </TableCell>
                <TableCell>
                    <Stack spacing={0.4}>
                        <Chip size="small" label={`فروشنده: ${(v.marketplace_seller_stock ?? 0).toLocaleString("fa-IR")}`}
                            color={v.marketplace_seller_stock > 0 ? "success" : "error"} variant="outlined" />
                        {v.warehouse_stock > 0 && (
                            <Chip size="small" label={`انبار: ${v.warehouse_stock.toLocaleString("fa-IR")}`} color="info" variant="outlined" />
                        )}
                        {v.on_the_way_stock > 0 && (
                            <Chip size="small" label={`در راه: ${v.on_the_way_stock.toLocaleString("fa-IR")}`} color="warning" variant="outlined" />
                        )}
                    </Stack>
                </TableCell>
                <TableCell>
                    <Stack direction="row" gap={0.5} flexWrap="wrap" alignItems="center">
                        <Chip size="small" label={v.active ? "فعال" : "غیرفعال"} color={v.active ? "success" : "error"} />
                        {v.is_archived && <Chip size="small" label="آرشیو" />}
                        {v.is_buy_box_winner && <Chip size="small" label="برنده بای‌باکس" color="primary" />}
                        {v.is_in_promotion && <Chip size="small" label="تخفیف" color="warning" />}
                    </Stack>
                </TableCell>
                <TableCell>
                    <Stack spacing={0.4}>
                        {v.sku_config?.color && <Typography variant="caption" color="text.secondary">رنگ: {v.sku_config.color}</Typography>}
                        {v.sku_config?.size && <Typography variant="caption" color="text.secondary">سایز: {v.sku_config.size}</Typography>}
                        {v.lead_time > 0 && <Typography variant="caption" color="text.secondary">{v.lead_time} روز آماده‌سازی</Typography>}
                    </Stack>
                </TableCell>
                <TableCell align="center">
                    <VariantActions
                        variant={v}
                        vendorId={vendorId}
                        onUpdated={onUpdated}
                        onOpenStock={openStock}
                        onOpenPrice={openPrice}
                    />
                </TableCell>
            </TableRow>

            {/* Stock dialog — MUI Dialog uses portal so DOM position doesn't matter */}
            <Dialog open={dialog === "stock"} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ position: "relative", pr: 6 }}>
                    بروزرسانی موجودی
                    <DialogCloseButton onClose={() => setDialog(null)} disabled={busy} />
                </DialogTitle>
                <DialogContent>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                        {v.title} — فعلی: {(v.marketplace_seller_stock ?? 0).toLocaleString("fa-IR")}
                    </Typography>
                    <TextField
                        fullWidth size="small" type="number" label="موجودی جدید"
                        value={inputVal} onChange={(e) => setInputVal(e.target.value)}
                        slotProps={{ input: { inputProps: { min: 0, step: 1 } } }}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleUpdateStock()}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialog(null)} disabled={busy}>لغو</Button>
                    <Button variant="contained" onClick={handleUpdateStock} disabled={busy}>
                        {busy ? <CircularProgress size={16} /> : "ذخیره"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Price dialog */}
            <Dialog open={dialog === "price"} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ position: "relative", pr: 6 }}>
                    ویرایش قیمت و مهلت تحویل
                    <DialogCloseButton onClose={() => setDialog(null)} disabled={busy} />
                </DialogTitle>
                <DialogContent>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                        {v.title} — قیمت فعلی: {priceInToman.toLocaleString("fa-IR")} تومان
                    </Typography>
                    <Stack spacing={2}>
                        <TextField
                            fullWidth size="small" type="number" label="قیمت جدید (تومان)"
                            value={inputVal} onChange={(e) => setInputVal(e.target.value)}
                            slotProps={{ input: { inputProps: { min: 1, step: 1000 } } }}
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && handleUpdatePrice()}
                        />
                        <TextField
                            fullWidth size="small" type="number" label="مهلت تحویل به انبار (روز)"
                            value={leadTimeInput} onChange={(e) => setLeadTimeInput(e.target.value)}
                            slotProps={{ input: { inputProps: { min: 1, max: 30, step: 1 } } }}
                            helperText="حداقل ۱ روز"
                            onKeyDown={(e) => e.key === "Enter" && handleUpdatePrice()}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialog(null)} disabled={busy}>لغو</Button>
                    <Button variant="contained" onClick={handleUpdatePrice} disabled={busy}>
                        {busy ? <CircularProgress size={16} /> : "ذخیره"}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

// ─── main component ─────────────────────────────────────────────────────────

export default function VariantsSpec({ vendorId }: { vendorId: string }) {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<VariantItem[]>([]);
    const [pager, setPager] = useState<VariantsPager | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const [facets, setFacets] = useState<Record<string, string[]>>({ status: [], stock: [], flags: [] });
    const [page, setPage] = useState(1);
    const abortRef = useRef<AbortController | null>(null);

    // ── Bulk selection + group edit (price/stock for many variants at once) ──
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkDialog, setBulkDialog] = useState<null | "stock" | "price">(null);
    const [bulkVal, setBulkVal] = useState("");
    const [bulkLead, setBulkLead] = useState("2");
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkDone, setBulkDone] = useState(0);

    async function callProxy(method: string, path: string, body?: unknown) {
        const r = await fetch(`/api/digikala/open-api/${path}?vendorId=${encodeURIComponent(vendorId)}`, {
            method, credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const json = await r.json().catch(() => null);
        if (!r.ok) throw new Error(json?.error || json?.data?.message || `خطای ${r.status}`);
        return json;
    }

    function load() {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setError(null);
        fetch(`/api/digikala/open-api/variants?vendorId=${encodeURIComponent(vendorId)}&page=${page}&size=50&sort=id&order=desc`, {
            credentials: "include",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        })
            .then(async (r) => {
                const json = await r.json().catch(() => null);
                if (!r.ok) throw new Error(json?.error || json?.data?.message || `خطای ${r.status}`);
                const data: VariantsData = json?.data?.data;
                setItems(data?.items ?? []);
                setPager(data?.pager ?? null);
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setError(err instanceof Error ? err.message : "خطا در بارگیری واریانت‌ها");
                toast.error("خطا در بارگیری واریانت‌های دیجی‌کالا");
            })
            .finally(() => { if (abortRef.current === controller) setLoading(false); });
    }

    useEffect(load, [page, vendorId]);
    useEffect(() => () => { abortRef.current?.abort(); }, []);

    function patchItem(id: number, patch: Partial<VariantItem>) {
        setItems((prev) => prev.map((v) => v.product_variant_id === id ? { ...v, ...patch } : v));
    }

    const filtered = useMemo(() => {
        const term = deferredQuery.trim().toLowerCase();
        const { status = [], stock = [], flags = [] } = facets;
        return items.filter((v) => {
            if (term && ![v.title, v.product_title, v.supplier_code, String(v.product_variant_id), String(v.product_id)]
                .some((s) => String(s ?? "").toLowerCase().includes(term))) return false;
            // status facet (OR within the group)
            if (status.length) {
                const ok = status.some((s) =>
                    s === "active" ? (v.active && !v.is_archived)
                        : s === "inactive" ? (!v.active && !v.is_archived)
                            : s === "archived" ? v.is_archived : false);
                if (!ok) return false;
            }
            if (stock.length) {
                const inStock = (v.marketplace_seller_stock ?? 0) > 0;
                const ok = stock.some((s) => (s === "instock" ? inStock : !inStock));
                if (!ok) return false;
            }
            if (flags.length) {
                const ok = flags.every((f) =>
                    f === "promo" ? v.is_in_promotion : f === "buybox" ? v.is_buy_box_winner : true);
                if (!ok) return false;
            }
            return true;
        });
    }, [deferredQuery, items, facets]);

    // Selection works over the currently-filtered, non-archived rows.
    const selectableIds = useMemo(
        () => filtered.filter((v) => !v.is_archived).map((v) => v.product_variant_id),
        [filtered],
    );
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
    // Drop the selection whenever the page or branch changes (rows differ).
    useEffect(() => { setSelected(new Set()); }, [page, vendorId]);

    function openBulk(mode: "stock" | "price") {
        setBulkVal("");
        setBulkLead("2");
        setBulkDone(0);
        setBulkDialog(mode);
    }

    async function applyBulk() {
        const ids = selectableIds.filter((id) => selected.has(id));
        if (!ids.length) return;
        if (bulkDialog === "stock") {
            const n = parseInt(bulkVal, 10);
            if (!Number.isFinite(n) || n < 0) { toast.error("موجودی معتبر وارد کنید"); return; }
        } else {
            const toman = parseInt(bulkVal, 10);
            if (!Number.isFinite(toman) || toman <= 0) { toast.error("قیمت معتبر وارد کنید"); return; }
        }
        setBulkBusy(true);
        setBulkDone(0);
        let ok = 0; let fail = 0;
        for (const id of ids) {
            try {
                if (bulkDialog === "stock") {
                    const n = parseInt(bulkVal, 10);
                    await callProxy("PATCH", `variants/${id}/seller-stock`, { seller_stock: n });
                    patchItem(id, { marketplace_seller_stock: n });
                } else {
                    const rial = parseInt(bulkVal, 10) * 10;
                    const lead = parseInt(bulkLead, 10);
                    const sellerLeadTime = Number.isFinite(lead) && lead > 0 ? lead : 2;
                    await callProxy("PUT", `variants/${id}`, { price_sale: rial, price_list: rial, seller_lead_time: sellerLeadTime });
                    patchItem(id, { price_sale: rial, cash_selling_price: rial, lead_time: sellerLeadTime });
                }
                ok += 1;
            } catch {
                fail += 1;
            }
            setBulkDone((d) => d + 1);
        }
        setBulkBusy(false);
        if (fail) toast.warning(`${ok.toLocaleString("fa-IR")} مورد بروز شد، ${fail.toLocaleString("fa-IR")} ناموفق`);
        else toast.success(`${ok.toLocaleString("fa-IR")} مورد با موفقیت بروز شد`);
        if (!fail) { setBulkDialog(null); setSelected(new Set()); }
    }

    const totalPages = Math.max(1, Number(pager?.total_pages ?? 1));
    const totalRows = Number(pager?.total_rows ?? 0);
    const isInitialLoading = loading && items.length === 0;

    return (
        <Container maxWidth={false} sx={{ my: 4, px: { xs: 1, md: 3 } }}>
            {loading && <LinearProgress />}

            <Stack sx={{ mb: 1 }}>
                <Typography variant="h6" fontWeight={800}>واریانت‌های دیجی‌کالا</Typography>
                <Typography variant="caption" color="text.secondary">
                    {totalRows.toLocaleString("fa-IR")} واریانت — صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
                </Typography>
            </Stack>

            <ListFilterBar
                search={query}
                onSearchChange={setQuery}
                searchPlaceholder="فیلتر: عنوان، بارکد، کد واریانت..."
                resultCount={filtered.length}
                onClear={() => { setQuery(""); setFacets({ status: [], stock: [], flags: [] }); }}
                right={<RefreshButton disabled={loading} onClick={load} />}
                onFacetChange={(key, values) => setFacets((p) => ({ ...p, [key]: values }))}
                facets={[
                    { key: "status", label: "وضعیت", value: facets.status, options: [
                        { value: "active", label: "فعال" }, { value: "inactive", label: "غیرفعال" }, { value: "archived", label: "آرشیو" },
                    ] },
                    { key: "stock", label: "موجودی", value: facets.stock, options: [
                        { value: "instock", label: "موجود" }, { value: "outofstock", label: "ناموجود" },
                    ] },
                    { key: "flags", label: "نشان‌ها", value: facets.flags, options: [
                        { value: "promo", label: "تخفیف‌دار" }, { value: "buybox", label: "برندهٔ بای‌باکس" },
                    ] },
                ]}
            />

            {/* Bulk action bar — appears once one or more variants are selected. */}
            {selectedCount > 0 && (
                <Stack
                    direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }}
                    justifyContent="space-between" gap={1}
                    sx={{ mb: 1.5, p: 1.25, borderRadius: 2, bgcolor: "action.selected", border: 1, borderColor: "divider" }}
                >
                    <Typography variant="body2" fontWeight={700}>
                        {selectedCount.toLocaleString("fa-IR")} واریانت انتخاب شده
                    </Typography>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                        <Button size="small" variant="contained" onClick={() => openBulk("price")}>ویرایش گروهی قیمت</Button>
                        <Button size="small" variant="contained" color="secondary" onClick={() => openBulk("stock")}>ویرایش گروهی موجودی</Button>
                        <Button size="small" color="inherit" onClick={() => setSelected(new Set())}>لغو انتخاب</Button>
                    </Stack>
                </Stack>
            )}

            {error && (
                <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                    <Button variant="outlined" color="error" size="small" disabled={loading} onClick={load}>تلاش دوباره</Button>
                </Stack>
            )}

            {isInitialLoading && (
                <Stack spacing={1} sx={{ mb: 2 }}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Stack key={i} direction="row" gap={1.5} alignItems="center" sx={{ p: 1.25, border: 1, borderColor: "divider", borderRadius: 1 }}>
                            <Skeleton variant="rounded" width={52} height={52} />
                            <Stack flex={1} spacing={0.5}><Skeleton variant="text" width="55%" /><Skeleton variant="text" width="35%" /></Stack>
                            <Skeleton variant="rounded" width={120} height={28} />
                        </Stack>
                    ))}
                </Stack>
            )}

            <TableContainer sx={{ overflowX: "auto", border: 1, borderColor: "divider", borderRadius: 1, display: isInitialLoading ? "none" : "block" }}>
                <Table sx={{
                    minWidth: 900, width: "100%", tableLayout: "fixed",
                    "& th, & td": { whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word", verticalAlign: "middle" },
                }}>
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
                            <TableCell width={40}>#</TableCell>
                            <TableCell width="30%">واریانت</TableCell>
                            <TableCell width="15%">قیمت (تومان)</TableCell>
                            <TableCell width="18%">موجودی</TableCell>
                            <TableCell width="20%">وضعیت</TableCell>
                            <TableCell width="12%">مشخصات</TableCell>
                            <TableCell width={60} align="center">عملیات</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filtered.map((v, i) => (
                            <VariantRow
                                key={v.product_variant_id}
                                v={v}
                                index={i + 1 + (page - 1) * 50}
                                vendorId={vendorId}
                                onUpdated={(patch) => patchItem(v.product_variant_id, patch)}
                                selected={selected.has(v.product_variant_id)}
                                onToggleSelect={(checked) => toggleOne(v.product_variant_id, checked)}
                            />
                        ))}
                        {!isInitialLoading && !filtered.length && (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
                                        <Typography variant="subtitle2">واریانتی یافت نشد</Typography>
                                        <Button variant="outlined" size="small" disabled={loading} onClick={load}>تلاش دوباره</Button>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1.5} sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    داده‌ها مستقیم از API دیجی‌کالا — تغییرات در همین صفحه اعمال می‌شوند
                </Typography>
                <Pagination page={page} count={totalPages} siblingCount={1} boundaryCount={1}
                    onChange={(_, n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
                <PageJumper pages={totalPages} onJump={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            </Stack>

            {/* Bulk edit dialog — applies one value to every selected variant. */}
            <Dialog open={bulkDialog !== null} onClose={() => !bulkBusy && setBulkDialog(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ position: "relative", pr: 6 }}>
                    {bulkDialog === "stock" ? "موجودی گروهی" : "قیمت گروهی"}
                    <DialogCloseButton onClose={() => setBulkDialog(null)} disabled={bulkBusy} />
                </DialogTitle>
                <DialogContent>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                        روی {selectedCount.toLocaleString("fa-IR")} واریانت انتخاب‌شده اعمال می‌شود.
                    </Typography>
                    <Stack spacing={2}>
                        {bulkDialog === "stock" ? (
                            <TextField
                                fullWidth size="small" type="number" label="موجودی جدید برای همه"
                                value={bulkVal} onChange={(e) => setBulkVal(e.target.value)}
                                slotProps={{ input: { inputProps: { min: 0, step: 1 } } }}
                                autoFocus disabled={bulkBusy}
                            />
                        ) : (
                            <>
                                <TextField
                                    fullWidth size="small" type="number" label="قیمت جدید برای همه (تومان)"
                                    value={bulkVal} onChange={(e) => setBulkVal(e.target.value)}
                                    slotProps={{ input: { inputProps: { min: 1, step: 1000 } } }}
                                    autoFocus disabled={bulkBusy}
                                />
                                <TextField
                                    fullWidth size="small" type="number" label="مهلت تحویل به انبار (روز)"
                                    value={bulkLead} onChange={(e) => setBulkLead(e.target.value)}
                                    slotProps={{ input: { inputProps: { min: 1, max: 30, step: 1 } } }}
                                    helperText="حداقل ۱ روز" disabled={bulkBusy}
                                />
                            </>
                        )}
                        {bulkBusy && (
                            <Stack spacing={0.5}>
                                <LinearProgress variant="determinate" value={(bulkDone / Math.max(1, selectedCount)) * 100} />
                                <Typography variant="caption" color="text.secondary">
                                    {bulkDone.toLocaleString("fa-IR")} از {selectedCount.toLocaleString("fa-IR")}
                                </Typography>
                            </Stack>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBulkDialog(null)} disabled={bulkBusy}>لغو</Button>
                    <Button variant="contained" onClick={applyBulk} disabled={bulkBusy}>
                        {bulkBusy ? <CircularProgress size={16} /> : "اعمال روی همه"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}
