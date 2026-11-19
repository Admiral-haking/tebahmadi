"use client";

import {
    Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, Divider, FormControlLabel, LinearProgress,
    Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TextField, Typography,
} from "@mui/material";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";

export interface BulkProduct {
    product_id: number;
    title: string;
}

type RowStatus = "pending" | "running" | "done" | "error" | "skipped";

interface ProgressRow {
    product_id: number;
    title: string;
    status: RowStatus;
    message?: string;
    created?: number;
    total?: number;
}

interface SourceVariant {
    product_variant_id: number;
    price_sale?: number;
    marketplace_seller_stock?: number;
    supplier_code?: string;
    sku_config?: { color?: string; size?: string };
    maximum_per_order?: number;
    active?: boolean;
}

/**
 * Bulk "become seller": transfer many products to one target Digikala panel.
 *
 * The per-product become-seller flow is slow (DGK rate limits + per-variant
 * pacing) and would time out as one batch request, so we drive it from the
 * client: for each product we fetch its source variants and POST the existing
 * /api/digikala/become-seller submit, one at a time, showing live progress.
 * Each product is listed using its own current variant data — there is no
 * per-variant editing here (that stays in the single-product dialog).
 */
export default function BulkBecomeSellerDialog({
    open,
    onClose,
    products,
    sourceVendorId,
}: {
    open: boolean;
    onClose: () => void;
    products: BulkProduct[];
    sourceVendorId: string;
}) {
    const [vendors, setVendors] = useState<string[]>([]);
    const [targetVendor, setTargetVendor] = useState("");
    const [confirm, setConfirm] = useState(false);
    const [running, setRunning] = useState(false);
    const [rows, setRows] = useState<ProgressRow[]>([]);
    const [doneCount, setDoneCount] = useState(0);

    useEffect(() => {
        if (!open) return;
        setRows([]);
        setDoneCount(0);
        setConfirm(false);
        fetch("/api/vendors?service=dgk", { credentials: "include" })
            .then((r) => r.json())
            .then((j) => {
                const list: string[] = Array.isArray(j?.vendors) ? j.vendors : [];
                setVendors(list.filter((v) => v !== sourceVendorId));
            })
            .catch(() => setVendors([]));
    }, [open, sourceVendorId]);

    function patchRow(id: number, patch: Partial<ProgressRow>) {
        setRows((prev) => prev.map((r) => (r.product_id === id ? { ...r, ...patch } : r)));
    }

    /** Build the submit payload for one product from its live source variants. */
    async function variantsForProduct(productId: number) {
        const r = await fetch(
            `/api/digikala/products/${productId}?vendorId=${encodeURIComponent(sourceVendorId)}`,
            { credentials: "include" },
        );
        const j = await r.json().catch(() => null);
        const items: SourceVariant[] = Array.isArray(j?.data?.items) ? j.data.items : [];
        return items.map((it) => ({
            product_variant_id: Number(it.product_variant_id),
            price: Math.max(0, Math.round((Number(it.price_sale) || 0) / 10)), // Rial → Toman
            stock: Math.max(0, Number(it.marketplace_seller_stock) || 0),
            seller_code: String(it.supplier_code ?? "").trim(),
            color: String(it.sku_config?.color ?? "").trim(),
            size: String(it.sku_config?.size ?? "").trim(),
            order_limit: Math.max(1, Number(it.maximum_per_order) || 5),
            // Carry the source active/inactive state so it transfers as-is.
            active: it.active !== false,
        }));
    }

    async function run() {
        if (!targetVendor) { toast.error("پنل مقصد را انتخاب کنید"); return; }
        setRunning(true);
        const initial: ProgressRow[] = products.map((p) => ({
            product_id: p.product_id, title: p.title, status: "pending",
        }));
        setRows(initial);
        setDoneCount(0);

        let completed = 0;
        for (const p of products) {
            patchRow(p.product_id, { status: "running" });
            try {
                const variants = await variantsForProduct(p.product_id);
                if (!variants.length) {
                    patchRow(p.product_id, { status: "skipped", message: "واریانتی یافت نشد" });
                    continue;
                }
                const r = await fetch("/api/digikala/become-seller", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        targetVendorId: targetVendor,
                        product_id: p.product_id,
                        step: "submit",
                        variants,
                    }),
                });
                const j = await r.json().catch(() => null);
                if (!r.ok) {
                    patchRow(p.product_id, { status: "error", message: j?.error || `خطای ${r.status}` });
                } else {
                    const vr: any[] = Array.isArray(j?.variantResults) ? j.variantResults : [];
                    const okCount = vr.filter((x) => x.created === "ok").length;
                    patchRow(p.product_id, {
                        status: okCount > 0 ? "done" : "error",
                        created: okCount,
                        total: vr.length,
                        message: okCount > 0
                            ? `${okCount} از ${vr.length} واریانت ساخته شد`
                            : "هیچ واریانتی ساخته نشد",
                    });
                }
            } catch (e) {
                patchRow(p.product_id, {
                    status: "error",
                    message: e instanceof Error ? e.message : "خطا در ارتباط با سرور",
                });
            } finally {
                completed += 1;
                setDoneCount(completed);
            }
        }
        setRunning(false);
        toast.success("انتقال گروهی پایان یافت");
    }

    const pct = products.length ? Math.round((doneCount / products.length) * 100) : 0;
    const statusFa: Record<RowStatus, string> = {
        pending: "در صف", running: "در حال انجام", done: "موفق", error: "خطا", skipped: "رد شد",
    };
    const statusColor: Record<RowStatus, string> = {
        pending: "text.secondary", running: "info.main", done: "success.main",
        error: "error.main", skipped: "warning.main",
    };

    return (
        <Dialog open={open} onClose={running ? undefined : onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ position: "relative", pr: 6 }}>
                <Stack direction="row" gap={1} alignItems="center">
                    <StorefrontRoundedIcon fontSize="small" />
                    <span>انتقال گروهی {products.length.toLocaleString("fa-IR")} محصول به پنل دیگر</span>
                </Stack>
                <DialogCloseButton onClose={onClose} disabled={running} />
            </DialogTitle>
            <Divider />
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        select size="small" label="پنل مقصد (فروشنده)" value={targetVendor}
                        onChange={(e) => setTargetVendor(e.target.value)}
                        slotProps={{ select: { native: true } }} fullWidth
                        disabled={running}
                    >
                        <option value="">انتخاب فروشنده مقصد…</option>
                        {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
                    </TextField>

                    <Alert severity="info">
                        {products.length.toLocaleString("fa-IR")} محصول به پنلِ
                        {targetVendor ? ` «${targetVendor}» ` : " مقصد "}
                        منتقل می‌شود. هر محصول با واریانت‌ها و قیمت/موجودیِ فعلیِ خودش روی پنل مقصد ثبت می‌شود.
                    </Alert>

                    {running || doneCount > 0 ? (
                        <Box>
                            <Stack direction="row" justifyContent="space-between" mb={0.5}>
                                <Typography variant="caption">
                                    {doneCount.toLocaleString("fa-IR")} از {products.length.toLocaleString("fa-IR")}
                                </Typography>
                                <Typography variant="caption">{pct.toLocaleString("fa-IR")}٪</Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={pct} />
                        </Box>
                    ) : null}

                    {rows.length > 0 && (
                        <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1, maxHeight: 320 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>محصول</TableCell>
                                        <TableCell width={110}>وضعیت</TableCell>
                                        <TableCell>توضیح</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((r) => (
                                        <TableRow key={r.product_id}>
                                            <TableCell><Typography variant="caption">{r.title}</Typography></TableCell>
                                            <TableCell>
                                                <Typography variant="caption" sx={{ color: statusColor[r.status], fontWeight: 700 }}>
                                                    {statusFa[r.status]}
                                                </Typography>
                                            </TableCell>
                                            <TableCell><Typography variant="caption" color="text.secondary">{r.message || "—"}</Typography></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}

                    <FormControlLabel
                        control={<Checkbox checked={confirm} onChange={(e) => setConfirm(e.target.checked)} disabled={running} />}
                        label="تأیید می‌کنم که این محصول‌ها روی پنل مقصد ثبت شوند."
                    />
                    <Typography variant="caption" color="warning.main">
                        ⚠️ ثبت، روی فروشگاه زنده‌ی دیجی‌کالای مقصد نوشته می‌شود و چند دقیقه طول می‌کشد. پنجره را نبندید.
                    </Typography>
                </Stack>
            </DialogContent>
            <Divider />
            <DialogActions>
                <Button onClick={onClose} disabled={running}>بستن</Button>
                <Button
                    variant="contained" color="error" onClick={run}
                    disabled={!targetVendor || !confirm || running || !products.length}
                    startIcon={running ? <CircularProgress size={14} color="inherit" /> : undefined}
                >
                    شروع انتقال گروهی
                </Button>
            </DialogActions>
        </Dialog>
    );
}
