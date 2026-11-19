"use client";

import {
    Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, InputAdornment,
    Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField,
    Tooltip, Typography,
} from "@mui/material";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import DialogCloseButton from "./dialog-close-button";

interface SourceVariant {
    product_variant_id: number;
    title?: string;
    image_src?: string;
    price_sale?: number;
    marketplace_seller_stock?: number;
    supplier_code?: string;
    active?: boolean;
    sku_config?: { color?: string; size?: string };
    maximum_per_order?: number;
}

interface RowState {
    product_variant_id: number;
    title: string;
    image_src?: string;
    price: string;
    stock: string;
    seller_code: string;
    color: string;
    size: string;
    order_limit: number;
    active: boolean;
}

export default function BecomeSellerDialog({
    productId,
    productTitle,
    sourceVendorId,
}: {
    productId: number;
    productTitle: string;
    sourceVendorId: string;
}) {
    const [open, setOpen] = useState(false);
    const [vendors, setVendors] = useState<string[]>([]);
    const [targetVendor, setTargetVendor] = useState("");
    const [rows, setRows] = useState<RowState[]>([]);
    const [loadingVariants, setLoadingVariants] = useState(false);
    const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; message: string; data?: unknown } | null>(null);

    // Load the other Digikala vendors (exclude the source).
    useEffect(() => {
        if (!open) return;
        fetch("/api/vendors?service=dgk", { credentials: "include" })
            .then((r) => r.json())
            .then((j) => {
                const list: string[] = Array.isArray(j?.vendors) ? j.vendors : [];
                setVendors(list.filter((v) => v !== sourceVendorId));
            })
            .catch(() => setVendors([]));
    }, [open, sourceVendorId]);

    // Load the source product's variants to pre-fill price/stock/seller-code.
    useEffect(() => {
        if (!open) return;
        setLoadingVariants(true);
        fetch(`/api/digikala/products/${productId}?vendorId=${encodeURIComponent(sourceVendorId)}`, {
            credentials: "include",
        })
            .then((r) => r.json())
            .then((j) => {
                const items: SourceVariant[] = Array.isArray(j?.data?.items) ? j.data.items : [];
                setRows(
                    items.map((it) => ({
                        product_variant_id: Number(it.product_variant_id),
                        title: it.title ?? `واریانت ${it.product_variant_id}`,
                        image_src: it.image_src,
                        // price_sale is in Rial; show Toman in the field.
                        price: String(Math.max(0, Math.round((Number(it.price_sale) || 0) / 10))),
                        stock: String(Math.max(0, Number(it.marketplace_seller_stock) || 0)),
                        seller_code: String(it.supplier_code ?? "").trim(),
                        color: String(it.sku_config?.color ?? "").trim(),
                        size: String(it.sku_config?.size ?? "").trim(),
                        order_limit: Math.max(1, Number(it.maximum_per_order) || 5),
                        active: it.active !== false,
                    })),
                );
            })
            .catch(() => toast.error("خطا در بارگیری واریانت‌های محصول مبدأ"))
            .finally(() => setLoadingVariants(false));
    }, [open, productId, sourceVendorId]);

    function reset() {
        setPreview(null);
        setResult(null);
        setConfirm(false);
    }

    function updateRow(id: number, field: "price" | "stock" | "seller_code", value: string) {
        setRows((prev) => prev.map((r) => (r.product_variant_id === id ? { ...r, [field]: value } : r)));
    }

    async function call(step: "preview" | "submit") {
        if (!targetVendor) {
            toast.error("فروشنده‌ی مقصد را انتخاب کنید");
            return;
        }
        const setter = step === "preview" ? setPreviewing : setSubmitting;
        setter(true);
        setResult(null);
        try {
            const r = await fetch("/api/digikala/become-seller", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetVendorId: targetVendor,
                    product_id: productId,
                    step,
                    variants: rows.map((row) => ({
                        product_variant_id: row.product_variant_id,
                        price: Number(row.price) || 0,
                        stock: Number(row.stock) || 0,
                        seller_code: row.seller_code.trim(),
                        color: row.color,
                        size: row.size,
                        order_limit: row.order_limit,
                        active: row.active,
                    })),
                }),
            });
            const json = await r.json().catch(() => null);
            if (!r.ok) {
                const msg = json?.error || `خطای ${r.status}`;
                if (step === "preview") setPreview(null);
                setResult({ ok: false, message: msg, data: json });
                return;
            }
            if (step === "preview") {
                setPreview((json?.beSeller as Record<string, unknown>) ?? {});
                toast.success("اطلاعات واجد شرایط بودن دریافت شد");
            } else {
                const vr: any[] = Array.isArray(json?.variantResults) ? json.variantResults : [];
                const okCount = vr.filter((r) => r.created === "ok").length;
                setResult({
                    ok: okCount > 0,
                    message: `محصول به پنل مقصد اضافه شد — ${okCount.toLocaleString("fa-IR")} از ${vr.length.toLocaleString("fa-IR")} واریانت ساخته شد`,
                    data: { assign: json?.assign, variantTheme: json?.variantTheme, variantResults: vr },
                });
                toast.success("افزودن به پنل مقصد انجام شد");
            }
        } catch (e) {
            setResult({ ok: false, message: e instanceof Error ? e.message : "خطا در ارتباط با سرور" });
        } finally {
            setter(false);
        }
    }

    const previewData = preview?.data ?? preview;
    const canSell = (() => {
        const d = previewData as Record<string, unknown> | undefined;
        const commission = d?.commission as Record<string, unknown> | undefined;
        if (commission && typeof commission.canSell === "boolean") return commission.canSell;
        return undefined;
    })();

    return (
        <>
            <Tooltip title="افزودن این محصول به پنل دیجی‌کالای دیگر">
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<StorefrontRoundedIcon fontSize="small" />}
                    onClick={() => { reset(); setOpen(true); }}
                >
                    افزودن به پنل دیگر
                </Button>
            </Tooltip>

            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ position: "relative", pr: 6 }}>
                    <Stack direction="row" gap={1} alignItems="center">
                        <StorefrontRoundedIcon fontSize="small" />
                        <span>افزودن «{productTitle}» به پنل دیگر</span>
                    </Stack>
                    <DialogCloseButton onClose={() => setOpen(false)} />
                </DialogTitle>
                <Divider />
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            select size="small" label="پنل مقصد (فروشنده)" value={targetVendor}
                            onChange={(e) => { setTargetVendor(e.target.value); reset(); }}
                            slotProps={{ select: { native: true } }} fullWidth
                        >
                            <option value="">انتخاب فروشنده مقصد…</option>
                            {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
                        </TextField>

                        {canSell === false && (
                            <Alert severity="warning">دیجی‌کالا فروش این محصول را برای پنل مقصد مجاز ندانست.</Alert>
                        )}
                        {canSell === true && (
                            <Alert severity="success">پنل مقصد مجاز به فروش این محصول است.</Alert>
                        )}
                        {preview && (
                            <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 1 }}>
                                <Typography variant="caption" color="text.secondary">پاسخ be-seller (برای بررسی):</Typography>
                                <Box component="pre" sx={{ m: 0, mt: 0.5, fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>
                                    {JSON.stringify(preview, null, 2)}
                                </Box>
                            </Box>
                        )}

                        {loadingVariants ? (
                            <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress size={22} /></Stack>
                        ) : (
                            <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
                                <Table size="small" sx={{ "& td, & th": { verticalAlign: "middle" } }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>واریانت</TableCell>
                                            <TableCell>ویژگی / وضعیت</TableCell>
                                            <TableCell width={130}>قیمت (تومان)</TableCell>
                                            <TableCell width={90}>موجودی</TableCell>
                                            <TableCell width={160}>کد فروشنده</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {rows.map((row) => (
                                            <TableRow key={row.product_variant_id}>
                                                <TableCell>
                                                    <Stack direction="row" gap={1} alignItems="center">
                                                        {row.image_src && (
                                                            <Box component="img" src={row.image_src} width={34} height={34} sx={{ borderRadius: 0.5, flexShrink: 0 }} />
                                                        )}
                                                        <Stack gap={0.25}>
                                                            <Typography variant="caption">{row.title}</Typography>
                                                            <Typography variant="caption" color="text.secondary" sx={{ direction: "ltr" }}>کد: {row.product_variant_id}</Typography>
                                                        </Stack>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>
                                                    <Stack direction="row" gap={0.5} flexWrap="wrap" alignItems="center">
                                                        {row.color && <Chip size="small" variant="outlined" label={`رنگ: ${row.color}`} />}
                                                        {row.size && <Chip size="small" variant="outlined" label={`سایز: ${row.size}`} />}
                                                        <Chip size="small" color={row.active ? "success" : "default"}
                                                            variant={row.active ? "filled" : "outlined"}
                                                            label={row.active ? "فعال" : "غیرفعال"} />
                                                        {Number(row.stock) <= 0 && <Chip size="small" color="warning" variant="outlined" label="ناموجود" />}
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>
                                                    <TextField
                                                        size="small" type="number" value={row.price}
                                                        onChange={(e) => updateRow(row.product_variant_id, "price", e.target.value)}
                                                        slotProps={{ input: { endAdornment: <InputAdornment position="end">ت</InputAdornment> } }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <TextField size="small" type="number" value={row.stock}
                                                        onChange={(e) => updateRow(row.product_variant_id, "stock", e.target.value)} />
                                                </TableCell>
                                                <TableCell>
                                                    <TextField size="small" value={row.seller_code}
                                                        placeholder="اختیاری"
                                                        onChange={(e) => updateRow(row.product_variant_id, "seller_code", e.target.value)} />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {!rows.length && (
                                            <TableRow><TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                                                <Typography variant="body2" color="text.secondary">واریانتی یافت نشد</Typography>
                                            </TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}

                        {result && (
                            <Alert severity={result.ok ? "success" : "error"}>
                                <Typography variant="body2" fontWeight={700}>{result.message}</Typography>
                                {!!result.data && (
                                    <Box component="pre" sx={{ m: 0, mt: 1, fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto" }}>
                                        {JSON.stringify(result.data, null, 2)}
                                    </Box>
                                )}
                            </Alert>
                        )}

                        <FormControlLabel
                            control={<Checkbox checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />}
                            label="تأیید می‌کنم که قیمت/موجودی/کد فروشنده درست است و روی پنل مقصد ثبت شود."
                        />
                        <Typography variant="caption" color="warning.main">
                            ⚠️ ثبت، روی فروشگاه زنده‌ی دیجی‌کالای مقصد نوشته می‌شود. ابتدا «بررسی واجد شرایط» را بزنید.
                        </Typography>
                    </Stack>
                </DialogContent>
                <Divider />
                <DialogActions>
                    <Button onClick={() => setOpen(false)} disabled={submitting}>بستن</Button>
                    <Button
                        variant="outlined"
                        onClick={() => call("preview")}
                        disabled={!targetVendor || previewing || submitting}
                        startIcon={previewing ? <CircularProgress size={14} /> : undefined}
                    >
                        بررسی واجد شرایط
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => call("submit")}
                        disabled={!targetVendor || !confirm || submitting || !rows.length || canSell === false}
                        startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : undefined}
                    >
                        ثبت در پنل مقصد
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
