"use client";

import { Box, Drawer, IconButton, Stack, Typography } from "@mui/material";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import AdminMenu from "../components/admin-menu";
import { TEB_COLORS } from "@/theme/tokens";

export default function AdminDrawer() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const toggle = () => setOpen((last) => !last);
        const btnDesktop = window.document.getElementById("menu-admin-button");
        const btnMobile = window.document.getElementById("menu-admin-button-xs");

        btnDesktop?.addEventListener("click", toggle);
        btnMobile?.addEventListener("click", toggle);

        return () => {
            btnDesktop?.removeEventListener("click", toggle);
            btnMobile?.removeEventListener("click", toggle);
        };
    }, []);

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={() => setOpen(false)}
            PaperProps={{
                sx: {
                    width: { xs: "86vw", sm: 320 },
                    maxWidth: 340,
                    bgcolor: "#FFFFFF",
                    borderLeft: `1px solid ${TEB_COLORS.border}`,
                },
            }}
        >
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                    px: 2.25,
                    py: 1.75,
                    bgcolor: TEB_COLORS.surfaceSoft,
                    borderBottom: `1px solid ${TEB_COLORS.border}`,
                }}
            >
                <Typography fontWeight={800} variant="subtitle1" color={TEB_COLORS.primaryDark}>
                    منوی مدیریت طب احمدی
                </Typography>

                <IconButton
                    aria-label="بستن منو"
                    onClick={() => setOpen(false)}
                    sx={{ width: 40, height: 40, color: TEB_COLORS.textPrimary }}
                >
                    <X size={20} />
                </IconButton>
            </Stack>

            <Box
                onClick={() => setOpen(false)}
                sx={{
                    flex: 1,
                    overflowY: "auto",
                    p: 1.5,
                }}
            >
                <AdminMenu />
            </Box>
        </Drawer>
    );
}

