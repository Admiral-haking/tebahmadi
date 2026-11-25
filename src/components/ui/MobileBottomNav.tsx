"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge, Box, NoSsr, Stack, Typography } from "@mui/material";
import { useCart } from "@/components/cart/useCart";
import { useAuth } from "@/auth";
import { TEB_COLORS } from "@/theme/tokens";
import { formatFaNumber } from "@/lib/format";
import { BrandIcon, type BrandIconName } from "@/components/brand-icons";
import type { AuthUser } from "@/auth";

function hasElevatedRole(user: AuthUser | null): boolean {
    return Boolean(user?.roles?.some((role) => role !== "customer"));
}

export function MobileBottomNav() {
    const pathname = usePathname() || "/";
    const { itemsCount } = useCart();
    const { user } = useAuth();

    if (pathname.startsWith("/admin")) {
        return null;
    }

    const items: Array<{ key: string; label: string; href: string; icon: BrandIconName; active: boolean; badge?: number }> = [
        {
            key: "home",
            label: "خانه",
            href: "/",
            icon: "home",
            active: pathname === "/",
        },
        {
            key: "store",
            label: "فروشگاه",
            href: "/store",
            icon: "store",
            active:
                pathname.startsWith("/store") ||
                pathname.startsWith("/product") ||
                pathname.startsWith("/search"),
        },
        {
            key: "cart",
            label: "سبد خرید",
            href: "/cart",
            icon: "cart",
            active: pathname.startsWith("/cart"),
            badge: itemsCount,
        },
        ...(hasElevatedRole(user)
            ? [{
                key: "admin",
                label: "پنل مدیریت",
                href: "/admin",
                icon: "authenticity" as const,
                active: pathname.startsWith("/admin"),
            }]
            : []),
        {
            key: "account",
            label: user ? "سفارش‌ها" : "حساب کاربری",
            href: user ? "/orders" : "/auth",
            icon: user ? "orders" : "account",
            active: pathname.startsWith("/orders") || pathname.startsWith("/auth"),
        },
    ];

    return (
        <Box
            component="nav"
            className="teb-mobile-bottom-nav"
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
                                    borderRadius: "8px",
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
                                            <BrandIcon name={item.icon} size={18} strokeWidth={2} />
                                        </Badge>
                                    </NoSsr>
                                ) : (
                                    <BrandIcon name={item.icon} size={18} strokeWidth={2} />
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
