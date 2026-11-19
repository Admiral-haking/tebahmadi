"use client"

import { Box, Drawer, IconButton, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import AdminMenu from "../components/admin-menu";

export default function AdminDrawer() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const btn = window.document.getElementById("menu-admin-button");

        if (!btn) return;

        btn.onclick = function () {
            setOpen(last => !last)
        }
    }, [])
    useEffect(() => {
        const btn = window.document.getElementById("menu-admin-button-xs");

        if (!btn) return;

        btn.onclick = function () {
            setOpen(last => !last)
        }
    }, [])
    return <Drawer
        open={open}
        onClose={() => setOpen(false)}
        onClick={() => setOpen(false)}
    >
        <Box sx={{
            maxHeight: '100vh',
            overflowY: 'scroll',
            minWidth: 300,
            height: '100%',
            p: 2,
            bgcolor: 'background.paper',
            py: 10
        }}>
            <AdminMenu />
        </Box>

        <Stack
            direction="row"
            alignItems="center"
            gap={2}
            justifyContent="space-between"
            sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                left: 0,
                p: 2,
                bgcolor: 'background.default'
            }}
        >
            <Typography fontWeight="bold" variant="subtitle1">
                منوی مدیریت
            </Typography>

            <IconButton aria-label="close menu" onClick={() => setOpen(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                    <path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z"></path>
                </svg>
            </IconButton>
        </Stack>
    </Drawer>
}
