import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { ArrowLeft, Sparkles, ShieldCheck, Truck, HeartHandshake } from "lucide-react";
import { BRAND } from "@/config/brand";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

export type HomeHeroProps = {
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    href?: string;
};

export default function HomeHero({
    title = "فروشگاه تخصصی گیاهان دارویی و محصولات طبیعی طب احمدی",
    subtitle = "گیاهان دست‌چین، دمنوش‌های خالص، روغن‌های طبیعی و عسل کوهستان با ارسال مطمئن به سراسر کشور",
    ctaLabel = "مشاهده فروشگاه",
    href = "/store",
}: HomeHeroProps) {
    return (
        <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 }, px: { xs: 1.5, sm: 2.5 } }}>
            <Box
                sx={{
                    position: "relative",
                    borderRadius: `${TEB_RADII.panel}px`,
                    bgcolor: TEB_COLORS.softSurface,
                    border: `1px solid ${TEB_COLORS.border}`,
                    overflow: "hidden",
                    p: { xs: 3, sm: 4, md: 6 },
                }}
            >
                <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={{ xs: 4, md: 5 }}
                    alignItems="center"
                    justifyContent="space-between"
                >
                    <Stack spacing={2.5} sx={{ flex: 1, maxWidth: { md: 580 } }}>
                        <Box
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 1,
                                px: 2,
                                py: 0.75,
                                borderRadius: "9999px",
                                bgcolor: "rgba(42, 90, 68, 0.08)",
                                color: TEB_COLORS.primary,
                                width: "fit-content",
                            }}
                        >
                            <Sparkles size={16} />
                            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "13px" }}>
                                اصالت، سلامت و طبیعت در طب احمدی
                            </Typography>
                        </Box>

                        <Typography
                            component="h1"
                            sx={{
                                fontSize: { xs: "24px", sm: "32px", md: "40px" },
                                fontWeight: 800,
                                lineHeight: { xs: 1.35, md: 1.3 },
                                color: TEB_COLORS.primaryDark,
                            }}
                        >
                            {title}
                        </Typography>

                        <Typography
                            variant="body1"
                            sx={{
                                fontSize: { xs: "14px", sm: "16px" },
                                color: TEB_COLORS.textSecondary,
                                lineHeight: 1.8,
                            }}
                        >
                            {subtitle}
                        </Typography>

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
                            <Button
                                component={Link}
                                href={href}
                                variant="contained"
                                size="large"
                                endIcon={<ArrowLeft size={18} />}
                                sx={{
                                    bgcolor: TEB_COLORS.primary,
                                    color: "#FFFFFF",
                                    px: 3.5,
                                    minHeight: 48,
                                    "&:hover": {
                                        bgcolor: TEB_COLORS.primaryDark,
                                    },
                                }}
                            >
                                {ctaLabel}
                            </Button>
                            <Button
                                component="a"
                                href={`tel:${BRAND.phone}`}
                                variant="outlined"
                                size="large"
                                sx={{
                                    borderColor: TEB_COLORS.border,
                                    color: TEB_COLORS.primary,
                                    minHeight: 48,
                                    "&:hover": {
                                        borderColor: TEB_COLORS.primary,
                                        bgcolor: "rgba(42, 90, 68, 0.04)",
                                    },
                                }}
                            >
                                مشاوره رایگان: {BRAND.phone}
                            </Button>
                        </Stack>

                        <Stack
                            direction="row"
                            flexWrap="wrap"
                            gap={2.5}
                            sx={{
                                pt: { xs: 1.5, sm: 2.5 },
                                borderTop: `1px solid ${TEB_COLORS.border}`,
                                color: TEB_COLORS.textSecondary,
                            }}
                        >
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                                <ShieldCheck size={18} color={TEB_COLORS.primary} />
                                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "12.5px" }}>
                                    تضمین کیفیت ۱۰۰٪
                                </Typography>
                            </Stack>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                                <Truck size={18} color={TEB_COLORS.primary} />
                                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "12.5px" }}>
                                    ارسال سریع به سراسر کشور
                                </Typography>
                            </Stack>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                                <HeartHandshake size={18} color={TEB_COLORS.primary} />
                                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: "12.5px" }}>
                                    پشتیبانی و راهنمایی
                                </Typography>
                            </Stack>
                        </Stack>
                    </Stack>

                    <Box
                        sx={{
                            flex: { xs: "none", md: 1 },
                            width: { xs: "100%", md: "auto" },
                            maxWidth: { xs: 440, md: 500 },
                            aspectRatio: "4 / 3",
                            position: "relative",
                            borderRadius: `${TEB_RADII.lg}px`,
                            overflow: "hidden",
                            border: `1px solid ${TEB_COLORS.border}`,
                            boxShadow: "0 12px 36px rgba(42, 90, 68, 0.08)",
                        }}
                    >
                        <Image
                            src="/images/tebahmadi/hero-herbs.jpg"
                            alt="گیاهان دارویی و محصولات طبیعی طب احمدی"
                            fill
                            priority
                            sizes="(max-width: 900px) 100vw, 500px"
                            style={{ objectFit: "cover" }}
                        />
                    </Box>
                </Stack>
            </Box>
        </Container>
    );
}
