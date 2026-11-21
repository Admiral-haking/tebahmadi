"use client";

import { Box, Fab, IconButton, Stack } from "@mui/material";
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

const mobileQuickMenu = menu.filter((item) => !drawerOnlyMenuHrefs.has(item.href));

export default function AdminHeaderMobile() {
    return (
        <Stack
            component="nav"
            aria-label="ناوبری سریع مدیریت"
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
                px: 1.25,
                py: 0.75,
                zIndex: 99,
                position: "fixed",
                bottom: 0,
                right: 0,
                left: 0,
                display: { xs: "flex", md: "none" },
                bgcolor: "rgba(255, 255, 255, 0.96)",
                backdropFilter: "blur(10px)",
                borderTop: `1px solid ${TEB_COLORS.border}`,
            }}
        >
            {mobileQuickMenu.slice(2, 5).map((x) => (
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

            <BarcodeFinder />

            <Box sx={{ minWidth: 52 }} />
            <Fab
                id="menu-admin-button-xs"
                aria-label="باز کردن منوی مدیریت"
                size="medium"
                sx={{
                    transform: "translateY(-45%)",
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    mx: "auto",
                    bgcolor: TEB_COLORS.primary,
                    color: "#FFFFFF",
                    "&:hover": { bgcolor: TEB_COLORS.primaryDark },
                }}
            >
                <Menu size={22} />
            </Fab>

            {mobileQuickMenu.slice(7, 10).map((x) => (
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
        </Stack>
    );
}

