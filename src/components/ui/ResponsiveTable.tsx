"use client";

import { Box, type SxProps, type Theme } from "@mui/material";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

export type ResponsiveTableProps = {
    children: React.ReactNode;
    minWidth?: number | string;
    sx?: SxProps<Theme>;
};

export function ResponsiveTable({ children, minWidth = 680, sx }: ResponsiveTableProps) {
    return (
        <Box
            sx={{
                width: "100%",
                maxWidth: "100%",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                borderRadius: `${TEB_RADII.md}px`,
                border: `1px solid ${TEB_COLORS.border}`,
                bgcolor: TEB_COLORS.surface,
                "& table": {
                    minWidth,
                },
                ...sx,
            }}
        >
            {children}
        </Box>
    );
}
