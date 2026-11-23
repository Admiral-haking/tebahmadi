"use client";

import { Box, type SxProps, type Theme } from "@mui/material";
import { TEB_COLORS } from "@/theme/tokens";

export type StatusTone = "success" | "warning" | "error" | "neutral" | "gold";

export type StatusBadgeProps = {
    label: string;
    tone?: StatusTone;
    sx?: SxProps<Theme>;
};

const TONE_STYLES: Record<StatusTone, { bg: string; color: string; border: string }> = {
    success: {
        bg: "#EAF2EE",
        color: TEB_COLORS.primaryDark,
        border: "#CFE0D7",
    },
    warning: {
        bg: "#F8F2E4",
        color: "#85621E",
        border: "#E6D7B5",
    },
    error: {
        bg: TEB_COLORS.errorSoft,
        color: TEB_COLORS.error,
        border: "#E6C7C8",
    },
    gold: {
        bg: TEB_COLORS.goldSoft,
        color: "#7C5E22",
        border: "#DECAA0",
    },
    neutral: {
        bg: TEB_COLORS.softSurface,
        color: TEB_COLORS.textSecondary,
        border: TEB_COLORS.border,
    },
};

export function StatusBadge({ label, tone = "neutral", sx }: StatusBadgeProps) {
    const palette = TONE_STYLES[tone];

    return (
        <Box
            component="span"
            sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                px: 1.25,
                py: 0.35,
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                lineHeight: 1.4,
                whiteSpace: "nowrap",
                bgcolor: palette.bg,
                color: palette.color,
                border: `1px solid ${palette.border}`,
                ...sx,
            }}
        >
            {label}
        </Box>
    );
}
