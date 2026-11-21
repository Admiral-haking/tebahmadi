"use client";

import { Box, Fab, IconButton, Stack } from "@mui/material";
import { menu } from "../components/admin-menu";
import Link from "next/link";

const quickHrefs = new Set(["/admin", "/admin/orders", "/admin/catalog/products", "/admin/tracking"]);
const mobileQuickMenu = menu.filter((item) => quickHrefs.has(item.href));

export default function AdminHeaderMobile() {
    return <Stack
        component="header"
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
            px: 1.5,
            py: 0.75,
            zIndex: 99,
            position: 'fixed',
            bottom: 0,
            right: 0,
            left: 0,
            display: { xs: 'flex', md: 'none' },
            bgcolor: 'rgba(255,255,255,.92)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid',
            borderColor: 'divider',
            pb: 'calc(6px + env(safe-area-inset-bottom))',
        }}
    >
        {
            mobileQuickMenu.slice(0, 2).map(x => <IconButton
                key={x.title}
                LinkComponent={Link}
                href={x.href}
                aria-label={x.title}>
                {x.icon}
            </IconButton>)
        }


        <Box sx={{ minWidth: 56 }} />
        <Fab
            id="menu-admin-button-xs"
            aria-label="toggle admin menu"
            sx={{
                transform: 'translateY(-50%)',
                position: 'absolute',
                left: 0,
                right: 0,
                top: 2,
                mx: 'auto'
            }}
        >
            <svg xmlns="http://www.w3.org/2000/svg" width={38} height={38} viewBox="0 0 24 24">
                <path fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={1.5} d="M4 7h3m13 0h-9m9 10h-3M4 17h9m-9-5h16"></path>
            </svg>
        </Fab>

        {
            mobileQuickMenu.slice(2, 4).map(x => <IconButton
                key={x.title}
                LinkComponent={Link}
                href={x.href}
                aria-label={x.title}>
                {x.icon}
            </IconButton>)
        }
    </Stack>
}
