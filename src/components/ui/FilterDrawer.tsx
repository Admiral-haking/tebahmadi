"use client";

import { Box, Button, Divider, Drawer, IconButton, Stack, Typography } from "@mui/material";
import { SlidersHorizontal, X } from "lucide-react";
import { TEB_COLORS } from "@/theme/tokens";

export type FilterDrawerProps = {
    open: boolean;
    onClose: () => void;
    title?: string;
    onReset?: () => void;
    onApply?: () => void;
    activeCount?: number;
    children: React.ReactNode;
};

export function FilterDrawer({
    open,
    onClose,
    title = "فیلترهای فروشگاه",
    onReset,
    onApply,
    activeCount = 0,
    children,
}: FilterDrawerProps) {
    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            ModalProps={{ keepMounted: false }}
            PaperProps={{
                sx: {
                    width: { xs: "90vw", sm: 380 },
                    maxWidth: "100vw",
                    bgcolor: TEB_COLORS.background,
                    display: "flex",
                    flexDirection: "column",
                },
            }}
        >
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                    px: 2.5,
                    py: 2,
                    bgcolor: TEB_COLORS.surface,
                    borderBottom: `1px solid ${TEB_COLORS.border}`,
                }}
            >
                <Stack direction="row" alignItems="center" gap={1}>
                    <SlidersHorizontal size={18} color={TEB_COLORS.primary} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: TEB_COLORS.textPrimary }}>
                        {title}
                    </Typography>
                </Stack>
                <IconButton
                    onClick={onClose}
                    aria-label="بستن فیلترها"
                    sx={{ width: 40, height: 40, color: TEB_COLORS.textPrimary }}
                >
                    <X size={20} />
                </IconButton>
            </Stack>

            <Box sx={{ flex: 1, overflowY: "auto", px: 2.5, py: 2.5 }}>
                {children}
            </Box>

            <Divider />

            <Stack
                direction="row"
                gap={1.5}
                sx={{
                    p: 2,
                    bgcolor: TEB_COLORS.surface,
                }}
            >
                {onReset && (
                    <Button
                        variant="outlined"
                        fullWidth
                        onClick={onReset}
                        disabled={activeCount === 0}
                    >
                        پاک کردن فیلترها
                    </Button>
                )}
                <Button
                    variant="contained"
                    fullWidth
                    onClick={() => {
                        onApply?.();
                        onClose();
                    }}
                >
                    اعمال فیلترها
                </Button>
            </Stack>
        </Drawer>
    );
}
