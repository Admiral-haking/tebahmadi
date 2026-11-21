"use client";

import { Box, Button, IconButton, Paper, Stack, Typography } from "@mui/material";
import { Menu, ExternalLink } from "lucide-react";
import Link from "next/link";
import { menu } from "../components/admin-menu";
import { useWindowWidth } from "@/hooks/window-width";
import BarcodeFinder from "../components/barcode";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

const drawerOnlyMenuHrefs = new Set([
    "/admin/marketplace-health",
    "/admin/error-logs",
    "/admin/payment-quality",
    "/admin/inventory-comparison",
]);

const headerMenu = menu.filter((item) => !drawerOnlyMenuHrefs.has(item.href));

export default function AdminHeaderDesktop() {
    const _width = useWindowWidth();

    const width = _width > 1200 ? 1200 : _width;
    const remain = width < 130 ? 0 : width - 220;
    const count = Math.max(0, Math.min(5, Math.trunc(remain / 150)));

    return (
        <Paper
            component="header"
            elevation={0}
            sx={{
                mb: 2.5,
                px: 2,
                py: 1.25,
                borderRadius: `${TEB_RADII.lg}px`,
                border: `1px solid ${TEB_COLORS.border}`,
                bgcolor: "#FFFFFF",
                zIndex: 99,
            }}
        >
            <Stack direction="row" alignItems="center" gap={1}>
                <IconButton
                    id="menu-admin-button"
                    aria-label="باز کردن منوی مدیریت"
                    sx={{
                        display: { xs: "inline-flex", lg: "none" },
                        border: `1px solid ${TEB_COLORS.border}`,
                        color: TEB_COLORS.primary,
                    }}
                >
                    <Menu size={20} />
                </IconButton>
                <BarcodeFinder />
                <Box
                    sx={{
                        borderRight: `1px solid ${TEB_COLORS.border}`,
                        height: 28,
                        mx: 0.75,
                    }}
                />
                <Typography fontWeight={800} variant="subtitle1" color={TEB_COLORS.textPrimary}>
                    پنل مدیریت طب احمدی
                </Typography>
                <Box flex="1 1 auto" />
                {headerMenu.slice(2, count + 2).map((x) => (
                    <Button
                        key={x.title}
                        size="small"
                        LinkComponent={Link}
                        href={x.href}
                        sx={{
                            borderRadius: `${TEB_RADII.pill}px`,
                            color: TEB_COLORS.textPrimary,
                            fontWeight: 600,
                            px: 1.5,
                            "&:hover": { bgcolor: TEB_COLORS.surfaceSoft, color: TEB_COLORS.primary },
                        }}
                        startIcon={x.icon}
                    >
                        {x.title}
                    </Button>
                ))}
                <Button
                    size="small"
                    variant="outlined"
                    LinkComponent={Link}
                    href="/"
                    endIcon={<ExternalLink size={14} />}
                    sx={{
                        borderRadius: `${TEB_RADII.pill}px`,
                        borderColor: TEB_COLORS.border,
                        color: TEB_COLORS.primary,
                        fontWeight: 700,
                        px: 1.75,
                    }}
                >
                    مشاهده فروشگاه
                </Button>
            </Stack>
        </Paper>
    );
}

