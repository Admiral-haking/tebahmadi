import { DgkInventoryResponse } from "@/digikala/services/inventory";
import { RefreshButton } from "@/components/refresh";
import {
    Box, Button, Checkbox, Chip, CircularProgress, Container, Dialog, DialogActions,
    DialogContent, DialogTitle, FormControlLabel,
    LinearProgress, Pagination, Paper, Skeleton, Stack, Switch, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import DialogCloseButton from "./dialog-close-button";
import ListFilterBar from "@/components/admin/list-filter-bar";
import { PageJumper } from "@/components/search/pagination";
import ZoomableImage from "@/components/zoomable-image";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type InventoryItem = DgkInventoryResponse["items"][number];

// ─── Inline stock edit cell ──────────────────────────────────────────────────

function StockCell({
    item,
    vendorId,
    onUpdated,
}: {
    item: InventoryItem;
    vendorId: string;
    onUpdated: (variantId: number, newStock: number) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(String(item.marketplace_seller_stock));
    const [saving, setSaving] = useState(false);

    function handleSave() {
        const stock = Number(value);
        if (isNaN(stock) || stock < 0) { toast.error("موجودی نامعتبر"); return; }
        setSaving(true);
        fetch(`/api/digikala/open-api/variants/${item.product_variant_id}/seller-stock?vendorId=${encodeURIComponent(vendorId)}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ seller_stock: stock }),
        })
            .then(async (r) => {
                if (!r.ok) {
                    const json = await r.json().catch(() => ({})) as { error?: string };
                    throw new Error(json?.error || `خطای ${r.status}`);
                }
                toast.success("موجودی آپدیت شد");
                onUpdated(item.product_variant_id, stock);
                setEditing(false);
            })
            .catch((err) => toast.error(err instanceof Error ? err.message : "خطا در آپدیت موجودی"))
            .finally(() => setSaving(false));
    }

    function handleCancel() {
        setValue(String(item.marketplace_seller_stock));
        setEditing(false);
    }

    if (editing) {
        return (
            <Stack direction="row" gap={0.5} alignItems="center">
                <TextField
                    size="small"
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
                    slotProps={{ htmlInput: { min: 0, step: 1, style: { width: 60 } } }}
                    autoFocus
                    disabled={saving}
                />
                {saving
                    ? <CircularProgress size={18} />
                    : (
                        <>
                            <Tooltip title="ذخیره">
                                <Button size="small" sx={{ minWidth: 0, p: 0.5 }} color="success" onClick={handleSave}>
                                    <CheckRoundedIcon fontSize="small" />
                                </Button>
                            </Tooltip>
                            <Tooltip title="لغو">
                                <Button size="small" sx={{ minWidth: 0, p: 0.5 }} color="error" onClick={handleCancel}>
                                    <CloseRoundedIcon fontSize="small" />
                                </Button>
                            </Tooltip>
                        </>
                    )
                }
            </Stack>
        );
    }

    const dgkStock = item.marketplace_seller_stock;
    const siteStock = item.match?.quantity;
    const mismatch = siteStock != null && siteStock !== dgkStock;

    return (
        <Stack direction="row" gap={0.5} alignItems="center">
            <Stack direction="row" gap={0.5}>
                {mismatch ? (
                    <>
                        <Tooltip title="موجودی سایت شما">
                            <Chip size="small" label={`سایت: ${siteStock}`} color="warning" />
                        </Tooltip>
                        <Tooltip title="موجودی دیجی‌کالا">
                            <Chip size="small" label={`DGK: ${dgkStock}`} color="secondary" variant="outlined" />
                        </Tooltip>
                    </>
                ) : (
                    <Chip size="small" label={dgkStock} color="success" />
                )}
            </Stack>
            <Tooltip title="ویرایش موجودی">
                <Button size="small" sx={{ minWidth: 0, p: 0.5 }} onClick={() => { setValue(String(dgkStock)); setEditing(true); }}>
                    <EditRoundedIcon fontSize="small" />
                </Button>
            </Tooltip>
        </Stack>
    );
}

// ─── Stock-diff badge (site/warehouse vs Digikala) ───────────────────────────

/**
 * Color-coded comparison between the site/warehouse quantity and the Digikala
 * seller stock:
 *   ✓ green   — equal
 *   ▴ orange  — warehouse has more than Digikala (DGK under-stocked)
 *   ▾ yellow  — seller (DGK) has more than warehouse (over-listed)
 */
function StockDiffBadge({ warehouse, dgk }: { warehouse?: number | null; dgk: number }) {
    if (warehouse == null) {
        return <Typography variant="caption" color="text.secondary">—</Typography>;
    }
    const diff = warehouse - dgk;
    const equal = diff === 0;
    const warehouseMore = diff > 0;

    const color: "success" | "warning" | undefined = equal
        ? "success"
        : warehouseMore
            ? "warning"
            : undefined; // seller-more uses custom yellow sx below
    const icon = equal ? "✓" : warehouseMore ? "▴" : "▾";
    const tip = equal
        ? "موجودی انبار و دیجی‌کالا برابر است"
        : warehouseMore
            ? `انبار ${Math.abs(diff).toLocaleString("fa-IR")} عدد بیشتر از دیجی‌کالا دارد`
            : `دیجی‌کالا ${Math.abs(diff).toLocaleString("fa-IR")} عدد بیشتر از انبار دارد`;

    return (
        <Tooltip title={tip}>
            <Chip
                size="small"
                color={color}
                variant={equal ? "filled" : "outlined"}
                sx={!equal && !warehouseMore ? { bgcolor: "rgba(var(--mui-palette-warning-mainChannel) / 0.15)", color: "var(--mui-palette-warning-dark)", borderColor: "var(--mui-palette-warning-main)" } : undefined}
                label={`${icon} انبار: ${warehouse.toLocaleString("fa-IR")}`}
            />
        </Tooltip>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Inventory({ vendorId }: { vendorId: string }) {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<DgkInventoryResponse>();
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const abortRef = useRef<AbortController | null>(null);
    const [page, setPage] = useState(1);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);

    const [facets, setFacets] = useState<Record<string, string[]>>({ diff: [], match: [], stock: [] });

    // ── Bulk selection + group stock (sync-to-warehouse / set-same) ───────────
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkDialog, setBulkDialog] = useState(false);
    const [bulkVal, setBulkVal] = useState("");
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkDone, setBulkDone] = useState(0);

    const handleLoadInventory = useCallback(
        (silent = false) => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            if (!silent) setLoading(true);
            setError(null);
            fetch(`/api/digikala/inventory?vendorId=${encodeURIComponent(vendorId)}&page=${page}`, {
                credentials: "include",
                headers: { Accept: "application/json" },
                cache: "no-store", // avoid stale inventory ("یبنک"/lag)
                signal: controller.signal,
            })
                .then(async (r) => {
                    if (!r.ok) throw new Error(await r.text());
                    return r.json() as Promise<DgkInventoryResponse>;
                })
                .then((res) => { setResponse(res); setLastUpdated(Date.now()); })
                .catch((err) => {
                    if (err instanceof DOMException && err.name === "AbortError") return;
                    setError("خطا در بارگیری موجودی دیجی کالا");
                    if (!silent) toast.error("خطا در بارگیری موجودی دیجی کالا");
                })
                .finally(() => { if (abortRef.current === controller) setLoading(false); });
        },
        [page, vendorId],
    );

    useEffect(() => { handleLoadInventory(); }, [handleLoadInventory]);
    useEffect(() => () => { abortRef.current?.abort(); }, []);

    // Auto-refresh every 30s when enabled (silent — no spinner/toast churn).
    useEffect(() => {
        if (!autoRefresh) return;
        const id = setInterval(() => handleLoadInventory(true), 30_000);
        return () => clearInterval(id);
    }, [autoRefresh, handleLoadInventory]);

    function handleStockUpdated(variantId: number, newStock: number) {
        setResponse((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                items: prev.items.map((it) =>
                    it.product_variant_id === variantId
                        ? { ...it, marketplace_seller_stock: newStock }
                        : it
                ),
            };
        });
    }

    const filteredItems = useMemo(() => {
        const items = response?.items ?? [];
        const term = deferredQuery.trim().toLowerCase();
        const { diff = [], match = [], stock = [] } = facets;
        return items.filter((item) => {
            if (term && ![item.title, item.supplier_code, String(item.product_id ?? ""), String(item.product_variant_id ?? ""),
                item.match?.displayName, item.match?.barcode, item.match?.sku]
                .some((v) => String(v ?? "").toLowerCase().includes(term))) return false;
            if (diff.length) {
                const isMismatch = item.match != null && item.match.quantity !== item.marketplace_seller_stock;
                const ok = diff.some((d) => (d === "mismatch" ? isMismatch : d === "equal" ? !isMismatch : true));
                if (!ok) return false;
            }
            if (match.length) {
                const matched = item.match != null;
                const ok = match.some((m) => (m === "matched" ? matched : !matched));
                if (!ok) return false;
            }
            if (stock.length) {
                const inStock = (item.marketplace_seller_stock ?? 0) > 0;
                const ok = stock.some((s) => (s === "instock" ? inStock : !inStock));
                if (!ok) return false;
            }
            return true;
        });
    }, [deferredQuery, response?.items, facets]);

    const selectableIds = useMemo(() => filteredItems.map((it) => it.product_variant_id), [filteredItems]);
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

    async function patchStock(variantId: number, stock: number) {
        const r = await fetch(`/api/digikala/open-api/variants/${variantId}/seller-stock?vendorId=${encodeURIComponent(vendorId)}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ seller_stock: stock }),
        });
        if (!r.ok) throw new Error(await r.text().catch(() => ""));
    }

    // mode "sync" → set DGK stock to the matched site/warehouse quantity per row;
    // mode "same" → set one value (bulkVal) on every selected row.
    async function applyBulk(mode: "sync" | "same") {
        const chosen = (response?.items ?? []).filter((it) => selected.has(it.product_variant_id) && selectableIds.includes(it.product_variant_id));
        let target = chosen;
        let sameVal = 0;
        if (mode === "same") {
            sameVal = parseInt(bulkVal, 10);
            if (!Number.isFinite(sameVal) || sameVal < 0) { toast.error("موجودی معتبر وارد کنید"); return; }
        } else {
            // Only rows that have a matched site quantity can be synced.
            target = chosen.filter((it) => it.match && Number.isFinite(Number(it.match.quantity)));
            if (!target.length) { toast.error("ردیف انتخاب‌شده‌ای با تطبیق انبار وجود ندارد"); return; }
        }
        setBulkBusy(true);
        setBulkDone(0);
        let ok = 0; let fail = 0;
        for (const it of target) {
            const value = mode === "same" ? sameVal : Math.max(0, Number(it.match?.quantity ?? 0));
            try {
                await patchStock(it.product_variant_id, value);
                handleStockUpdated(it.product_variant_id, value);
                ok += 1;
            } catch {
                fail += 1;
            }
            setBulkDone((d) => d + 1);
        }
        setBulkBusy(false);
        if (fail) toast.warning(`${ok.toLocaleString("fa-IR")} ردیف بروز شد، ${fail.toLocaleString("fa-IR")} ناموفق`);
        else toast.success(`${ok.toLocaleString("fa-IR")} ردیف بروز شد`);
        if (!fail) { setBulkDialog(false); setBulkVal(""); setSelected(new Set()); }
    }

    const totalRows = Number(response?.pager.total_rows ?? response?.items.length ?? 0);
    const totalPages = Math.max(1, Number(response?.pager.total_pages ?? 1));
    const pageSize = Number(response?.pager.item_per_page ?? 50);
    const isInitialLoading = loading && !response;

    const mismatchCount = useMemo(() =>
        (response?.items ?? []).filter((it) => it.match != null && it.match.quantity !== it.marketplace_seller_stock).length,
        [response?.items]
    );

    return (
        <Container maxWidth="lg" sx={{ my: 4 }}>
            {loading && <LinearProgress />}

            <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, mb: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
                <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between" gap={1.5}>
                    <Stack>
                        <Stack direction="row" gap={1} alignItems="center">
                            <Typography variant="h6" fontWeight={800}>موجودی‌های دیجی‌کالا</Typography>
                            {mismatchCount > 0 && (
                                <Chip size="small" label={`${mismatchCount} اختلاف`} color="warning" />
                            )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                            {totalRows.toLocaleString("fa-IR")} ردیف · صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}
                        </Typography>
                    </Stack>
                    <Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems={{ xs: "stretch", sm: "center" }}>
                        <FormControlLabel
                            sx={{ m: 0 }}
                            control={
                                <Switch size="small" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                            }
                            label={<Typography variant="caption">بروزرسانی خودکار</Typography>}
                        />
                        <RefreshButton disabled={loading} onClick={() => handleLoadInventory()} />
                    </Stack>
                </Stack>
                {lastUpdated && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                        آخرین بروزرسانی:{" "}
                        {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(lastUpdated))}
                        {autoRefresh && " · هر ۳۰ ثانیه"}
                    </Typography>
                )}
            </Paper>

            <ListFilterBar
                search={query}
                onSearchChange={setQuery}
                searchPlaceholder="فیلتر: عنوان، بارکد، کد کالا..."
                resultCount={filteredItems.length}
                onClear={() => { setQuery(""); setFacets({ diff: [], match: [], stock: [] }); }}
                onFacetChange={(key, values) => setFacets((p) => ({ ...p, [key]: values }))}
                facets={[
                    { key: "diff", label: "تطبیق انبار", value: facets.diff, options: [
                        { value: "mismatch", label: "مغایر با انبار" }, { value: "equal", label: "برابر" },
                    ] },
                    { key: "match", label: "اتصال سایت", value: facets.match, options: [
                        { value: "matched", label: "متصل به سایت" }, { value: "unmatched", label: "بدون اتصال" },
                    ] },
                    { key: "stock", label: "موجودی", value: facets.stock, options: [
                        { value: "instock", label: "موجود" }, { value: "outofstock", label: "ناموجود" },
                    ] },
                ]}
            />

            {selectedCount > 0 && (
                <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 1.25, borderRadius: 2, bgcolor: "action.selected", border: 1, borderColor: "divider" }}>
                    <Typography variant="body2" fontWeight={700}>
                        {selectedCount.toLocaleString("fa-IR")} ردیف انتخاب شده
                    </Typography>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                        <Tooltip title="موجودی دیجی‌کالا را برابر موجودی انبار سایت قرار می‌دهد">
                            <span>
                                <Button size="small" variant="contained" disabled={bulkBusy} onClick={() => applyBulk("sync")}>
                                    {bulkBusy ? <CircularProgress size={16} /> : "همگام‌سازی با انبار"}
                                </Button>
                            </span>
                        </Tooltip>
                        <Button size="small" variant="outlined" disabled={bulkBusy} onClick={() => { setBulkVal(""); setBulkDialog(true); }}>تنظیم موجودی یکسان</Button>
                        <Button size="small" color="inherit" disabled={bulkBusy} onClick={() => setSelected(new Set())}>لغو انتخاب</Button>
                    </Stack>
                </Stack>
            )}

            {error && (
                <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 2, border: 1, borderColor: "error.light", borderRadius: 2, bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.08)" }}>
                    <Typography variant="body2" color="error.main">{error}</Typography>
                    <Button variant="outlined" color="error" disabled={loading} onClick={() => handleLoadInventory()}>تلاش دوباره</Button>
                </Stack>
            )}

            {isInitialLoading && (
                <Stack spacing={1} sx={{ mb: 2 }}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Paper key={i} elevation={0} sx={{ p: 1.25, border: 1, borderColor: "divider", borderRadius: 2 }}>
                            <Stack direction="row" gap={1.5} alignItems="center">
                                <Skeleton variant="rounded" width={48} height={48} />
                                <Stack flex={1} spacing={0.75}>
                                    <Skeleton variant="text" width="56%" />
                                    <Skeleton variant="text" width="34%" />
                                </Stack>
                                <Skeleton variant="rounded" width={120} height={32} />
                            </Stack>
                        </Paper>
                    ))}
                </Stack>
            )}

            <TableContainer sx={{ overflowX: "auto", border: 1, borderColor: "divider", borderRadius: 2, display: isInitialLoading ? "none" : "block" }}>
                <Table sx={{ minWidth: 1000 }}>
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
                            <TableCell>موجودی</TableCell>
                            <TableCell align="center">انبار</TableCell>
                            <TableCell>کد محصول</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredItems.map((item, i) => (
                            <TableRow key={item.product_variant_id} selected={selected.has(item.product_variant_id)}>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        size="small"
                                        checked={selected.has(item.product_variant_id)}
                                        onChange={(e) => toggleOne(item.product_variant_id, e.target.checked)}
                                        inputProps={{ "aria-label": `انتخاب ${item.title}` }}
                                    />
                                </TableCell>
                                <TableCell>{(i + 1) + ((page - 1) * pageSize)}</TableCell>
                                <TableCell>
                                    <Stack direction="row" alignItems="center" gap={1}>
                                        <ZoomableImage
                                            src={item.match?.mediaId ? `/api/media/${item.match.mediaId}` : item.img_src}
                                            width={40}
                                            height={40}
                                            alt={item.title}
                                        />
                                        <Stack>
                                            <Typography variant="body2" component={Link} target="_blank" href={item.product_url}
                                                sx={{ color: "inherit", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}>
                                                {item.title}
                                            </Typography>
                                            {item.match && (
                                                <Typography variant="caption" color="text.secondary" component={Link} target="_blank" href={`/product/${item.match.slug}`}>
                                                    {item.match.displayName}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Stack>
                                </TableCell>
                                <TableCell>
                                    <StockCell item={item} vendorId={vendorId} onUpdated={handleStockUpdated} />
                                </TableCell>
                                <TableCell align="center">
                                    <StockDiffBadge
                                        warehouse={item.match?.quantity ?? item.warehouse_stock}
                                        dgk={Number(item.marketplace_seller_stock ?? 0)}
                                    />
                                </TableCell>
                                <TableCell>{item.supplier_code || "N/A"}</TableCell>
                            </TableRow>
                        ))}
                        {!loading && response && response.items.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6}>
                                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>
                                        موجودی‌ای برای نمایش دریافت نشد.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && response && response.items.length > 0 && filteredItems.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6}>
                                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>
                                        برای فیلتر «{query}» نتیجه‌ای پیدا نشد.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" gap={1.5} sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    روی آیکون ✏️ هر ردیف کلیک کنید تا موجودی را مستقیماً ویرایش کنید.
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

            {/* Set the same stock value on every selected row. */}
            <Dialog open={bulkDialog} onClose={() => !bulkBusy && setBulkDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ position: "relative", pr: 6 }}>
                    موجودی گروهی
                    <DialogCloseButton onClose={() => setBulkDialog(false)} disabled={bulkBusy} />
                </DialogTitle>
                <DialogContent>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                        روی {selectedCount.toLocaleString("fa-IR")} ردیف انتخاب‌شده اعمال می‌شود.
                    </Typography>
                    <Stack spacing={2}>
                        <TextField
                            fullWidth size="small" type="number" label="موجودی جدید برای همه"
                            value={bulkVal} onChange={(e) => setBulkVal(e.target.value)}
                            slotProps={{ input: { inputProps: { min: 0, step: 1 } } }}
                            autoFocus disabled={bulkBusy}
                        />
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
                    <Button onClick={() => setBulkDialog(false)} disabled={bulkBusy}>لغو</Button>
                    <Button variant="contained" onClick={() => applyBulk("same")} disabled={bulkBusy}>
                        {bulkBusy ? <CircularProgress size={16} /> : "اعمال روی همه"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}
