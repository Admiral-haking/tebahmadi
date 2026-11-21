import Link from "next/link";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { Phone, Truck } from "lucide-react";
import Logo from "@/components/logo";
import UserButton from "../components/user-button";
import CartButton from "../components/cart-button";
import MegaMenu from "../components/mega-menu";
import HeaderSearch from "../components/header-search";
import { loadCategoryTree } from "@/lib/cache";
import { BRAND } from "@/config/brand";
import { TEB_COLORS } from "@/theme/tokens";

const NAV_LINKS = [
    { label: "صفحه اصلی", href: "/" },
    { label: "فروشگاه", href: "/store" },
    { label: "مجله طب احمدی", href: "/blog" },
    { label: "پیگیری سفارش", href: "/orders" },
];

export default async function HeaderDesktop() {
    const categories = await loadCategoryTree();

    return (
        <Box
            component="header"
            sx={{
                display: { xs: "none", md: "block" },
                position: "sticky",
                top: 0,
                zIndex: 1050,
                bgcolor: "rgba(249, 248, 246, 0.92)",
                backdropFilter: "blur(12px)",
                borderBottom: `1px solid ${TEB_COLORS.border}`,
            }}
        >
            <Container maxWidth="lg" sx={{ px: 2.5 }}>
                {/* Row 1: Logo + Products MegaMenu + Search + Support + User + Cart */}
                <Stack
                    direction="row"
                    alignItems="center"
                    gap={2}
                    sx={{ py: 1.5 }}
                >
                    <Box sx={{ flexShrink: 0 }}>
                        <Logo size={42} showName />
                    </Box>

                    <MegaMenu categories={JSON.parse(JSON.stringify(categories as any))} />

                    <Box sx={{ flex: 1, maxWidth: 460 }}>
                        <HeaderSearch size="md" />
                    </Box>

                    <Stack direction="row" alignItems="center" gap={1.25} sx={{ mr: "auto", flexShrink: 0 }}>
                        <Button
                            component="a"
                            href={`tel:${BRAND.phone}`}
                            variant="outlined"
                            startIcon={<Phone size={16} strokeWidth={2} />}
                            sx={{
                                minHeight: 44,
                                px: 2,
                                borderRadius: "9999px",
                                bgcolor: TEB_COLORS.softSurface,
                                borderColor: TEB_COLORS.border,
                                color: TEB_COLORS.textPrimary,
                                fontSize: "13px",
                                fontWeight: 600,
                                whiteSpace: "nowrap",
                                "&:hover": {
                                    bgcolor: TEB_COLORS.surface,
                                    borderColor: TEB_COLORS.primary,
                                    color: TEB_COLORS.primary,
                                },
                            }}
                        >
                            پشتیبانی
                        </Button>

                        <UserButton />
                        <CartButton />
                    </Stack>
                </Stack>

                {/* Row 2: Shipping notice + clean single-line navigation */}
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={2}
                    sx={{
                        py: 1,
                        borderTop: `1px solid ${TEB_COLORS.border}`,
                    }}
                >
                    <Stack direction="row" alignItems="center" gap={3} component="nav" aria-label="ناوبری اصلی">
                        {NAV_LINKS.map((item) => (
                            <Box
                                key={item.href}
                                component={Link}
                                href={item.href}
                                sx={{
                                    fontSize: "13.5px",
                                    fontWeight: 600,
                                    color: TEB_COLORS.textPrimary,
                                    whiteSpace: "nowrap",
                                    py: 0.5,
                                    transition: "color 0.18s ease",
                                    "&:hover": {
                                        color: TEB_COLORS.primary,
                                    },
                                }}
                            >
                                {item.label}
                            </Box>
                        ))}
                    </Stack>

                    <Stack direction="row" alignItems="center" gap={0.75} sx={{ color: TEB_COLORS.textSecondary }}>
                        <Truck size={15} color={TEB_COLORS.primary} />
                        <Typography variant="caption" sx={{ fontSize: "12px", fontWeight: 500 }}>
                            آماده‌سازی و ارسال سفارش‌ها با پست پیشتاز در کوتاه‌ترین زمان
                        </Typography>
                    </Stack>
                </Stack>
            </Container>
        </Box>
    );
}
