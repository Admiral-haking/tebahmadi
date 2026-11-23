"use client";

import { RefreshButton } from "@/components/refresh";
import JalaliDateField from "@/components/jalali-date-field";
import {
    Box, Button, Chip, CircularProgress, Container, Dialog,
    DialogActions, DialogContent, DialogTitle, Divider,
    IconButton, InputAdornment, LinearProgress, Pagination,
    Skeleton, Stack, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";

interface DkShipment {
    id: number;
    shipment_id?: string | number;
    status: string;
    status_title?: string;
    created_at: string;
    pickup_time?: string;
    city_id?: number;
    city_title?: string;
    time_scope_id?: number;
    time_scope_title?: string;
    box_size_id?: number;
    packages_count?: number;
    packages?: { package_id: string | number }[];
    label_url?: string;
    cancellable?: boolean;
}

interface DkShipmentsData {
    pager?: { page: number; item_per_page: number; total_pages: number; total_rows: number };
    items: DkShipment[];
}

const STATUS_LABEL: Record<string, { label: string; color: "default" | "info" | "success" | "warning" | "error" | "primary" }> = {
    pending: { label: "در انتظار", color: "warning" },
    scheduled: { label: "برنامه‌ریزی شده", color: "info" },
    picked: { label: "تحویل گرفته شد", color: "success" },
    cancelled: { label: "لغو شده", color: "error" },
    completed: { label: "تکمیل شده", color: "success" },
    created: { label: "ایجاد شده", color: "info" },
};

function formatDate(iso?: string) {
    if (!iso) return "—";
    try {
        return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch { return iso; }
}

// ─── create shipment dialog ──────────────────────────────────────────────────

function CreateShipmentDialog({ open, vendorId, onCreated, onClose }: {
    open: boolean; vendorId: string; onCreated: () => void; onClose: () => void;
}) {
    const [packageIds, setPackageIds] = useState("");
    const [warehouseId, setWarehouseId] = useState("");
    const [pickupDate, setPickupDate] = useState("");
    const [timeScope, setTimeScope] = useState("");
    const [busy, setBusy] = useState(false);

    async function handleCreate() {
        const pkgList = packageIds.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
        if (!pkgList.length) { toast.error("حداقل یک شناسه بسته وارد کنید"); return; }

        setBusy(true);
        try {
            // Per the DK Open API: { package_ids:[...], warehouse_id?, pickup_date?
            // (ISO), time_scope? ("10-12") }.
            const body: Record<string, unknown> = { package_ids: pkgList };
            if (Number(warehouseId)) body.warehouse_id = Number(warehouseId);
            if (pickupDate) body.pickup_date = new Date(pickupDate).toISOString();
            if (timeScope.trim()) body.time_scope = timeScope.trim();

            const r = await fetch(`/api/digikala/open-api/shipments/dk?vendorId=${encodeURIComponent(vendorId)}`, {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = await r.json().catch(() => null);
            if (!r.ok) throw new Error(json?.error || json?.data?.message || `خطای ${r.status}`);
            toast.success("بارنامه DK ایجاد شد");
            onCreated();
            onClose();
            setPackageIds(""); setWarehouseId(""); setPickupDate(""); setTimeScope("");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "خطا در ایجاد بارنامه");
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ position: "relative", pr: 6 }}>
                ایجاد بارنامه DK جدید
                <DialogCloseButton onClose={onClose} />
            </DialogTitle>
            <Divider />
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField size="small" label="شناسه بسته‌ها (package_ids)" value={packageIds}
                        onChange={(e) => setPackageIds(e.target.value)} fullWidth
                        helperText="با ویرگول جدا کنید: 123, 456, 789" />
                    <TextField size="small" label="شناسه انبار (اختیاری)" value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)} type="number" fullWidth
                        helperText="warehouse_id — انبار مبدأ" />
                    <JalaliDateField size="small" label="تاریخ جمع‌آوری (اختیاری)" value={pickupDate}
                        onChange={setPickupDate} withTime fullWidth />
                    <TextField size="small" label="بازه ساعتی (اختیاری)" value={timeScope}
                        onChange={(e) => setTimeScope(e.target.value)} fullWidth
                        helperText="مثلاً: 10-12" />
                </Stack>
            </DialogContent>
            <Divider />
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>لغو</Button>
                <Button variant="contained" onClick={handleCreate} disabled={busy}>
                    {busy ? <CircularProgress size={16} /> : "ایجاد مرسله"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── main component ─────────────────────────────────────────────────────────

export default function DkShipments({ vendorId }: { vendorId: string }) {
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState<DkShipmentsData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    function load() {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        setError(null);
        fetch(`/api/digikala/open-api/shipments/dk?vendorId=${encodeURIComponent(vendorId)}&page=${page}&size=50`, {
            credentials: "include",
            headers: { Accept: "application/json" },
            signal: controller.signal,
        })
            .then(async (r) => {
                const json = await r.json().catch(() => null);
                if (!r.ok) throw new Error(json?.error || json?.data?.message || `خطای ${r.status}`);
                setResponse(json?.data?.data ?? null);
            })
            .catch((err) => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setError(err instanceof Error ? err.message : "خطا در بارگیری مرسله‌های DK");
                toast.error("خطا در بارگیری مرسله‌های DK دیجی‌کالا");
            })
            .finally(() => { if (abortRef.current === controller) setLoading(false); });
    }

    useEffect(load, [page, vendorId]);
    useEffect(() => () => { abortRef.current?.abort(); }, []);

    async function handleDelete(shipment: DkShipment) {
        const shipId = shipment.shipment_id ?? shipment.id;
        if (!window.confirm(`مرسله DK شماره ${shipId} حذف شود؟`)) return;
        setDeleting(shipment.id);
        try {
            const r = await fetch(`/api/digikala/open-api/shipments/dk/${shipId}?vendorId=${encodeURIComponent(vendorId)}`, {
                method: "DELETE", credentials: "include",
            });
            const json = await r.json().catch(() => null);
            if (!r.ok) throw new Error(json?.error || json?.data?.message || `خطای ${r.status}`);
            toast.success("مرسله DK حذف شد");
            setResponse((prev) => prev ? { ...prev, items: prev.items.filter((s) => s.id !== shipment.id) } : null);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "خطا در حذف مرسله DK");
        } finally {
            setDeleting(null);
        }
    }

    const items = useMemo(() => {
        const all = response?.items ?? [];
        const term = deferredQuery.trim().toLowerCase();
        if (!term) return all;
        return all.filter((s) =>
            [String(s.id), String(s.shipment_id), s.status, s.city_title, s.time_scope_title]
                .some((v) => String(v ?? "").toLowerCase().includes(term))
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
                    <Typography variant="h6" fontWeight={800}>مرسله‌های DK دیجی‌کالا</Typography>
                    <Typography variant="caption" color="text.secondary">
                        تحویل کالا به دیجی‌کالا — {totalRows.toLocaleString("fa-IR")} مرسله
                    </Typography>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} gap={1} alignItems={{ xs: "stretch", sm: "center" }}>
                    <TextField
                        size="small" value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="فیلتر: شناسه، وضعیت، شهر..."
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> } }}
                        sx={{ minWidth: { xs: "100%", sm: 260 } }}
                    />
                    <Button variant="contained" size="small" startIcon={<AddRoundedIcon />} onClick={() => setCreateOpen(true)}>
                        مرسله DK جدید
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
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Stack key={i} direction="row" gap={1.5} alignItems="center" sx={{ p: 1.25, border: 1, borderColor: "divider", borderRadius: 1 }}>
                            <Skeleton variant="rounded" width={36} height={36} />
                            <Stack flex={1} spacing={0.5}><Skeleton variant="text" width="45%" /><Skeleton variant="text" width="28%" /></Stack>
                            <Skeleton variant="rounded" width={90} height={28} />
                        </Stack>
                    ))}
                </Stack>
            )}

            <TableContainer sx={{ overflowX: "auto", border: 1, borderColor: "divider", borderRadius: 1, display: isInitialLoading ? "none" : "block" }}>
                <Table sx={{
                    minWidth: 720, width: "100%", tableLayout: "fixed",
                    "& th, & td": { whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word", verticalAlign: "top" },
                }}>
                    <TableHead>
                        <TableRow>
                            <TableCell width={40}>#</TableCell>
                            <TableCell width="18%">شناسه مرسله</TableCell>
                            <TableCell width="14%">وضعیت</TableCell>
                            <TableCell width="14%">شهر</TableCell>
                            <TableCell width="16%">بازه زمانی</TableCell>
                            <TableCell width="20%">تاریخ ایجاد</TableCell>
                            <TableCell width={60} align="center">حذف</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.map((s, i) => {
                            const sLabel = STATUS_LABEL[s.status];
                            const canDelete = s.cancellable !== false && !["picked", "completed"].includes(s.status);
                            const pkgCount = s.packages_count ?? s.packages?.length ?? 0;
                            return (
                                <TableRow key={s.id}>
                                    <TableCell>{i + 1 + (page - 1) * 50}</TableCell>
                                    <TableCell>
                                        <Stack direction="row" alignItems="center" gap={0.5}>
                                            <Box component={LocalShippingRoundedIcon} fontSize="small" sx={{ color: "text.secondary" }} />
                                            <Typography variant="body2" fontFamily="monospace" fontWeight={600}>
                                                {s.shipment_id ?? s.id}
                                            </Typography>
                                        </Stack>
                                        {pkgCount > 0 && (
                                            <Chip size="small" label={`${pkgCount} مرسوله`} variant="outlined" sx={{ mt: 0.5, width: "fit-content" }} />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Chip size="small" label={s.status_title || sLabel?.label || s.status} color={sLabel?.color ?? "default"} />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{s.city_title || (s.city_id ? `شهر ${s.city_id}` : "—")}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{s.time_scope_title || (s.time_scope_id ? `بازه ${s.time_scope_id}` : "—")}</Typography>
                                        {s.pickup_time && (
                                            <Typography variant="caption" color="text.secondary">{formatDate(s.pickup_time)}</Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="caption" color="text.secondary">{formatDate(s.created_at)}</Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Tooltip title={canDelete ? "حذف مرسله DK" : "این مرسله قابل حذف نیست"}>
                                            <span>
                                                <IconButton size="small" color="error"
                                                    disabled={!canDelete || deleting === s.id}
                                                    onClick={() => handleDelete(s)}>
                                                    {deleting === s.id
                                                        ? <CircularProgress size={16} color="error" />
                                                        : <DeleteRoundedIcon fontSize="small" />}
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {!isInitialLoading && !items.length && (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
                                    <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
                                        <Typography variant="subtitle2">مرسله DK یافت نشد</Typography>
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
                    مرسله‌های DK برای تحویل کالا از فروشنده به انبار دیجی‌کالا استفاده می‌شوند
                </Typography>
                <Pagination page={page} count={totalPages} siblingCount={1} boundaryCount={1}
                    onChange={(_, n) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
            </Stack>

            <CreateShipmentDialog open={createOpen} vendorId={vendorId} onCreated={load} onClose={() => setCreateOpen(false)} />
        </Container>
    );
}
