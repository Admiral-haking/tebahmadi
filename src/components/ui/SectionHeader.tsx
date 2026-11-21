"use client";

import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import { ArrowLeft, Sprout } from "lucide-react";
import { TEB_COLORS } from "@/theme/tokens";

export type SectionHeaderProps = {
    title: string;
    subtitle?: string;
    href?: string;
    ctaLabel?: string;
    align?: "center" | "start";
};

export function SectionHeader({
    title,
    subtitle,
    href,
    ctaLabel = "مشاهده همه",
    align = "center",
}: SectionHeaderProps) {
    const isCentered = align === "center";

    return (
        <Stack
            direction={{ xs: "column", sm: isCentered ? "column" : "row" }}
            alignItems={isCentered ? "center" : { xs: "flex-start", sm: "flex-end" }}
            justifyContent="space-between"
            spacing={1}
            sx={{ mb: { xs: 2.5, md: 3.5 }, textAlign: isCentered ? "center" : "start" }}
        >
            <Stack spacing={0.75} alignItems={isCentered ? "center" : "flex-start"}>
                <Box
                    aria-hidden="true"
                    sx={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        bgcolor: TEB_COLORS.softSurface,
                        border: `1px solid ${TEB_COLORS.border}`,
                        color: TEB_COLORS.primary,
                    }}
                >
                    <Sprout size={17} strokeWidth={1.8} />
                </Box>
                <Typography
                    variant="h3"
                    component="h2"
                    sx={{
                        fontSize: { xs: "20px", sm: "24px", md: "28px" },
                        fontWeight: 700,
                        color: TEB_COLORS.textPrimary,
                        lineHeight: 1.35,
                    }}
                >
                    {title}
                </Typography>
                {subtitle && (
                    <Typography
                        variant="body2"
                        sx={{
                            color: TEB_COLORS.textSecondary,
                            maxWidth: 560,
                            fontSize: { xs: "13px", md: "14px" },
                        }}
                    >
                        {subtitle}
                    </Typography>
                )}
            </Stack>

            {href && (
                <Button
                    component={Link}
                    href={href}
                    variant="text"
                    size="small"
                    endIcon={<ArrowLeft size={16} />}
                    sx={{
                        color: TEB_COLORS.primary,
                        fontWeight: 600,
                        px: 1.5,
                        minHeight: 40,
                        "&:hover": {
                            bgcolor: TEB_COLORS.softSurface,
                        },
                    }}
                >
                    {ctaLabel}
                </Button>
            )}
        </Stack>
    );
}
