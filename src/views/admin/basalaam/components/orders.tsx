import Orderly from "@/components/orderly";
import { Get } from "@/utils/fetch";
import { Box, Button, Checkbox, Chip, Container, LinearProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ListFilterBar from "@/components/admin/list-filter-bar";
import { RefreshButton } from "@/components/refresh";
import { BslVendorOrdersResponse } from "@/basalaam/services/orders";
import { BslOrderDetails } from "./order-details";
import { copyShippingText } from "@/orders/utils/shippingText";

/**
 * Maps Basalam order status IDs to MUI Chip colors.
 * Based on observed Basalam status IDs:
 * - 3739: جدید (New/Waiting for confirmation)
 * - 3237: تایید شده (Confirmed/Waiting for shipping)
 * Other statuses are mapped by keyword matching on the title.
 */
function statusColor(statusId?: number, statusTitle?: string): "info" | "warning" | "success" | "error" | "default" | "primary" | "secondary" {
    // Map by known status IDs
    if (statusId) {
        switch (statusId) {
            case 3739: return "info";       // جدید (New)
            case 3237: return "warning";    // تایید شده / در انتظار ارسال
            case 3242: return "success";    // تحویل شده (Delivered)
            case 3429: return "error";      // لغو شده (Canceled)
            case 3240: return "primary";    // ارسال شده (Shipped)
        }
    }

    // Fallback: map by title keywords
    const title = (statusTitle || "").toLowerCase();
    if (title.includes("لغو") || title.includes("کنسل") || title.includes("return") || title.includes("refund")) return "error";
    if (title.includes("تحویل") || title.includes("دریافت") || title.includes("complete") || title.includes("delivered")) return "success";
    if (title.includes("ارسال") || title.includes("shipped") || title.includes("post")) return "primary";
    if (title.includes("جدید") || title.includes("new") || title.includes("pending") || title.includes("در انتظار تایید")) return "info";
    if (title.includes("تایید") || title.includes("confirm") || title.includes("processing") || title.includes("در حال")) return "warning";

    return "default";
}

export default function BslOrders({ vendorId }: { vendorId: string }) {
    const [loading, setLoading] = useState(false);
    const [cursor, setCursor] = useState('');
    const [response, setResponse] = useState<BslVendorOrdersResponse>({ data: [], next_cursor: '', previous_cursor: '' });
    const [tokenError, setTokenError] = useState(false);
    const [query, setQuery] = useState("");
    const deferredQuery = useDeferredValue(query);
    const [facets, setFacets] = useState<Record<string, string[]>>({ status: [] });
    const [selected, setSelected] = useState<Set<number>>(new Set());

    function handleLoadInventory() {
        setLoading(true);
        setTokenError(false);
        Get(`/api/basalaam/orders?vendorId=${vendorId}&cursor=${cursor}`)
            .then(res => { setResponse(res); })
            .catch((err) => {
                console.error("Basalam orders error:", err);
                if (err?.status === 401 || err?.message?.includes?.("توکن")) {
                    setTokenError(true);
                    toast.error("❌ توکن باسلام یافت نشد! لطفاً از صفحه اصلی باسلام روی دکمه 'ذخیره توکن' کلیک کنید.", { duration: 8000 });
                } else {
                    toast.error("خطا در بارگیری سفارشات باسلام");
                }
            })
            .finally(() => setLoading(false));
    }

    useEffect(handleLoadInventory, [cursor]);

    function handleCopyOrder(item: BslVendorOrdersResponse["data"][number]) {
        copyShippingText({
            customerName: item.order?.customer?.recipient?.name,
            customerPhone: item.order?.customer?.recipient?.mobile,
            postalCode: item.order?.customer?.recipient?.postal_code,
            city: item.order?.customer?.city?.title,
            address: item.order?.customer?.recipient?.postal_address,
            houseNumber: item.order?.customer?.recipient?.house_number,
            houseUnit: item.order?.customer?.recipient?.house_unit,
            items: item.items.map((row) => ({
                title: row.title,
                quantity: row.quantity,
            })),
        })
            .then(() => toast.success("متن ارسال سفارش کپی شد."))
            .catch(() => toast.error("کپی متن ارسال انجام نشد."));
    }

    const statusOptions = useMemo(() => {
        const set = new Set<string>();
        (response?.data ?? []).forEach((o) => o.status?.title && set.add(String(o.status.title)));
        return Array.from(set).map((s) => ({ value: s, label: s }));
    }, [response?.data]);

    const filtered = useMemo(() => {
        const items = response?.data ?? [];
        const term = deferredQuery.trim().toLowerCase();
        const { status = [] } = facets;
        return items.filter((item) => {
            if (term && ![
                item.order?.customer?.recipient?.name,
                item.order?.customer?.recipient?.mobile,
                item.status?.title,
                ...(item.items ?? []).map((r) => r.title),
            ].some((v) => String(v ?? "").toLowerCase().includes(term))) return false;
            if (status.length && !status.includes(String(item.status?.title ?? ""))) return false;
            return true;
        });
    }, [deferredQuery, response?.data, facets]);

    const allIds = filtered.map((o) => o.id);
    const selectedCount = allIds.filter((id) => selected.has(id)).length;
    const allSelected = allIds.length > 0 && selectedCount === allIds.length;

    function toggleOne(id: number, checked: boolean) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    }

    function handleBulkCopy() {
        const chosen = filtered.filter((o) => selected.has(o.id));
        if (!chosen.length) return;
        copyShippingText({
            items: chosen.flatMap((o) => (o.items ?? []).map((row) => ({ title: row.title, quantity: row.quantity }))),
        })
            .then(() => toast.success(`متن ارسال ${chosen.length.toLocaleString("fa-IR")} سفارش کپی شد.`))
            .catch(() => toast.error("کپی متن ارسال انجام نشد."));
    }

    return <Container maxWidth="lg" sx={{ my: 4 }}>
        <ListFilterBar
            search={query}
            onSearchChange={setQuery}
            searchPlaceholder="فیلتر: نام/موبایل خریدار، عنوان کالا..."
            resultCount={filtered.length}
            onClear={() => { setQuery(""); setFacets({ status: [] }); }}
            onFacetChange={(key, values) => setFacets((p) => ({ ...p, [key]: values }))}
            right={<RefreshButton onClick={handleLoadInventory} />}
            facets={statusOptions.length ? [{ key: "status", label: "وضعیت", value: facets.status, options: statusOptions }] : []}
        />

        {selectedCount > 0 && (
            <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1}
                sx={{ mb: 2, p: 1.25, borderRadius: 2, bgcolor: "action.selected", border: 1, borderColor: "divider" }}>
                <Typography variant="body2" fontWeight={700}>{selectedCount.toLocaleString("fa-IR")} سفارش انتخاب شده</Typography>
                <Stack direction="row" gap={1}>
                    <Button size="small" variant="contained" onClick={handleBulkCopy}>کپی آدرس گروهی</Button>
                    <Button size="small" color="inherit" onClick={() => setSelected(new Set())}>لغو انتخاب</Button>
                </Stack>
            </Stack>
        )}

        {loading && <LinearProgress />}

        {tokenError && (
            <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 2, p: 2, bgcolor: 'rgba(var(--mui-palette-warning-mainChannel) / 0.12)', borderRadius: 1 }}>
                <Typography color="error" variant="body2">
                    ⚠️ توکن باسلام ثبت نشده یا منقضی شده است. برای استفاده از این بخش:
                </Typography>
                <Button variant="contained" color="warning" size="small" component={Link} href={`/admin/basalaam`}>
                    رفتن به تنظیمات توکن
                </Button>
            </Stack>
        )}

        <TableContainer>
            <Table sx={{ minWidth: 1400 }}>
                <TableHead>
                    <TableRow>
                        <TableCell padding="checkbox">
                            <Checkbox
                                size="small"
                                checked={allSelected}
                                indeterminate={selectedCount > 0 && !allSelected}
                                disabled={allIds.length === 0}
                                onChange={(e) => setSelected(e.target.checked ? new Set(allIds) : new Set())}
                                inputProps={{ "aria-label": "انتخاب همه" }}
                            />
                        </TableCell>
                        <TableCell>#</TableCell>
                        <TableCell>خریدار</TableCell>
                        <TableCell>آیتم ها</TableCell>
                        <TableCell>مبلغ</TableCell>
                        <TableCell>وضعیت</TableCell>
                        <TableCell>عملیات</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {filtered.map((item, i) => <TableRow key={item.id} selected={selected.has(item.id)}>
                        <TableCell padding="checkbox">
                            <Checkbox
                                size="small"
                                checked={selected.has(item.id)}
                                onChange={(e) => toggleOne(item.id, e.target.checked)}
                                inputProps={{ "aria-label": `انتخاب سفارش ${item.id}` }}
                            />
                        </TableCell>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                            <Stack>
                                <Typography variant="body2">{item.order?.customer?.recipient?.name}</Typography>
                                <Typography variant="caption" color="text.secondary">{item.order?.customer?.recipient?.mobile}</Typography>
                            </Stack>
                        </TableCell>
                        <TableCell>
                            {item.items.map((row, j) => <Typography key={j} variant="caption" display="block">
                                {row.title} × {row.quantity}
                            </Typography>)}
                        </TableCell>
                        <TableCell>{(item.total_items_price / 10).toLocaleString("fa-IR")} تومان</TableCell>
                        <TableCell>
                            <Chip
                                label={item.status?.title || "-"}
                                color={statusColor(item.status?.id, item.status?.title)}
                                size="small"
                                variant="filled"
                                sx={{ fontWeight: 600, minWidth: 70 }}
                            />
                        </TableCell>
                        <TableCell>
                            <Stack direction="row" gap={1}>
                                <Orderly
                                    buttonProps={{ variant: "contained", size: "small", children: "جزئیات" }}
                                    title={`جزئیات سفارش ${item.id}`}
                                >
                                    <BslOrderDetails order_id={item.id} vendorId={vendorId} items={item.items} refresh={handleLoadInventory} />
                                </Orderly>
                                <Button variant="outlined" size="small" onClick={() => handleCopyOrder(item)}>
                                    کپی آدرس
                                </Button>
                            </Stack>
                        </TableCell>
                    </TableRow>)}
                </TableBody>
            </Table>
        </TableContainer>

        <Stack direction="row" justifyContent="center" gap={2} sx={{ mt: 2 }}>
            {response.previous_cursor && <Button onClick={() => setCursor(response.previous_cursor)}>قبلی</Button>}
            {response.next_cursor && <Button onClick={() => setCursor(response.next_cursor)}>بعدی</Button>}
        </Stack>
    </Container>
}
