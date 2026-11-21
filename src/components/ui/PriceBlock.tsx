"use client";

import { Box, Stack, Typography } from "@mui/material";
import { TEB_COLORS } from "@/theme/tokens";
import { calculateDiscountPercent, formatFaNumber, formatPriceDigits } from "@/lib/format";

export type PriceBlockProps = {
    finalPrice: number;
    originalPrice?: number;
    discountPercent?: number;
    size?: "sm" | "md" | "lg";
    showDiscountBadge?: boolean;
};

export function PriceBlock({
    finalPrice,
    originalPrice,
    discountPercent,
    size = "md",
    showDiscountBadge = false,
}: PriceBlockProps) {
    const hasDiscount = typeof originalPrice === "number" && originalPrice > finalPrice;
    const resolvedDiscount = discountPercent ?? calculateDiscountPercent(originalPrice, finalPrice);

    const priceSize = size === "lg" ? 24 : size === "sm" ? 15 : 17;
    const oldSize = size === "lg" ? 14 : 12;

    return (
        <Stack spacing={0.25} sx={{ fontVariantNumeric: "tabular-nums" }}>
            {hasDiscount && (
                <Stack direction="row" alignItems="center" gap={0.75}>
                    <Typography
                        component="span"
                        sx={{
                            fontSize: `${oldSize}px`,
                            color: TEB_COLORS.textSecondary,
                            textDecoration: "line-through",
                            lineHeight: 1.3,
                        }}
                    >
                        {formatPriceDigits(originalPrice)}
                    </Typography>
                    {showDiscountBadge && resolvedDiscount && (
                        <Box
                            component="span"
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                px: 0.75,
                                py: 0.15,
                                borderRadius: "9999px",
                                bgcolor: TEB_COLORS.error,
                                color: "#FFFFFF",
                                fontSize: "11px",
                                fontWeight: 700,
                                lineHeight: 1.4,
                            }}
                        >
                            {formatFaNumber(resolvedDiscount)}٪
                        </Box>
                    )}
                </Stack>
            )}
            <Stack direction="row" alignItems="baseline" gap={0.5}>
                <Typography
                    component="span"
                    sx={{
                        fontSize: `${priceSize}px`,
                        fontWeight: 700,
                        color: TEB_COLORS.textPrimary,
                        lineHeight: 1.25,
                    }}
                >
                    {formatPriceDigits(finalPrice)}
                </Typography>
                <Typography
                    component="span"
                    sx={{
                        fontSize: size === "lg" ? "13px" : "11px",
                        color: TEB_COLORS.textSecondary,
                        fontWeight: 500,
                    }}
                >
                    تومان
                </Typography>
            </Stack>
        </Stack>
    );
}
