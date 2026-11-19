"use client";

import { RefreshButton } from "@/components/refresh";
import {
    Box, Button, Chip, CircularProgress, Container, Dialog,
    DialogActions, DialogContent, DialogTitle, Divider,
    IconButton, InputAdornment, LinearProgress, Pagination,
    Skeleton, Stack, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import InventoryRoundedIcon from "@mui/icons-material/InventoryRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";
import { PageJumper } from "@/components/search/pagination";

interface PackageItem {
    id: number;
    package_id?: string;
    status: string;
    status_title?: string;
    created_at: string;
    updated_at?: string;
    warehouse_id?: number;
    warehouse_name?: string;
    shipment_type?: string;
    tracking_code?: string;
    items_count?: number;
    items?: { product_variant_id: number; title?: string; quantity: number }[];
}

interface PackagesData {
    pager?: { page: number; item_per_page: number; total_pages: number; total_rows: number };
    items: PackageItem[];
}

interface Warehouse {
    id: number;
    title: string;
}

const STATUS_LABEL: Record<string, { label: string; color: "default" | "info" | "success" | "warning" | "error" | "primary" }> = {
    pending: { label: "در انتظار", color: "warning" },
    created: { label: "ایجاد شده", color: "info" },
    sent: { label: "ارسال شده", color: "primary" },
    received: { label: "دریافت شده", color: "success" },
    cancelled: { label: "لغو شده", color: "error" },
    processing: { label: "در پردازش", color: "info" },
    delivered: { label: "تحویل داده شد", color: "success" },
    returned: { label: "مرجوع شده", color: "error" },
};

function statusChip(status: string, title?: string) {
    const s = STATUS_LABEL[status];
    return { label: title || s?.label || status, color: s?.color ?? ("default" as const) };
}

function formatDate(iso: string) {
    try {
        return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch { return iso; }
}

// ─── create dialog ──────────────────────────────────────────────────────────

function CreatePackageDialog({ open, vendorId, onCreated, onClose }: {
    open: boolean; vendorId: string; onCreated: () => void; onClose: () => void;
}) {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [warehouseId, setWarehouseId] = useState("");
    const [rows, setRows] = useState([{ variant_id: "", quantity: "1" }]);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) return;
        // packages/warehouses always requires shippingNatureId (always 400 without it)
        // Use profile endpoint which returns warehouses reliably
        fetch(`/api/digikala/open-api/profile?vendorId=${encodeURIComponent(vendorId)}`, { credentials: "include" })
            .then(async (r) => {
                const json = await r.json().catch(() => null);
                if (!r.ok) return;
                const raw = json?.data?.data ?? json?.data ?? {};
                const list: unknown[] = raw?.warehouses ?? [];
                setWarehouses(
                    list
                        .filter((w): w is Record<string, unknown> => typeof w === "object" && w !== null)
                        .map((w) => ({ id: Number(w.id ?? 0), title: String(w.title ?? `انبار ${w.id ?? ""}`) }))
                );
            })
            .catch(() => null);
    }, [open, vendorId]);

    async function handleCreate() {
        const variantItems = rows
            .filter((r) => r.variant_id.trim())
            .map((r) => ({ variant_id: String(Number(r.variant_id)), count: String(Number(r.quantity) || 1) }));
        if (!variantItems.length) { toast.error("حداقل یک واریانت وارد کنید"); return; }

        setBusy(true);
        try {
            // Per the DK Open API: { packages: { "<key>": { items:[{variant_id,count}],
            // delivery_type } }, package_type }.
            const r = await fetch(`/api/digikala/open-api/packages?vendorId=${encodeURIComponent(vendorId)}`, {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    packages: {
                        "1": {
                            items: variantItems,
                            delivery_type: "digikala",
                        },
                    },
                    package_type: "consignment",
                }),
            });
            const json = await r.json().catch(() => null);
            if (!r.ok) throw new Error(json?.error || json?.data?.message || `خطای ${r.status}`);
            toast.success("مرسوله ایجاد شد");
            onCreated();
            onClose();
            setRows([{ variant_id: "", quantity: "1" }]);
            setWarehouseId("");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "خطا در ایجاد مرسوله");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ position: "relative", pr: 6 }}>
                ایجاد مرسوله جدید
                <DialogCloseButton onClose={onClose} disabled={busy} />
            </DialogTitle>
            <Divider />
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        select size="small" label="انبار" value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)} fullWidth
                        slotProps={{ select: { native: true } }}
                    >
                        <option value="">انتخاب انبار...</option>
                        {warehouses.map((w) => <option key={w.id} value={w.id}>{w.title || `انبار ${w.id}`}</option>)}
                    </TextField>

                    <Typography variant="subtitle2">واریانت‌های مرسوله:</Typography>
                    {rows.map((row, i) => (
                        <Stack key={i} direction="row" gap={1}>
                            <TextField size="small" label="شناسه واریانت" value={row.variant_id} type="number"
                                onChange={(e) => setRows((p) => p.map((r, j) => j === i ? { ...r, variant_id: e.target.value } : r))}
                                sx={{ flex: 2 }} />
                            <TextField size="small" label="تعداد" value={row.quantity} type="number"
                                onChange={(e) => setRows((p) => p.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))}
                                sx={{ flex: 1 }} slotProps={{ input: { inputProps: { min: 1 } } }} />
                            {rows.length > 1 && (
                                <IconButton size="small" color="error" onClick={() => setRows((p) => p.filter((_, j) => j !== i))}>
                                    <DeleteRoundedIcon fontSize="small" />
                                </IconButton>
                            )}
                        </Stack>
                    ))}
                    <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setRows((p) => [...p, { variant_id: "", quantity: "1" }])}>
                        افزودن واریانت
                    </Button>
                </Stack>
            </DialogContent>
            <Divider />
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>لغو</Button>
                <Button variant="contained" onClick={handleCreate} disabled={busy}>
                    {busy ? <CircularProgress size={16} /> : "ایجاد مرسوله"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── package details dialog (contents) ───────────────────────────────────────

interface PackageDetailItem {
    product_variant_id?: number;
    variant_id?: number;
    title?: string;
    quantity?: number;
    image?: string;
    dkpc?: number | string;
    price?: number;
}

function PackageDetailsDialog({ pkg, vendorId, onClose }: {
    pkg: PackageItem | null; vendorId: string; onClose: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<PackageDetailItem[]>([]);
    const [info, setInfo] = useState<Record<string, unknown> | null>(null);

    useEffect(() => {
        if (!pkg) return;
        const ctrl = new AbortController();
        setLoading(true);
        setError(null);
        setItems([]);
        setInfo(null);
        fetch(`/api/digikala/open-api/packages/${pkg.id}?vendorId=${encodeURIComponent(vendorId)}`, {
            credentials: "include", headers: { Accept: "application/json" }, signal: ctrl.signal,
        })
            .then(async (r) => {
                const json = await r.json().catch(() => null);
                if (!r.ok) throw new Error(json?.error || json?.data?.message || `خطای ${r.status}`);
                const raw = json?.data?.data ?? json?.data ?? {};
                // DGK detail shape: { items: { package_products: [...] }, meta_data: {...} }
                const meta = (raw?.meta_data ?? {}) as Record<string, unknown>;
                setInfo({ ...raw, ...meta });

                // The product list lives at items.package_products (an object, not
                // an array) — fall back to a few shapes seen across endpoints.
                const rawItems: any[] = (() => {
                    const pp = raw?.items?.package_products
                        ?? raw?.package_products
                        ?? (Array.isArray(raw?.items) ? raw.items : null)
                        ?? raw?.package_items ?? raw?.order_items ?? [];
                    return Array.isArray(pp) ? pp : [];
                })();
                setItems(rawItems.map((it) => {
                    const variant = (it.variant ?? it.product_variant ?? {}) as Record<string, unknown>;
                    const product = (it.product ?? variant.product ?? {}) as Record<string, unknown>;
                    const serials = Array.isArray(it.serials) ? it.serials : [];
                    // quantity: ordered for new packages, delivered for received ones
                    const qty = Number(it.ordered_count) || Number(it.delivered_count)
                        || Number(it.quantity) || serials.length || 1;
                    return {
                        product_variant_id: Number(it.dkpc ?? it.product_variant_id ?? variant.id ?? it.variant_id ?? 0),
                        variant_id: Number(it.dkpc ?? variant.id ?? it.variant_id ?? 0),
                        title: String(it.title ?? product.title_fa ?? variant.title ?? "") || undefined,
                        quantity: qty,
                        image: String(it.image ?? "") || undefined,
                        dkpc: (it.dkpc ?? variant.dkpc) as number | string | undefined,
                        price: Number(it.price ?? variant.price ?? 0) || undefined,
                    };
                }));
            })
            .catch((e) => {
                if (e instanceof DOMException && e.name === "AbortError") return;
                setError(e instanceof Error ? e.message : "خطا در بارگیری محتوای مرسوله");
            })
            .finally(() => setLoading(false));
        return () => ctrl.abort();
    }, [pkg, vendorId]);

    const totalQty = items.reduce((s, it) => s + (it.quantity ?? 0), 0);

    return (
        <Dialog open={Boolean(pkg)} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ position: "relative", pr: 6 }}>
                <Stack direction="row" alignItems="center" gap={1}>
                    <InventoryRoundedIcon fontSize="small" />
                    <span>محتوای مرسوله {pkg?.package_id || pkg?.id}</span>
                </Stack>
                <DialogCloseButton onClose={onClose} />
            </DialogTitle>
            <Divider />
            <DialogContent>
                {loading && <LinearProgress sx={{ mb: 2 }} />}
                {error && (
                    <Typography variant="body2" color="error.main" sx={{ py: 2 }}>{error}</Typography>
                )}
                {!loading && !error && (
                    <Stack spacing={1.5}>
                        <Stack direction="row" gap={1} flexWrap="wrap">
                            {pkg?.status_title && <Chip size="small" label={pkg.status_title} color={statusChip(pkg.status, pkg.status_title).color} />}
                            {pkg?.warehouse_name && <Chip size="small" variant="outlined" label={`انبار: ${pkg.warehouse_name}`} />}
                            <Chip size="small" variant="outlined" label={`${items.length.toLocaleString("fa-IR")} قلم — ${totalQty.toLocaleString("fa-IR")} عدد`} />
                            {Boolean(info?.package_number || info?.tracking_code) && <Chip size="small" variant="outlined" label={`پیگیری: ${String(info?.package_number ?? info?.tracking_code)}`} />}
                        </Stack>
                        <Divider />
                        {items.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                                قلمی برای این مرسوله یافت نشد
                            </Typography>
                        ) : (
                            <Stack spacing={1}>
                                {items.map((it, i) => (
                                    <Stack key={i} direction="row" gap={1.25} alignItems="center"
                                        sx={{ p: 1, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
                                        {it.image
                                            ? <Box component="img" src={it.image} width={48} height={48} sx={{ borderRadius: 1, flexShrink: 0, objectFit: "cover" }} />
                                            : <Box sx={{ width: 48, height: 48, borderRadius: 1, bgcolor: "action.hover", flexShrink: 0, display: "grid", placeItems: "center" }}>
                                                <InventoryRoundedIcon fontSize="small" color="disabled" />
                                            </Box>}
                                        <Stack flex={1} minWidth={0} spacing={0.25}>
                                            <Typography variant="body2" fontWeight={600} noWrap title={it.title}>
                                                {it.title || `واریانت ${it.product_variant_id}`}
                                            </Typography>
                                            <Stack direction="row" gap={1} flexWrap="wrap">
                                                {Boolean(it.dkpc) && <Typography variant="caption" color="text.secondary" fontFamily="monospace">DKPC: {String(it.dkpc)}</Typography>}
                                                {Boolean(it.price) && <Typography variant="caption" color="success.main">{Math.round(Number(it.price) / 10).toLocaleString("fa-IR")} ت</Typography>}
                                            </Stack>
                                        </Stack>
                                        <Chip size="small" color="primary" variant="outlined" label={`×${(it.quantity ?? 0).toLocaleString("fa-IR")}`} />
                                    </Stack>
                                ))}
                            </Stack>
                        )}
                    </Stack>
                )}
            </DialogContent>
            <Divider />
            <DialogActions>
                <Button onClick={onClose}>بستن</Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── main component ─────────────────────────────────────────────────────────

export default function PackagesSpec({ vendorId }: { vendorId: string }) {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<PackagesData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [detailPkg, setDetailPkg] = useState<PackageItem | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    function load() {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setError(null);
        fetch(`/api/digikala/open-api/packages?vendorId=${encodeURIComponent(vendorId)}&page=${page}&size=50`, {
            credentials: "include",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        })
            .then(async (r) => {
                const json = await r.json().catch(() => null);
                if (!r.ok) throw new Error(json?.error || json?.data?.message || `خطای ${r.status}`);
                const raw = json?.data?.data ?? json?.data ?? {};
                // DGK packages: status is {key,title}, warehouse is {id,title} — normalize
                const rawItems: Record<string, unknown>[] = raw?.items ?? [];
                const mapped: PackageItem[] = rawItems.map((it) => {
                    const status = it.status as Record<string, unknown> | string | undefined;
                    const statusKey = typeof status === "object" && status ? String(status.key ?? "") : String(status ?? "");
                    const statusTitle = typeof status === "object" && status ? String(status.title ?? "") : String(status ?? "");
                    const warehouse = it.warehouse as Record<string, unknown> | undefined;
                    const deliveryType = it.delivery_type as Record<string, unknown> | undefined;
                    return {
                        id: Number(it.package_id ?? 0),
                        package_id: String(it.hashed_package_id ?? it.hashedPackageId ?? it.package_number ?? ""),
                        status: statusKey || "unknown",
                        status_title: statusTitle,
                        created_at: String(it.created_at ?? ""),
                        updated_at: String(it.received_at ?? ""),
                        warehouse_id: typeof warehouse === "object" && warehouse ? Number(warehouse.id ?? 0) : 0,
                        warehouse_name: typeof warehouse === "object" && warehouse ? String(warehouse.title ?? "") : "",
                        shipment_type: typeof deliveryType === "object" && deliveryType ? String(deliveryType.title ?? "") : "",
                        tracking_code: String(it.package_number ?? ""),
                        items_count: 0,
                        items: [],
                    };
                });
                setResponse({ items: mapped, pager: raw?.pager });
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setError(err instanceof Error ? err.message : "خطا در بارگیری مرسوله‌ها");
                toast.error("خطا در بارگیری مرسوله‌های دیجی‌کالا");
            })
            .finally(() => { if (abortRef.current === controller) setLoading(false); });
    }

    useEffect(load, [page, vendorId]);
    useEffect(() => () => { abortRef.current?.abort(); }, []);

    async function handleDelete(pkg: PackageItem) {
        // Use numeric package_id for the API call (hashed ID doesn't work for DELETE)
        const pkgId = String(pkg.id);
        const displayId = pkg.tracking_code || pkg.package_id || pkgId;
        if (!window.confirm(`مرسوله ${displayId} حذف شود؟`)) return;
        setDeleting(pkg.id);
        try {
            const r = await fetch(`/api/digikala/open-api/packages/${pkgId}?vendorId=${encodeURIComponent(vendorId)}`, {
                method: "DELETE", credentials: "include",
            });
            const json = await r.json().catch(() => null);
            if (!r.ok) throw new Error(json?.error || json?.data?.message || `خطای ${r.status}`);
            toast.success("مرسوله حذف شد");
            setResponse((prev) => prev ? { ...prev, items: prev.items.filter((p) => p.id !== pkg.id) } : null);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "خطا در حذف مرسوله");
        } finally {
            setDeleting(null);
        }
    }

    const items = useMemo(() => {
        const all = response?.items ?? [];
        const term = deferredQuery.trim().toLowerCase();
        if (!term) return all;
        return all.filter((p) =>
            [String(p.id), p.package_id, p.tracking_code, p.warehouse_name, p.status, p.status_title]
                .some((s) => String(s ?? "").toLowerCase().includes(term))
        );
    }, [deferredQuery, response?.items]);

    const totalPages = Math.max(1, Number(response?.pager?.total_pages ?? 1));
    const totalRows = Number(response?.pager?.total_rows ?? response?.items?.length ?? 0);
    const isInitialLoading = loading && !response;

    return (
        <Container maxWidth={false} sx={{ my: 4, px: { xs: 1, md: 3 } }}>
            {loading && <LinearProgress />}

            <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between" gap={1.5} sx={{ mb: 1.5 }}>
                <Stack>
                    <Typography variant="h6" fontWeight={800}>مرسوله‌های دیجی‌کالا</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {totalRows.toLocaleString("fa-IR")} مرسوله — صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
                    </Typography>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems={{ xs: "stretch", sm: "center" }}>
                    <TextField
                        size="small" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="فیلتر: شناسه، کد پیگیری، انبار..."
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }}
                        sx={{ minWidth: { xs: "100%", sm: 280 } }}
                    />
                    <Button variant="contained" size="small" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}>
                        مرسوله جدید
                    </Button>
                    <RefreshButton disabled={loading} onClick={load} />
                </Stack>
            </Stack>

            {error && (
                <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                    <Button variant="outlined" color="error" size="small" disabled={loading} onClick={load}>تلاش دوباره</Button>
                </Stack>
            )}

            {isInitialLoading && (
                <Stack spacing={1}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Stack key={i} direction="row" gap={1.5} alignItems="center" sx={{ p: 1.25, border: 1, borderColor: "divider", borderRadius: 1 }}>
                            <Skeleton variant="rounded" width={40} height={40} />
                            <Stack flex={1} spacing={0.5}><Skeleton variant="text" width="50%" /><Skeleton variant="text" width="30%" /></Stack>
                            <Skeleton variant="rounded" width={100} height={28} />
                        </Stack>
                    ))}
                </Stack>
            )}

            <TableContainer sx={{ overflowX: "auto", border: 1, borderColor: "divider", borderRadius: 1, display: isInitialLoading ? "none" : "block" }}>
                <Table sx={{
                    minWidth: 780, width: "100%", tableLayout: "fixed",
                    "& th, & td": { whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word", verticalAlign: "top" },
                }}>
                    <TableHead>
                        <TableRow>
                            <TableCell width={40}>#</TableCell>
                            <TableCell width="18%">شناسه</TableCell>
                            <TableCell width="14%">وضعیت</TableCell>
                            <TableCell width="16%">انبار</TableCell>
                            <TableCell width="20%">کالاها</TableCell>
                            <TableCell width="16%">تاریخ</TableCell>
                            <TableCell width={110} align="center">عملیات</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.map((pkg, i) => {
                            const chip = statusChip(pkg.status, pkg.status_title);
                            const variantCount = pkg.items_count ?? pkg.items?.length ?? 0;
                            const isDeletable = !["sent", "received", "delivered"].includes(pkg.status);
                            return (
                                <TableRow key={pkg.id}>
                                    <TableCell>{i + 1 + (page - 1) * 50}</TableCell>
                                    <TableCell>
                                        <Stack spacing={0.25}>
                                            <Stack direction="row" alignItems="center" gap={0.5}>
                                                <Box component={InventoryRoundedIcon} fontSize="small" sx={{ color: "text.secondary" }} />
                                                <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                                                    {pkg.package_id || String(pkg.id)}
                                                </Typography>
                                            </Stack>
                                            {pkg.tracking_code && (
                                                <Typography variant="caption" color="text.secondary">پیگیری: {pkg.tracking_code}</Typography>
                                            )}
                                            {variantCount > 0 && (
                                                <Chip size="small" label={`${variantCount} قلم`} variant="outlined" sx={{ width: "fit-content" }} />
                                            )}
                                        </Stack>
                                    </TableCell>
                                    <TableCell><Chip size="small" label={chip.label} color={chip.color} /></TableCell>
                                    <TableCell>
                                        <Typography variant="body2">
                                            {pkg.warehouse_name || (pkg.warehouse_id ? `انبار ${pkg.warehouse_id}` : "—")}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        {pkg.items?.length ? (
                                            <Stack spacing={0.25}>
                                                {pkg.items.slice(0, 3).map((it, ii) => (
                                                    <Typography key={ii} variant="caption" color="text.secondary">
                                                        {it.title ?? `واریانت ${it.product_variant_id}`} ×{it.quantity}
                                                    </Typography>
                                                ))}
                                                {pkg.items.length > 3 && (
                                                    <Typography variant="caption" color="primary.main">
                                                        +{(pkg.items.length - 3).toLocaleString("fa-IR")} کالای دیگر
                                                    </Typography>
                                                )}
                                            </Stack>
                                        ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="caption" color="text.secondary">
                                            {pkg.created_at ? formatDate(pkg.created_at) : "—"}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Stack direction="row" gap={0.25} justifyContent="center">
                                            <Tooltip title="مشاهده محتوای مرسوله">
                                                <IconButton size="small" color="primary" onClick={() => setDetailPkg(pkg)}>
                                                    <VisibilityRoundedIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title={isDeletable ? "حذف مرسوله" : "مرسوله ارسال شده قابل حذف نیست"}>
                                                <span>
                                                    <IconButton size="small" color="error"
                                                        disabled={!isDeletable || deleting === pkg.id}
                                                        onClick={() => handleDelete(pkg)}>
                                                        {deleting === pkg.id
                                                            ? <CircularProgress size={16} color="error" />
                                                            : <DeleteRoundedIcon fontSize="small" />}
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {!isInitialLoading && !items.length && (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
                                    <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
                                        <Typography variant="subtitle2">مرسوله‌ای یافت نشد</Typography>
                                        <Button variant="outlined" size="small" disabled={loading} onClick={load}>تلاش دوباره</Button>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1.5} sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">مرسوله‌های ارسال‌شده قابل حذف نیستند</Typography>
                <Pagination page={page} count={totalPages} siblingCount={1} boundaryCount={1}
                    onChange={(_, n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
                <PageJumper pages={totalPages} onJump={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            </Stack>

            <CreatePackageDialog open={createOpen} vendorId={vendorId} onCreated={load} onClose={() => setCreateOpen(false)} />
            <PackageDetailsDialog pkg={detailPkg} vendorId={vendorId} onClose={() => setDetailPkg(null)} />
        </Container>
    );
}
