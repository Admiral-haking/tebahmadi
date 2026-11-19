"use client";

import { useCart } from "@/components/cart/useCart";
import { Box, Button, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import Link from "next/link";
import { useEffect } from "react";

export default function PaymentVerificationView({
    invoiceNumber,
    status,
    message,
    transactionId,
}: {
    invoiceNumber?: string;
    status: boolean;
    message?: string;
    transactionId?: string;
}) {

    const { clear } = useCart();

    useEffect(() => {

        if (!status) return;

        localStorage.removeItem("offerX")
        clear();
    }, [status])

    const accent = status ? "var(--mui-palette-success-main)" : "var(--mui-palette-error-main)";
    const accentCh = status ? "var(--mui-palette-success-mainChannel)" : "var(--mui-palette-error-mainChannel)";
    const softBg = `radial-gradient(900px 400px at 50% -10%, rgba(${accentCh} / 0.12) 0%, var(--mui-palette-background-default) 55%, var(--mui-palette-background-default) 100%)`;

    return (
        <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", background: softBg }}>
            <Box sx={{ width: "100%", maxWidth: 460, mx: "auto", px: 2, py: { xs: 5, md: 8 } }}>
                <Paper
                    elevation={0}
                    sx={{
                        borderRadius: 4,
                        p: { xs: 3, sm: 4 },
                        textAlign: "center",
                        border: "1px solid var(--mui-palette-divider)",
                        boxShadow: "0 16px 48px -16px rgba(var(--mui-palette-text-primaryChannel) / 0.22)",
                        backgroundColor: "var(--mui-palette-background-paper)",
                    }}
                >
                    <Stack alignItems="center" gap={2}>
                        {/* Status icon in a tinted ring */}
                        <Box
                            sx={{
                                width: 132,
                                height: 132,
                                borderRadius: "50%",
                                display: "grid",
                                placeItems: "center",
                                background: `rgba(${accentCh} / 0.12)`,
                                boxShadow: `0 0 0 10px rgba(${accentCh} / 0.18)`,
                            }}
                        >
                            {status ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width={84} height={84} viewBox="0 0 40 40">
                                    <g fill="none" stroke="#00034a" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} strokeWidth={1}>
                                        <path fill="#00034a" d="M28.875 4.312c2.42-2.258 4.85-1.367 6.643 0c2.39 1.871 4.626 4.889 3.076 7.949c-.522 1.604-3.273 6.35-7.592 12.044c-.925 1.22-1.77 2.344-2.544 3.373c-3.118 4.15-5.098 6.784-6.633 8.199c-1.676 1.546-3.384 1.467-5.283.445c-1.584-.853-3.67-2.442-6.238-4.399l-1.13-.861c-2.49-1.898-6.543-4.515-7.822-7.617c-1.252-1.68.312-4.213 1.68-6.007c1.366-1.795 3.492-3.93 5.456-3.17c1.159.141 3.958 2.05 7.507 4.745c.97-1.328 2.034-2.739 3.153-4.226l.026-.035c4.32-5.695 8.258-9.49 9.7-10.44" />
                                        <path fill="#9bff00" d="M35.518 4.312c-1.795-1.367-4.224-2.258-6.643 0c-1.443.95-5.382 4.745-9.7 10.44a380 380 0 0 0-3.18 4.26c-3.55-2.694-6.348-4.602-7.507-4.745c-1.964-.759-4.09 1.377-5.457 3.17c-1.366 1.794-2.932 4.327-1.68 6.008c.447 1.082 2.97 3.35 6.52 6.055c4.262 3.236 7.337 5.694 9.14 5.922c2.761 1.072 4.745-2.192 12.689-12.68c4.319-5.694 7.07-10.439 7.593-12.043c1.479-2.923-.03-5.02-1.775-6.387" />
                                    </g>
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width={84} height={84} viewBox="0 0 40 40">
                                    <g fill="none" strokeMiterlimit={10}>
                                        <path fill="#ff52a1" stroke="#231f20" d="M.5 20a19.5 19.5 0 1 0 39 0a19.5 19.5 0 0 0-39 0Z" strokeWidth={1} />
                                        <path fill="#fff" stroke="#231f20" d="M30.08 25.41c-.16-.77-2.31-3.15-4.48-5.41c2.17-2.26 4.32-4.64 4.48-5.41c.46-.89-.63-2.11-1.59-3.08s-2.19-2-3.08-1.59c-.77.16-3.15 2.31-5.41 4.48c-2.26-2.17-4.64-4.32-5.41-4.48c-.89-.46-2.11.63-3.07 1.59s-2.06 2.19-1.6 3.08c.16.77 2.31 3.15 4.48 5.41c-2.17 2.26-4.32 4.64-4.48 5.41c-.46.89.63 2.11 1.59 3.08s2.19 2.05 3.08 1.59c.77-.16 3.15-2.31 5.41-4.48c2.26 2.17 4.64 4.32 5.41 4.48c.89.46 2.11-.63 3.08-1.59s2.05-2.19 1.59-3.08Z" strokeWidth={1} />
                                        <path stroke="#fff" strokeLinecap="round" d="M27.56 5a15.4 15.4 0 0 1 5.26 3.73" strokeWidth={1} />
                                    </g>
                                </svg>
                            )}
                        </Box>

                        <Typography variant="h5" fontWeight={800} sx={{ color: accent }}>
                            {status ? "پرداخت موفق بود" : "پرداخت ناموفق"}
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                            {message || (status
                                ? "سفارش شما ثبت شد و در حال پردازش است."
                                : "پرداخت انجام نشد. مبلغی کسر نشده؛ می‌توانید دوباره تلاش کنید.")}
                        </Typography>

                        {(invoiceNumber || (status && transactionId)) && (
                            <>
                                <Divider flexItem sx={{ my: 0.5 }} />
                                <Stack gap={1} width="100%" alignItems="center">
                                    {!!invoiceNumber && (
                                        <Stack direction="row" gap={1} alignItems="center">
                                            <Typography variant="caption" color="text.secondary">شماره فاکتور</Typography>
                                            <Chip size="small" label={invoiceNumber} sx={{ fontFamily: "monospace", fontWeight: 700 }} />
                                        </Stack>
                                    )}
                                    {status && !!transactionId && (
                                        <Typography variant="caption" color="text.secondary" dir="ltr" sx={{ fontFamily: "monospace" }}>
                                            Transaction: {transactionId}
                                        </Typography>
                                    )}
                                </Stack>
                            </>
                        )}

                        <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} width="100%" mt={1}>
                            {status ? (
                                <Button fullWidth LinkComponent={Link} href="/orders" variant="contained"
                                    startIcon={<ReceiptLongRoundedIcon />} sx={{ borderRadius: 2, py: 1.1, fontWeight: 700 }}>
                                    سفارش‌های من
                                </Button>
                            ) : (
                                <Button fullWidth LinkComponent={Link} href="/cart" variant="contained" color="error"
                                    sx={{ borderRadius: 2, py: 1.1, fontWeight: 700 }}>
                                    بازگشت به سبد خرید
                                </Button>
                            )}
                            <Button fullWidth LinkComponent={Link} href="/" variant="outlined"
                                startIcon={<HomeRoundedIcon />} sx={{ borderRadius: 2, py: 1.1 }}>
                                صفحه اصلی
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>
            </Box>
        </Box>
    );
}
