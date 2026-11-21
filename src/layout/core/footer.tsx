"use server";

import Link from "next/link";
import { Box, Container, Divider, Grid, Stack, Typography } from "@mui/material";
import { MapPin, Phone, ShieldCheck } from "lucide-react";
import Logo from "@/components/logo";
import Socials from "../components/socials";
import { FooterColumns, type FooterLinkGroup } from "./footer-columns.client";
import { loadSiteInfo } from "@/lib/cache";
import { BRAND } from "@/config/brand";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

const FOOTER_GROUPS: FooterLinkGroup[] = [
    {
        id: "shop",
        title: "دسترسی سریع",
        links: [
            { label: "همه محصولات فروشگاه", href: "/store" },
            { label: "دمنوش‌های طبیعی", href: "/store/herbal-teas" },
            { label: "روغن‌های گیاهی", href: "/store/natural-oils" },
            { label: "عسل و فرآورده‌های طبیعی", href: "/store/honey-natural" },
        ],
    },
    {
        id: "orders",
        title: "راهنمای خرید و سفارش",
        links: [
            { label: "پیگیری سفارش", href: "/orders" },
            { label: "سبد خرید", href: "/cart" },
            { label: "جست‌وجوی محصولات", href: "/search" },
            { label: "مجله آموزشی طب احمدی", href: "/blog" },
        ],
    },
    {
        id: "policies",
        title: "قوانین و پشتیبانی",
        links: [
            { label: "قوانین و مقررات خرید", href: "/page/terms" },
            { label: "حریم خصوصی کاربران", href: "/page/privacy" },
            { label: "رویه ارسال و بسته‌بندی", href: "/page/shipping" },
            { label: "تماس و پشتیبانی", href: "/page/contact" },
        ],
    },
];

export default async function Footer() {
    const siteInfo = await loadSiteInfo();
    const appName = siteInfo?.appName ?? BRAND.name;
    const addresses = siteInfo?.addresses ?? [];
    const phones = siteInfo?.phones ?? [];
    const bio = siteInfo?.bio ?? siteInfo?.description ?? BRAND.bio;
    const socials = siteInfo?.socials ?? [];
    const cd = siteInfo?.customData ?? {};
    const enamadCode = typeof cd.enamad === "string" ? cd.enamad.trim() : "";
    const enamadLink = typeof cd.enamadLink === "string" ? cd.enamadLink.trim() : "";

    let enamadImageSrc: string | null = null;
    try {
        const parsed = new URL(enamadLink);
        const id = parsed.hostname === "trustseal.enamad.ir" ? parsed.searchParams.get("id") : null;
        if (id && enamadCode) {
            enamadImageSrc = `https://trustseal.enamad.ir/logo.aspx?id=${encodeURIComponent(id)}&Code=${encodeURIComponent(enamadCode)}`;
        }
    } catch {
        enamadImageSrc = null;
    }

    const primaryPhone = phones[0]?.number || BRAND.phone;

    return (
        <Box
            component="footer"
            sx={{
                mt: { xs: 4, md: 6 },
                bgcolor: TEB_COLORS.softSurface,
                borderTop: `1px solid ${TEB_COLORS.border}`,
                borderTopLeftRadius: { xs: `${TEB_RADII.lg}px`, md: `${TEB_RADII.panel}px` },
                borderTopRightRadius: { xs: `${TEB_RADII.lg}px`, md: `${TEB_RADII.panel}px` },
            }}
        >
            <Container maxWidth="lg" sx={{ py: { xs: 4, md: 5.5 }, px: { xs: 2, sm: 2.5 } }}>
                <Grid container spacing={{ xs: 3.5, md: 4 }} alignItems="flex-start">
                    {/* Brand & contact */}
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Stack spacing={2}>
                            <Logo size={48} showName />
                            <Typography
                                variant="body2"
                                sx={{
                                    color: TEB_COLORS.textSecondary,
                                    fontSize: "13.5px",
                                    lineHeight: 1.8,
                                }}
                            >
                                {bio}
                            </Typography>

                            <Stack spacing={1}>
                                <Stack
                                    component="a"
                                    href={`tel:${primaryPhone}`}
                                    direction="row"
                                    alignItems="center"
                                    gap={1}
                                    sx={{
                                        color: TEB_COLORS.primaryDark,
                                        fontWeight: 700,
                                        fontSize: "14px",
                                        textDecoration: "none",
                                        width: "fit-content",
                                    }}
                                >
                                    <Phone size={16} color={TEB_COLORS.primary} />
                                    <span dir="ltr">{primaryPhone}</span>
                                </Stack>

                                {addresses.length > 0 && (
                                    <Stack direction="row" alignItems="flex-start" gap={1} sx={{ color: TEB_COLORS.textSecondary }}>
                                        <MapPin size={16} style={{ flexShrink: 0, marginTop: 3 }} />
                                        <Typography variant="caption" sx={{ fontSize: "12.5px", lineHeight: 1.7 }}>
                                            {addresses[0].label
                                                ? `${addresses[0].label}: ${addresses[0].address}`
                                                : addresses[0].address}
                                        </Typography>
                                    </Stack>
                                )}
                            </Stack>

                            {socials.length > 0 && <Socials links={socials} />}
                        </Stack>
                    </Grid>

                    {/* Structured navigation links */}
                    <Grid size={{ xs: 12, md: enamadImageSrc ? 6 : 8 }}>
                        <FooterColumns groups={FOOTER_GROUPS} />
                    </Grid>

                    {/* Fixed-size e-Namad trust seal without dead space */}
                    {enamadImageSrc && (
                        <Grid size={{ xs: 12, md: 2 }}>
                            <Stack alignItems={{ xs: "flex-start", md: "flex-end" }}>
                                <Box
                                    component={Link}
                                    href={enamadLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    referrerPolicy="origin"
                                    aria-label="نماد اعتماد الکترونیکی طب احمدی"
                                    sx={{
                                        width: 108,
                                        height: 108,
                                        borderRadius: `${TEB_RADII.md}px`,
                                        bgcolor: TEB_COLORS.surface,
                                        border: `1px solid ${TEB_COLORS.border}`,
                                        display: "grid",
                                        placeItems: "center",
                                        p: 1,
                                    }}
                                >
                                    <img
                                        src={enamadImageSrc}
                                        alt="نماد اعتماد الکترونیکی طب احمدی"
                                        width={88}
                                        height={88}
                                        loading="lazy"
                                        style={{ display: "block", objectFit: "contain" }}
                                    />
                                </Box>
                            </Stack>
                        </Grid>
                    )}
                </Grid>

                <Divider sx={{ my: 3 }} />

                <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1.5}
                >
                    <Typography variant="caption" sx={{ color: TEB_COLORS.textSecondary, fontSize: "12.5px" }}>
                        © {new Date().getFullYear()} {appName} — تمامی حقوق محفوظ است.
                    </Typography>
                    <Stack direction="row" alignItems="center" gap={0.75} sx={{ color: TEB_COLORS.primaryDark }}>
                        <ShieldCheck size={15} />
                        <Typography variant="caption" sx={{ fontSize: "12px", fontWeight: 600 }}>
                            اصالت طبیعت، عیار تندرستی
                        </Typography>
                    </Stack>
                </Stack>
            </Container>
        </Box>
    );
}
