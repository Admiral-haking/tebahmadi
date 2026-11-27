"use client";

import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import { Menu } from "lucide-react";
import { menu } from "../components/admin-menu";
import Link from "next/link";
import BarcodeFinder from "../components/barcode";
import { TEB_COLORS } from "@/theme/tokens";

const drawerOnlyMenuHrefs = new Set([
    "/admin/marketplace-health",
    "/admin/error-logs",
    "/admin/payment-quality",
    "/admin/inventory-comparison",
]);

const mobileQuickMenuHrefs = new Set([
    "/admin",
    "/admin/catalog/products",
    "/admin/orders",
    "/admin/support",
]);
const mobileQuickMenu = menu.filter((item) => !drawerOnlyMenuHrefs.has(item.href) && mobileQuickMenuHrefs.has(item.href));

export default function AdminHeaderMobile() {
    return (
        <>
            <Stack
                component="header"
                direction="row"
                alignItems="center"
                gap={1}
                sx={{
                    px: 1.25,
                    py: 1,
                    zIndex: 1100,
                    position: "fixed",
                    top: 0,
                    right: 0,
                    left: 0,
                    display: { xs: "flex", md: "none" },
                    bgcolor: "rgba(255, 255, 255, 0.97)",
                    backdropFilter: "blur(10px)",
                    borderBottom: `1px solid ${TEB_COLORS.border}`,
                }}
            >
                <IconButton
                    id="menu-admin-button-xs"
                    aria-label="باز کردن منوی مدیریت"
                    sx={{
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        bgcolor: TEB_COLORS.primary,
                        color: "#FFFFFF",
                        "&:hover": { bgcolor: TEB_COLORS.primaryDark },
                    }}
                >
                    <Menu size={21} />
                </IconButton>
                <Stack spacing={0} sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={800} fontSize={14} noWrap>
                        پنل مدیریت طب احمدی
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                        مدیریت فروشگاه و سفارش‌ها
                    </Typography>
                </Stack>
                <Button
                    component={Link}
                    href="/"
                    size="small"
                    variant="outlined"
                    sx={{ minHeight: 38, px: 1.25, flexShrink: 0, fontSize: 11 }}
                >
                    فروشگاه
                </Button>
            </Stack>

            <Stack
                component="nav"
                aria-label="ناوبری سریع مدیریت"
                direction="row"
                alignItems="center"
                justifyContent="space-around"
                sx={{
                    px: 0.5,
                    py: 0.5,
                    zIndex: 1090,
                    position: "fixed",
                    bottom: 0,
                    right: 0,
                    left: 0,
                    display: { xs: "flex", md: "none" },
                    bgcolor: "rgba(255, 255, 255, 0.97)",
                    backdropFilter: "blur(10px)",
                    borderTop: `1px solid ${TEB_COLORS.border}`,
                }}
            >
                {mobileQuickMenu.map((x) => (
                    <IconButton
                        key={x.title}
                        LinkComponent={Link}
                        href={x.href}
                        aria-label={x.title}
                        sx={{ width: 44, height: 44, color: TEB_COLORS.textPrimary }}
                    >
                        {x.icon}
                    </IconButton>
                ))}
                <Box sx={{ width: 44, height: 44, display: "grid", placeItems: "center" }}>
                    <BarcodeFinder />
                </Box>
            </Stack>
        </>
    );
}
