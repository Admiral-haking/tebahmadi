"use client";

import SearchBox from "@/components/search";
import ListFilterBar from "@/components/admin/list-filter-bar";
import AppPagination from "@/components/search/pagination";
import { Box, Button, Checkbox, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, InputAdornment, Stack, Switch, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { VariantResponse } from "./type";
import { Get, PATCH } from "@/utils/fetch";
import { toast } from "sonner";
import Link from "next/link";

import { RefreshButton } from "@/components/refresh";
import { normalizeStock } from "@/lib/stock";
import ZoomableImage from "@/components/zoomable-image";
import { ContentCopyRounded, PriceChange, TuneRounded } from "@mui/icons-material";
import MarketplaceControls, { MarketplaceBadges } from "./marketplace-controls";


type Props = {
    onSelect?: (v: VariantResponse) => any
    search?: string
}

type WithPage<T> = {
    data: T[]
    pagination: {
        page: number;
        limit: number;
        total: any;
        totalPages: number;
    }
}

export function VariantsView({ onSelect, search }: Props) {

    const [page, setPage] = useState(1);
    const [q, setQ] = useState(search || "")

    const [loading, setLoading] = useState(false);

    const [selectedVariant, setSelectedVariant] = useState<VariantResponse>();

    const [variants, setVariants] = useState<WithPage<VariantResponse>>({ data: [], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } });
    const [variantsHard, setVariantsHard] = useState<WithPage<VariantResponse>[]>([]);
    const [tab, setTab] = useState(0)

    const [sync, setSync] = useState(true);
    const [controlsId, setControlsId] = useState<string | null>(null);

    // ── Bulk selection (current page only) + group actions ────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkConfirm, setBulkConfirm] = useState<null | { active: boolean }>(null);

    // ── Comprehensive client-side filtering of the loaded page ────────────────
    const [searchText, setSearchText] = useState(search || "");
    const [facets, setFacets] = useState<Record<string, string[]>>({ active: [], stock: [], discount: [], connection: [] });
    const [ranges, setRanges] = useState<Record<string, { min: string; max: string }>>({ price: { min: "", max: "" }, discount: { min: "", max: "" } });

    // Debounce the free-text box into the server-side `q`.
    useEffect(() => {
        const h = setTimeout(() => { if (searchText.trim() !== q.trim()) setQ(searchText); }, 450);
        return () => clearTimeout(h);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchText]);

    function handleLoadInventory() {
        setLoading(true)
        Get(`/api/admin/catalog/variants${!!onSelect ? `/hard-search` : ''}?page=${page}&q=${q}`)
            .then(res => {
                if (!!onSelect) {
                    setTab(0)
                    return setVariantsHard(
                        sortVariantsAndDataByDisplayNameMatch(res, q?.split(" ").filter(x => x.length > 2) || [])
                            .filter(x => x.data.length)
                    )
                }
                setVariants(res);
            })
            .catch(() => toast.error("خطا در بارگیری تنوع محصولات"))
            .finally(() => setLoading(false));
    }

    function handlePatch(id: string, payload: any) {
        const variant = variants.data.find(x => x._id === id);
        const toastId = toast.loading(`در حال به روز رسانی ${variant?.displayName || "واریانت"}...`);
        PATCH(`/api/admin/catalog/variants/${id}`.concat(sync ? "?sync=true" : ""), payload)
            .then(() => {
                toast.success("تنوع محصول به روز رسانی شد");
                // Optimistic local update instead of re-fetching the whole page
                // (the full reload was what made each edit feel slow). When syncing,
                // a stock/price edit is pushed to every linked marketplace, so reflect
                // it on the dgk/snp/bsl badges immediately too.
                const syncStock = sync && payload.quantity !== undefined ? Number(payload.quantity) : undefined;
                const syncPrice = sync && payload.price !== undefined ? Number(payload.price) : undefined;
                const applyMarketplace = (recs: any[] | undefined): any =>
                    (syncStock === undefined && syncPrice === undefined) ? (recs ?? [])
                        : (recs ?? []).map((rec) => ({
                            ...rec,
                            ...(syncStock !== undefined ? { quantity: syncStock } : {}),
                            ...(syncPrice !== undefined ? { price: syncPrice } : {}),
                        }));
                setVariants(prev => ({
                    ...prev,
                    data: prev.data.map(v => v._id !== id ? v : {
                        ...v,
                        ...(payload.quantity !== undefined ? { inventory: { ...v.inventory, quantity: Number(payload.quantity) } } : {}),
                        ...(payload.price !== undefined ? { price: { ...v.price, amount: Number(payload.price) } } : {}),
                        ...(payload.offer !== undefined ? { offer: { ...v.offer, amount: Number(payload.offer) } } : {}),
                        ...(payload.active !== undefined ? { active: Boolean(payload.active) } : {}),
                        ...(payload.barcode !== undefined ? { barcode: String(payload.barcode) } : {}),
                        dgk: applyMarketplace(v.dgk),
                        snp: applyMarketplace(v.snp),
                        bsl: applyMarketplace(v.bsl),
                    }),
                }));
            })
            .catch(() => toast.error("خطا در بروزرسانی واریانت"))
            .finally(() => {
                toast.dismiss(toastId);
            });
    }

    useEffect(handleLoadInventory, [page, q]);

    const selectedVariantTab = !!onSelect ? (variantsHard[tab]?.data && variantsHard[tab]) || variants : variants

    // Apply the facet/range filters to the current page's rows (management mode).
    const displayData = useMemo(() => {
        if (onSelect) return selectedVariantTab.data;
        const { active = [], stock = [], discount = [], connection = [] } = facets;
        const pMin = ranges.price.min ? Number(ranges.price.min) : null;
        const pMax = ranges.price.max ? Number(ranges.price.max) : null;
        const dMin = ranges.discount.min ? Number(ranges.discount.min) : null;
        const dMax = ranges.discount.max ? Number(ranges.discount.max) : null;
        return selectedVariantTab.data.filter((v) => {
            if (active.length) {
                const isActive = v.active !== false;
                if (!active.some((a) => (a === "active" ? isActive : !isActive))) return false;
            }
            if (stock.length) {
                const inStock = (v.inventory?.quantity ?? 0) > 0;
                if (!stock.some((s) => (s === "instock" ? inStock : !inStock))) return false;
            }
            if (discount.length) {
                const hasOffer = (v.offer?.amount ?? 0) > 0;
                if (!discount.some((d) => (d === "has" ? hasOffer : !hasOffer))) return false;
            }
            if (connection.length) {
                const ok = connection.some((c) =>
                    c === "dgk" ? v.dgk?.length > 0
                        : c === "snp" ? v.snp?.length > 0
                            : c === "bsl" ? v.bsl?.length > 0
                                : c === "none" ? !(v.dgk?.length || v.snp?.length || v.bsl?.length) : false);
                if (!ok) return false;
            }
            const price = v.price?.amount ?? 0;
            if (pMin != null && price < pMin) return false;
            if (pMax != null && price > pMax) return false;
            const off = v.offer?.amount ?? 0;
            if (dMin != null && off < dMin) return false;
            if (dMax != null && off > dMax) return false;
            return true;
        });
    }, [onSelect, selectedVariantTab, facets, ranges]);

    useEffect(() => {
        setPage(1);
    }, [tab]);

    useEffect(() => {
        setPage(1);
    }, [q])

    // Reset the selection whenever the visible rows change (page/search/tab) so a
    // group action never runs on items the admin can no longer see.
    useEffect(() => { setSelectedIds(new Set()); }, [page, q, tab]);

    const selectableIds = displayData.map((v) => v._id);
    const selectedCount = selectableIds.filter((id) => selectedIds.has(id)).length;
    const allSelected = selectableIds.length > 0 && selectedCount === selectableIds.length;

    function toggleOne(id: string, checked: boolean) {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    }
    function toggleAll(checked: boolean) {
        setSelectedIds(checked ? new Set(selectableIds) : new Set());
    }

    async function applyBulkActive(active: boolean) {
        const ids = selectableIds.filter((id) => selectedIds.has(id));
        if (!ids.length) return;
        setBulkBusy(true);
        const toastId = toast.loading(`در حال ${active ? "فعال‌سازی" : "غیرفعال‌سازی"} ${ids.length.toLocaleString("fa-IR")} واریانت...`);
        try {
            const res = await PATCH(`/api/admin/catalog/variants/bulk`, { ids, active, sync });
            const r = res as { succeeded?: number; failed?: { id: string }[] };
            const ok = r.succeeded ?? 0;
            const fail = r.failed?.length ?? 0;
            // Optimistic local update for the ones that succeeded.
            setVariants((prev) => ({ ...prev, data: prev.data.map((v) => ids.includes(v._id) ? { ...v, active } : v) }));
            if (fail) toast.warning(`${ok.toLocaleString("fa-IR")} مورد انجام شد، ${fail.toLocaleString("fa-IR")} ناموفق`);
            else toast.success(`${ok.toLocaleString("fa-IR")} واریانت ${active ? "فعال" : "غیرفعال"} شد`);
            setSelectedIds(new Set());
        } catch {
            toast.error("خطا در اعمال گروهی");
        } finally {
            setBulkBusy(false);
            setBulkConfirm(null);
            toast.dismiss(toastId);
        }
    }

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {!onSelect && <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
                <Typography variant="h4">مدیریت تنوع محصول</Typography>
                <FormControlLabel
                    label="هنگام سازی"
                    control={<Switch checked={sync} onChange={(_, c) => setSync(c)} />}
                />
            </Stack>}

            {onSelect ? (
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
                    <SearchBox onSearch={setQ} alwaysShowSearch initialQuery={q} />
                    <RefreshButton onClick={handleLoadInventory} />
                </Stack>
            ) : (
                <ListFilterBar
                    search={searchText}
                    onSearchChange={setSearchText}
                    searchPlaceholder="جستجو: نام واریانت، کد محصول، بارکد..."
                    resultCount={displayData.length}
                    right={<RefreshButton onClick={handleLoadInventory} />}
                    onClear={() => {
                        setSearchText(""); setQ("");
                        setFacets({ active: [], stock: [], discount: [], connection: [] });
                        setRanges({ price: { min: "", max: "" }, discount: { min: "", max: "" } });
                    }}
                    onFacetChange={(key, values) => setFacets((p) => ({ ...p, [key]: values }))}
                    onRangeChange={(key, next) => setRanges((p) => ({ ...p, [key]: next }))}
                    facets={[
                        { key: "active", label: "وضعیت", value: facets.active, options: [
                            { value: "active", label: "فعال" }, { value: "inactive", label: "غیرفعال" },
                        ] },
                        { key: "stock", label: "موجودی", value: facets.stock, options: [
                            { value: "instock", label: "موجود" }, { value: "outofstock", label: "ناموجود" },
                        ] },
                        { key: "discount", label: "تخفیف", value: facets.discount, options: [
                            { value: "has", label: "تخفیف‌دار" }, { value: "none", label: "بدون تخفیف" },
                        ] },
                        { key: "connection", label: "اتصال به مارکت‌پلیس", value: facets.connection, options: [
                            { value: "dgk", label: "دیجی‌کالا" }, { value: "snp", label: "اسنپ‌شاپ" },
                            { value: "bsl", label: "باسلام" }, { value: "none", label: "بدون اتصال" },
                        ] },
                    ]}
                    ranges={[
                        { key: "price", label: "قیمت", min: ranges.price.min, max: ranges.price.max, unit: "تومان" },
                        { key: "discount", label: "مبلغ تخفیف", min: ranges.discount.min, max: ranges.discount.max, unit: "تومان" },
                    ]}
                />
            )}

            {!onSelect && selectedCount > 0 && (
                <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1}
                    sx={{ mb: 2, p: 1.25, borderRadius: 2, bgcolor: "action.selected", border: 1, borderColor: "divider" }}>
                    <Typography variant="body2" fontWeight={700}>{selectedCount.toLocaleString("fa-IR")} واریانت انتخاب شده</Typography>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                        <Button size="small" variant="contained" color="success" disabled={bulkBusy} onClick={() => applyBulkActive(true)}>فعال‌سازی گروهی</Button>
                        <Button size="small" variant="outlined" color="error" disabled={bulkBusy} onClick={() => setBulkConfirm({ active: false })}>غیرفعال‌سازی گروهی</Button>
                        <Button size="small" color="inherit" disabled={bulkBusy} onClick={() => setSelectedIds(new Set())}>لغو انتخاب</Button>
                    </Stack>
                </Stack>
            )}

            {
                !!onSelect && <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                    {
                        variantsHard.map((_, i) => <Tab
                            key={i}
                            label={`نتائج ${i + 1}`}
                            value={i}
                        />)
                    }
                </Tabs>
            }


            {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                    <CircularProgress />
                </Box>
            )}
            <TableContainer>
                <Table sx={{ minWidth: 1400 }}>

                    <TableHead>
                        <TableRow>
                            {!onSelect && (
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        size="small"
                                        checked={allSelected}
                                        indeterminate={selectedCount > 0 && !allSelected}
                                        disabled={selectableIds.length === 0}
                                        onChange={(e) => toggleAll(e.target.checked)}
                                        inputProps={{ "aria-label": "انتخاب همه" }}
                                    />
                                </TableCell>
                            )}
                            <TableCell width={10}>#</TableCell>
                            <TableCell>کالا</TableCell>
                            {
                                !onSelect && <>
                                    <TableCell>موجودی</TableCell>
                                    <TableCell>قیمت</TableCell>
                                    <TableCell>تخفیف</TableCell>
                                    <TableCell>وضعیت</TableCell>
                                    <TableCell>سرویس ها</TableCell>
                                </>
                            }
                            <TableCell>کد محصول</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {
                            displayData.map((item, i) => [<TableRow key={item._id + item.sku} selected={!onSelect && selectedIds.has(item._id)}>
                                {!onSelect && (
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            size="small"
                                            checked={selectedIds.has(item._id)}
                                            onChange={(e) => toggleOne(item._id, e.target.checked)}
                                            inputProps={{ "aria-label": `انتخاب ${item.displayName}` }}
                                        />
                                    </TableCell>
                                )}
                                <TableCell>{(i + 1) + ((page - 1) * 50)}</TableCell>
                                <TableCell>
                                    <Stack direction="row" alignItems="center" gap={1}>
                                        <ZoomableImage
                                            src={item.mediaIds?.[0] ? `/api/media/${item.mediaIds?.[0]}` : undefined}
                                            width={40}
                                            height={40}
                                            alt={item.displayName}
                                        />
                                        <Stack>
                                            <Typography color="text.primary" variant="caption" component={Link} target="_blank" href={`/product/${item.product.slug}`}>
                                                {item.displayName}
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                </TableCell>
                                {
                                    !onSelect && <>
                                        <TableCell>
                                            <TextField
                                                variant="standard"
                                                defaultValue={normalizeStock(item.inventory.quantity)}
                                                sx={{ maxWidth: 60 }}
                                                type="number"
                                                inputProps={{ min: 0 }}
                                                // Always sync on blur — even when the value is unchanged —
                                                // and never allow a negative number.
                                                onBlur={e => {
                                                    const next = normalizeStock(e.target.value);
                                                    e.target.value = String(next);
                                                    handlePatch(item._id, { quantity: next })
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                variant="standard"
                                                defaultValue={item.price.amount}
                                                sx={{ maxWidth: 150 }}
                                                type="number"
                                                onBlur={e => {
                                                    if (item.price.amount === Number(e.target.value)) return;
                                                    handlePatch(item._id, { price: Number(e.target.value) })
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                variant="standard"
                                                defaultValue={item.offer?.amount || 0}
                                                sx={{ maxWidth: 150 }}
                                                type="number"
                                                onBlur={e => {
                                                    if (item.offer?.amount === Number(e.target.value)) return;
                                                    handlePatch(item._id, { offer: Number(e.target.value) || 0 })
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title={item.active === false ? "غیرفعال — در سایت نمایش داده نمی‌شود" : "فعال"}>
                                                <FormControlLabel
                                                    sx={{ m: 0 }}
                                                    control={
                                                        <Switch
                                                            size="small"
                                                            color="success"
                                                            checked={item.active !== false}
                                                            onChange={(_, checked) => handlePatch(item._id, { active: checked })}
                                                        />
                                                    }
                                                    label={
                                                        <Typography variant="caption" color={item.active === false ? "text.secondary" : "success.main"}>
                                                            {item.active === false ? "غیرفعال" : "فعال"}
                                                        </Typography>
                                                    }
                                                />
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell>
                                            <MarketplaceBadges variant={item} />
                                        </TableCell>
                                    </>
                                }
                                <TableCell>
                                    {
                                        !onSelect ? <TextField
                                            variant="standard"
                                            defaultValue={item.barcode}
                                            sx={{ minWidth: 180, maxWidth: 240 }}
                                            onBlur={e => {
                                                if (e.target.value && e.target.value !== item.barcode) {
                                                    handlePatch(item._id, { barcode: e.target.value })
                                                }
                                            }}
                                            slotProps={{
                                                input: {
                                                    // Inline LTR so barcodes (e.g. 001-001352) show fully
                                                    // and aren't reversed by the RTL theme.
                                                    inputProps: { dir: "ltr", style: { direction: "ltr", textAlign: "left" } },
                                                    endAdornment: <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                window.navigator.clipboard.writeText(item.barcode)
                                                                    .then(() => toast.success("کد محصول کپی شد"))
                                                                    .catch(() => toast.error("کپی انجام نشد"))
                                                            }}>
                                                            <ContentCopyRounded fontSize="small" />
                                                        </IconButton>
                                                    </InputAdornment>
                                                }
                                            }}
                                        /> : <Chip label={item.barcode || "N/A"} sx={{ direction: "ltr" }} />
                                    }
                                </TableCell>
                                <TableCell align="right">
                                    {
                                        !onSelect ? <>
                                            <Tooltip title="ویرایش">
                                                <IconButton LinkComponent={Link} target="_blank" href={`/admin/catalog/products/save?id=${item.product._id}`} aria-label="edit product">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                                                        <circle cx={12} cy={12} r={10} fill="currentColor" opacity={0.5}></circle>
                                                        <path
                                                            fill="currentColor"
                                                            d="M13.926 14.302c.245-.191.467-.413.912-.858l5.54-5.54c.134-.134.073-.365-.106-.427a6.1 6.1 0 0 1-2.3-1.449a6.1 6.1 0 0 1-1.45-2.3c-.061-.18-.292-.24-.426-.106l-5.54 5.54c-.445.444-.667.667-.858.912a5 5 0 0 0-.577.932c-.133.28-.233.579-.431 1.175l-.257.77l-.409 1.226l-.382 1.148a.817.817 0 0 0 1.032 1.033l1.15-.383l1.224-.408l.77-.257c.597-.199.895-.298 1.175-.432q.498-.237.933-.576m8.187-8.132a3.028 3.028 0 0 0-4.282-4.283l-.179.178a.73.73 0 0 0-.206.651c.027.15.077.37.168.633a4.9 4.9 0 0 0 1.174 1.863a4.9 4.9 0 0 0 1.862 1.174c.263.09.483.141.633.168c.24.043.48-.035.652-.207z"
                                                        ></path>
                                                    </svg>
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="اصلاح قیمت">
                                                <IconButton aria-label="update-price-product" onClick={() => setSelectedVariant(item)}>
                                                    <PriceChange />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="کنترل جداگانهٔ مارکت‌پلیس‌ها">
                                                <IconButton
                                                    aria-label="marketplace-controls"
                                                    color={controlsId === item._id ? "primary" : "default"}
                                                    onClick={() => setControlsId((v) => v === item._id ? null : item._id)}
                                                >
                                                    <TuneRounded />
                                                </IconButton>
                                            </Tooltip>
                                        </>
                                            :
                                            <Button onClick={() => onSelect(item)}>
                                                اتصال
                                            </Button>
                                    }
                                </TableCell>
                            </TableRow>,
                            !onSelect && controlsId === item._id && (
                                <TableRow key={item._id + item.sku + "-controls"}>
                                    <TableCell colSpan={10} sx={{ bgcolor: "action.hover", py: 2 }}>
                                        <MarketplaceControls
                                            variant={item}
                                            onUpdated={(service, vendorId, barcode, patch) =>
                                                setVariants(prev => ({
                                                    ...prev,
                                                    data: prev.data.map(v => v._id !== item._id ? v : {
                                                        ...v,
                                                        [service]: (v[service] ?? []).map((rec: any) =>
                                                            (rec.vendorId === vendorId && (rec.barcode === barcode || !rec.barcode))
                                                                ? {
                                                                    ...rec,
                                                                    ...(patch.price !== undefined ? { price: patch.price } : {}),
                                                                    ...(patch.stock !== undefined ? { quantity: patch.stock } : {}),
                                                                }
                                                                : rec),
                                                    }),
                                                }))
                                            }
                                        />
                                    </TableCell>
                                </TableRow>
                            )])
                        }
                    </TableBody>
                </Table>
            </TableContainer>


            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 4 }}>
                <AppPagination page={page} pages={selectedVariantTab.pagination.totalPages} onChange={setPage} />
            </Stack>

            <Dialog
                open={!!selectedVariant}
                onClose={() => setSelectedVariant(undefined)}
                maxWidth="sm"
                fullWidth>
                <DialogTitle>اصلاح قیمت {selectedVariant?.displayName}</DialogTitle>
                <DialogContent>
                    <Stack gap={2} sx={{ py: 2 }}>
                        <TextField
                            label="قیمت سایت"
                            value={selectedVariant?.price.amount}
                        />
                        {
                            selectedVariant?.dgk.map(x => <TextField
                                key={`dgk-${x.dgkVariantId}`}
                                label={`قیمت دیجی کالا ${x.vendorId}`}
                                value={x.price}
                            />)
                        }
                        {
                            selectedVariant?.bsl.map(x => <TextField
                                key={`bsl-${x.bslProductId}-${x.bslVariantId}`}

                                label={`قیمت باسلام ${x.vendorId}`}
                                value={x.price}
                            />)
                        }
                        {
                            selectedVariant?.snp.map(x => <TextField
                                key={`snp-${x.snpProductId}`}

                                label={`قیمت اسنپ ${x.vendorId}`}
                                value={x.price}
                            />)
                        }
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelectedVariant(undefined)}>بازگشت</Button>
                    <Button variant="contained">
                        ذخیره
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm before a destructive group action (deactivation). */}
            <Dialog open={bulkConfirm !== null} onClose={() => !bulkBusy && setBulkConfirm(null)} maxWidth="xs" fullWidth>
                <DialogTitle>غیرفعال‌سازی گروهی</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        {selectedCount.toLocaleString("fa-IR")} واریانت غیرفعال می‌شوند و در سایت نمایش داده نخواهند شد. ادامه می‌دهید؟
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setBulkConfirm(null)} disabled={bulkBusy}>انصراف</Button>
                    <Button variant="contained" color="error" disabled={bulkBusy} onClick={() => applyBulkActive(false)}>
                        {bulkBusy ? <CircularProgress size={16} color="inherit" /> : "تأیید غیرفعال‌سازی"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}

function sortVariantsAndDataByDisplayNameMatch(
    variants: WithPage<VariantResponse>[],
    searchStrings: string[]
): WithPage<VariantResponse>[] {
    // Create a deep copy to avoid mutating the original array
    const sortedVariants = JSON.parse(JSON.stringify(variants));

    // Helper function to count matches in a displayName
    const countMatches = (displayName: string): number => {
        const lowerDisplayName = displayName.toLowerCase();
        return searchStrings.filter(searchString =>
            lowerDisplayName.includes(searchString.toLowerCase())
        ).length;
    };

    // Step 1: Sort data items within each variant by match count (descending)
    sortedVariants.forEach((variant: WithPage<VariantResponse>) => {
        variant.data.sort((a: VariantResponse, b: VariantResponse) => {
            const matchesA = countMatches(a.displayName);
            const matchesB = countMatches(b.displayName);

            // Sort by match count (higher first)
            if (matchesA !== matchesB) {
                return matchesB - matchesA;
            }

            // If match counts are equal, sort alphabetically by displayName
            return a.displayName.localeCompare(b.displayName);
        });
    });

    // Step 2: Sort variants based on the highest match count from their data array
    sortedVariants.sort((a: WithPage<VariantResponse>, b: WithPage<VariantResponse>) => {
        // Get the highest match count from each variant's data array
        const maxMatchesA = Math.max(...a.data.map(item => countMatches(item.displayName)));
        const maxMatchesB = Math.max(...b.data.map(item => countMatches(item.displayName)));

        // Sort by highest match count (descending)
        if (maxMatchesA !== maxMatchesB) {
            return maxMatchesB - maxMatchesA;
        }

        // If highest match counts are equal, compare total matches across all items
        const totalMatchesA = a.data.reduce((sum, item) => sum + countMatches(item.displayName), 0);
        const totalMatchesB = b.data.reduce((sum, item) => sum + countMatches(item.displayName), 0);

        if (totalMatchesA !== totalMatchesB) {
            return totalMatchesB - totalMatchesA;
        }

        // If still equal, sort by the highest displayName alphabetically
        const bestDisplayNameA = a.data[0]?.displayName || '';
        const bestDisplayNameB = b.data[0]?.displayName || '';
        return bestDisplayNameA.localeCompare(bestDisplayNameB);
    });

    return sortedVariants;
}