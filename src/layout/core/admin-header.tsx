"use client";

import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { menu } from "../components/admin-menu";
import { useWindowWidth } from "@/hooks/window-width";
import BarcodeFinder from "../components/barcode";

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
    const remain = width < 130 ? 0 : width - 130;

    const count = Math.trunc(remain / 130);
    return <Stack
        component="header"
        direction="row"
        alignItems="center"
        sx={{
            right: 0,
            p: 1,
            zIndex: 99
        }}
    >
        <IconButton id="menu-admin-button" aria-label="toggle admin menu">
            <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                <path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={1.5} d="M4 7h3m13 0h-9m9 10h-3M4 17h9m-9-5h16"></path>
            </svg>
        </IconButton>
        <BarcodeFinder />
        <Box
            sx={{
                borderRight: `1px solid var(--mui-palette-divider)`,
                height: 35,
                mx: 1
            }}
        />
        <Typography fontWeight="bold" variant="subtitle1">
            پنل مدیریت
        </Typography>
        <Box flex="1 1 auto" />
        {
            headerMenu
                .slice(2, count + 2)
                .map(x => <Button
                    key={x.title}
                    size="small"
                    LinkComponent={Link}
                    href={x.href}
                    sx={{ ml: 1 }}
                    startIcon={x.icon}
                >
                    {x.title}
                </Button>)
        }
    </Stack>
}
