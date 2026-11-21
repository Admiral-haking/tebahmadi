"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge, Box, NoSsr, Stack, Typography } from "@mui/material";
import { Home, ShoppingBag, Store, User } from "lucide-react";
import { useCart } from "@/components/cart/useCart";
import { useAuth } from "@/auth";
import { TEB_COLORS } from "@/theme/tokens";
import { formatFaNumber } from "@/lib/format";

export function MobileBottomNav() {
    const pathname = usePathname() || "/";
    const { itemsCount } = useCart();
    const { user } = useAuth();

    if (pathname.startsWith("/admin")) {
        return null;
    }

    const items = [
        {
            key: "home",
            label: "خانه",
            href: "/",
            icon: Home,
            active: pathname === "/",
        },
        {
            key: "store",
            label: "فروشگاه",
            href: "/store",
            icon: Store,
            active:
                pathname.startsWith("/store") ||
                pathname.startsWith("/product") ||
                pathname.startsWith("/search"),
        },
        {
            key: "cart",
            label: "سبد خرید",
            href: "/cart",
            icon: ShoppingBag,
            active: pathname.startsWith("/cart"),
            badge: itemsCount,
        },
        {
            key: "account",
            label: user ? "سفارش‌ها" : "حساب کاربری",
            href: user ? "/orders" : "/auth",
            icon: User,
            active: pathname.startsWith("/orders") || pathname.startsWith("/auth"),
        },
    ];

    return (
        <Box
            component="nav"
            aria-label="ناوبری پایین موبایل"
            sx={{
                display: { xs: "block", md: "none" },
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1100,
                bgcolor: "rgba(255, 255, 255, 0.96)",
                backdropFilter: "blur(10px)",
                borderTop: `1px solid ${TEB_COLORS.border}`,
                pb: "env(safe-area-inset-bottom)",
            }}
        >
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-around"
                sx={{ height: 60, px: 1 }}
            >
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Box
                            key={item.key}
                            component={Link}
                            href={item.href}
                            aria-current={item.active ? "page" : undefined}
                            sx={{
                                flex: 1,
                                minHeight: 46,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 0.3,
                                textDecoration: "none",
                                color: item.active ? TEB_COLORS.primary : TEB_COLORS.textSecondary,
                            }}
                        >
                            <Box
                                sx={{
                                    width: 36,
                                    height: 28,
                                    borderRadius: "9999px",
                                    display: "grid",
                                    placeItems: "center",
                                    bgcolor: item.active ? TEB_COLORS.primary : "transparent",
                                    color: item.active ? "#FFFFFF" : "inherit",
                                    transition: "background-color 0.18s ease, color 0.18s ease",
                                }}
                            >
                                {typeof item.badge === "number" ? (
                                    <NoSsr>
                                        <Badge
                                            badgeContent={item.badge > 0 ? formatFaNumber(item.badge) : null}
                                            sx={{
                                                "& .MuiBadge-badge": {
                                                    fontSize: "10px",
                                                    minWidth: 16,
                                                    height: 16,
                                                    bgcolor: TEB_COLORS.error,
                                                    color: "#FFFFFF",
                                                    fontWeight: 700,
                                                },
                                            }}
                                        >
                                            <Icon size={18} strokeWidth={2} />
                                        </Badge>
                                    </NoSsr>
                                ) : (
                                    <Icon size={18} strokeWidth={2} />
                                )}
                            </Box>
                            <Typography
                                component="span"
                                sx={{
                                    fontSize: "11px",
                                    fontWeight: item.active ? 700 : 500,
                                    lineHeight: 1.1,
                                }}
                            >
                                {item.label}
                            </Typography>
                        </Box>
                    );
                })}
            </Stack>
        </Box>
    );
}
