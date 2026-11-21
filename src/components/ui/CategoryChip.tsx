"use client";

import Link from "next/link";
import { Box, Typography } from "@mui/material";
import { TEB_COLORS } from "@/theme/tokens";

export type CategoryChipProps = {
    label: string;
    href?: string;
    active?: boolean;
    onClick?: () => void;
    icon?: React.ReactNode;
};

export function CategoryChip({
    label,
    href,
    active = false,
    onClick,
    icon,
}: CategoryChipProps) {
    const commonSx = {
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        minHeight: 40,
        px: 2,
        py: 0.75,
        borderRadius: "9999px",
        fontSize: "13px",
        fontWeight: active ? 700 : 500,
        whiteSpace: "nowrap",
        cursor: "pointer",
        textDecoration: "none",
        transition: "background-color 0.18s ease, border-color 0.18s ease, color 0.18s ease",
        bgcolor: active ? TEB_COLORS.primary : TEB_COLORS.surface,
        color: active ? "#FFFFFF" : TEB_COLORS.textPrimary,
        border: `1px solid ${active ? TEB_COLORS.primary : TEB_COLORS.border}`,
        "&:hover": {
            bgcolor: active ? TEB_COLORS.primaryDark : TEB_COLORS.softSurface,
            borderColor: TEB_COLORS.primary,
        },
    } as const;

    if (href) {
        return (
            <Box component={Link} href={href} sx={commonSx}>
                {icon}
                <Typography component="span" sx={{ fontSize: "inherit", fontWeight: "inherit" }}>
                    {label}
                </Typography>
            </Box>
        );
    }

    return (
        <Box component="button" type="button" onClick={onClick} sx={{ ...commonSx, fontFamily: "inherit" }}>
            {icon}
            <Typography component="span" sx={{ fontSize: "inherit", fontWeight: "inherit" }}>
                {label}
            </Typography>
        </Box>
    );
}
