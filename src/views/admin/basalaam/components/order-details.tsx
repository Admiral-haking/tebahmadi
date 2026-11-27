import { BslOrderDetailsResponse } from "@/basalaam/services/order-details";
import { BSL_TRANSPORT_LABELS, BSL_TRANSPORTS } from "@/basalaam/constants/route";
import { Get, PATCH, POST } from "@/utils/fetch";
import { Box, Button, Divider, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { copyShippingText } from "@/orders/utils/shippingText";
import { getBasalaamProductImageUrl } from "@/basalaam/services/image-utils";

export function BslOrderDetails({ order_id, vendorId, items, refresh }: { order_id: number, vendorId: string, items: any[], refresh: VoidFunction }) {
    const [loading, setLoading] = useState(false);

    const [postMethod, setPostMethod] = useState<BSL_TRANSPORTS | "">("");
    const [trackingCode, setTrackingCode] = useState("");

    const [response, setResponse] = useState<BslOrderDetailsResponse>();


    function handleLoadInventory() {
        setLoading(true)
        Get(`/api/basalaam/orders/${order_id}?vendorId=${vendorId}`)
            .then(res => {
                setResponse(res);
                setPostMethod(res?.shipping_method?.current?.id as BSL_TRANSPORTS ?? "");
                setTrackingCode(res?.post_receipt?.tracking_code ?? "");
            })
            .catch(() => toast.error("خطا در بارگیری جزئیات سفارش باسلام"))
            .finally(() => setLoading(false));
    }

    function handleAccept() {
        setLoading(true)
        PATCH(`/api/basalaam/orders/${order_id}?vendorId=${vendorId}`, {})
            .then(() => {
                toast.success("ثبت سفارش تایید شد. تا دقایقی دیگر وضعیت تغییر خواهد کرد");
                refresh()
            })
            .catch(() => toast.error("خطا در تغییر جزئیات سفارش باسلام"))
            .finally(() => setLoading(false));
    }
    function handleSend() {
        setLoading(true)
        POST(`/api/basalaam/orders/${order_id}?vendorId=${vendorId}`, { tracking_code: trackingCode, shipping_method: postMethod })
            .then(() => {
                toast.success("ارسال سفارش تایید شد. تا دقایقی دیگر وضعیت تغییر خواهد کرد");
                refresh()
            })
            .catch(() => toast.error("خطا در تغییر جزئیات سفارش باسلام"))
            .finally(() => setLoading(false));
    }

    function handleCopyShippingText() {
        const recipient = response?.order?.customer?.recipient;
        copyShippingText({
            customerName: recipient?.name,
            customerPhone: recipient?.mobile,
            postalCode: recipient?.postal_code,
            city: response?.order?.customer?.city?.title,
            address: recipient?.postal_address,
            houseNumber: recipient?.house_number,
            houseUnit: recipient?.house_unit,
            items: orderItems.map((item) => ({
                title: item.title,
                quantity: item.quantity,
            })),
        })
            .then(() => toast.success("متن ارسال سفارش کپی شد."))
            .catch(() => toast.error("کپی متن ارسال انجام نشد."));
    }

    useEffect(handleLoadInventory, []);
    const orderItems = response?.items?.length ? response.items : items;
    const currentStatus = response?.status;
    const canAcceptOrder = currentStatus?.id === 3739;
    const canSubmitPostDetails = currentStatus?.id === 3237;
    const transportOptions = Object.values(BSL_TRANSPORTS).filter((value): value is BSL_TRANSPORTS => typeof value === "number");

    const formatPrice = (value?: number) => typeof value === "number" ? `${(value / 10).toLocaleString()} تومان` : "-";
    const formatDate = (value?: string) => value ? new Date(value).toLocaleString("fa-IR-u-ca-persian") : "-";

    return <Box>

        {loading && <LinearProgress />}

        <Stack spacing={2} sx={{ mt: 2 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                    <Typography variant="h6">جزئیات سفارش</Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                            gap: 1.5,
                        }}
                    >
                        <Typography variant="body2">شماره سفارش: {response?.id ?? order_id}</Typography>
                        <Typography variant="body2">وضعیت: {currentStatus?.title ?? "-"}</Typography>
                        <Typography variant="body2">نام گیرنده: {response?.order?.customer?.recipient?.name ?? "-"}</Typography>
                        <Typography variant="body2">موبایل: {response?.order?.customer?.recipient?.mobile ?? "-"}</Typography>
                        <Typography variant="body2">تاریخ ثبت: {formatDate(response?.created_at)}</Typography>
                        <Typography variant="body2">تاریخ پرداخت: {formatDate(response?.order?.paid_at)}</Typography>
                        <Typography variant="body2">مبلغ سفارش: {formatPrice(response?.total_items_price)}</Typography>
                        <Typography variant="body2">هزینه ارسال: {formatPrice(response?.shipping_cost)}</Typography>
                        <Typography variant="body2">روش ارسال: {response?.shipping_method?.current?.title ?? "-"}</Typography>
                        <Typography variant="body2">تاریخ تایید: {formatDate(response?.confirmed_at)}</Typography>
                        <Typography variant="body2">مهلت ارسال: {formatDate(response?.estimate_send_at)}</Typography>
                    </Box>

                    <Divider />

                    <Stack spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2">آدرس گیرنده</Typography>
                            <Button size="small" variant="outlined" onClick={handleCopyShippingText}>کپی متن ارسال</Button>
                        </Stack>
                        <Typography variant="body2">{response?.order?.customer?.city?.title ?? "-"}</Typography>
                        <Typography variant="body2">{response?.order?.customer?.recipient?.postal_address ?? "-"}</Typography>
                        <Typography variant="body2">کد پستی: {response?.order?.customer?.recipient?.postal_code ?? "-"}</Typography>
                    </Stack>
                </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                    <Typography variant="h6">اقلام سفارش</Typography>
                    {!orderItems.length && <Typography variant="body2">آیتمی برای نمایش وجود ندارد.</Typography>}

                    {orderItems.map((item) => (
                        <Box
                            key={item.id}
                            sx={{
                                p: 1.5,
                                border: 1,
                                borderColor: "divider",
                                borderRadius: 1,
                                display: 'flex',
                                gap: 2
                            }}
                        >
                            <Box
                                component="img"
                                src={getBasalaamProductImageUrl(item.product?.photos)}
                                width={100}
                                height={100}
                                alt={item.displayName}
                                sx={{ borderRadius: .6 }}
                            />
                            <Stack spacing={0.5}>
                                <Typography fontWeight={700}>{item.title}</Typography>
                                <Typography variant="body2">تعداد: {item.quantity}</Typography>
                                <Typography variant="body2">قیمت: {formatPrice(item.price)}</Typography>
                                {!!item.variation?.properties?.length && (
                                    <Typography variant="body2">
                                        تنوع: {item.variation.properties.map((property: any) => `${property.property.title}: ${property.value.title || property.value.value}`).join(" - ")}
                                    </Typography>
                                )}
                                {!!item.last_item_status?.status?.title && (
                                    <Typography variant="body2">وضعیت آیتم: {item.last_item_status.status.title}</Typography>
                                )}
                            </Stack>
                        </Box>
                    ))}
                </Stack>
            </Paper>

            {canAcceptOrder && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
                        <Box flex="1 1 auto">
                            <Typography variant="subtitle1">تایید سفارش</Typography>
                            <Typography variant="body2" color="text.secondary">
                                این سفارش در وضعیت جدید قرار دارد و می‌تواند توسط کاربر تایید شود.
                            </Typography>
                        </Box>
                        <Button onClick={handleAccept} variant="contained" color="success">تایید سفارش</Button>
                    </Stack>
                </Paper>
            )}

            {canSubmitPostDetails && (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle1">اطلاعات ارسال</Typography>
                            <Typography variant="body2" color="text.secondary">
                                روش ارسال و کد رهگیری را وارد کنید و سپس درخواست را ارسال کنید.
                            </Typography>
                        </Box>

                        <TextField
                            select
                            label="روش ارسال"
                            value={postMethod}
                            onChange={(event) => setPostMethod(Number(event.target.value) as BSL_TRANSPORTS)}
                            fullWidth
                        >
                            {transportOptions.map((transport) => (
                                <MenuItem key={transport} value={transport}>
                                    {BSL_TRANSPORT_LABELS[transport]}
                                </MenuItem>
                            ))}
                        </TextField>

                        <TextField
                            label="کد رهگیری"
                            value={trackingCode}
                            onChange={(event) => setTrackingCode(event.target.value)}
                            fullWidth
                        />

                        <Button variant="contained" onClick={handleSend}>ارسال درخواست</Button>
                    </Stack>
                </Paper>
            )}
        </Stack>

    </Box>
}
