"use client";

import React from "react";
import Link from "next/link";
import { Box, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import { ShoppingBag } from "lucide-react";
import OptimizedImage from "../image";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";
import { PriceBlock } from "@/components/ui/PriceBlock";
import { calculateDiscountPercent, formatFaNumber } from "@/lib/format";

export type ProductCardProps = {
    id: string;
    slug: string;
    title: string;
    variantSubtitle?: string;
    finalPrice: number;
    originalPrice?: number;
    discountPercent?: number;
    inStock: boolean;
    stockCount?: number;
    rating?: number;
    reviewCount?: number;
    imageUrl?: string;
    colors?: string[];
    sizes?: string[];
    priorityImage?: boolean;
};

const FALLBACK_IMAGE = "/product-placeholder.svg";
const LOW_STOCK_THRESHOLD = 5;

export function ProductCard({
    slug,
    title,
    variantSubtitle,
    finalPrice,
    originalPrice,
    discountPercent,
    inStock,
    stockCount,
    imageUrl,
    sizes = [],
    priorityImage = false,
}: ProductCardProps) {
    const resolvedDiscount = discountPercent ?? calculateDiscountPercent(originalPrice, finalPrice);
    const hasDiscount = typeof resolvedDiscount === "number" && resolvedDiscount > 0;
    const isLowStock =
        inStock && typeof stockCount === "number" && stockCount > 0 && stockCount <= LOW_STOCK_THRESHOLD;

    const resolvedVariantLabel =
        variantSubtitle ??
        (sizes.length > 1
            ? `${formatFaNumber(sizes.length)} بسته‌بندی موجود`
            : sizes.length === 1
                ? sizes[0]
                : "بسته‌بندی استاندارد طب احمدی");

    const href = `/product/${slug}`;

    return (
        <Card
            component="article"
            sx={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                minWidth: 0,
                bgcolor: TEB_COLORS.surface,
                borderRadius: `${TEB_RADII.lg}px`,
                border: `1px solid ${TEB_COLORS.border}`,
                overflow: "hidden",
                transition: "border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease",
                opacity: inStock ? 1 : 0.78,
                "@media (hover: hover)": {
                    "&:hover": {
                        borderColor: inStock ? TEB_COLORS.primary : TEB_COLORS.border,
                        boxShadow: inStock ? "0 10px 28px -14px rgba(42, 90, 68, 0.24)" : "none",
                        transform: inStock ? "translateY(-2px)" : "none",
                    },
                },
            }}
        >
            {/* 1. Fixed aspect-ratio image + 2. Discount / Stock indicator */}
            <Link
                href={href}
                style={{ display: "block", textDecoration: "none" }}
                aria-label={title}
            >
                <Box
                    sx={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: "1 / 1",
                        bgcolor: TEB_COLORS.softSurface,
                        overflow: "hidden",
                    }}
                >
                    <OptimizedImage
                        alt={title}
                        src={imageUrl ?? FALLBACK_IMAGE}
                        fallbackSrc={FALLBACK_IMAGE}
                        fill
                        priority={priorityImage}
                        fetchPriority={priorityImage ? "high" : "auto"}
                        loading={priorityImage ? undefined : "lazy"}
                        sizes="(max-width: 600px) 46vw, (max-width: 900px) 30vw, 260px"
                        style={{ objectFit: "cover" }}
                    />

                    {/* Discount badge */}
                    {hasDiscount && inStock && (
                        <Box
                            sx={{
                                position: "absolute",
                                top: 10,
                                right: 10,
                                zIndex: 2,
                                minWidth: 42,
                                height: 28,
                                px: 1,
                                borderRadius: "8px",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                bgcolor: TEB_COLORS.error,
                                color: "#FFFFFF",
                                fontSize: "12px",
                                fontWeight: 700,
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {formatFaNumber(resolvedDiscount)}٪
                        </Box>
                    )}

                    {/* Out of stock badge */}
                    {!inStock && (
                        <Box
                            sx={{
                                position: "absolute",
                                top: 10,
                                right: 10,
                                zIndex: 2,
                                px: 1.25,
                                py: 0.4,
                                borderRadius: "8px",
                                bgcolor: "rgba(34, 34, 34, 0.76)",
                                color: "#FFFFFF",
                                fontSize: "11px",
                                fontWeight: 700,
                            }}
                        >
                            ناموجود
                        </Box>
                    )}
                </Box>
            </Link>

            <CardContent
                sx={{
                    p: { xs: 1.5, sm: 2 },
                    pb: { xs: "14px !important", sm: "16px !important" },
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    flex: 1,
                    minWidth: 0,
                }}
            >
                {/* 3. Product Name */}
                <Typography
                    component={Link}
                    href={href}
                    title={title}
                    sx={{
                        color: TEB_COLORS.textPrimary,
                        fontSize: { xs: "13px", sm: "14px" },
                        fontWeight: 700,
                        lineHeight: 1.6,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        minHeight: "3.2em",
                        textDecoration: "none",
                        "&:hover": { color: TEB_COLORS.primary },
                    }}
                >
                    {title}
                </Typography>

                {/* 4. Variant title */}
                <Typography
                    variant="caption"
                    noWrap
                    sx={{
                        color: TEB_COLORS.textSecondary,
                        fontSize: "12px",
                        lineHeight: 1.4,
                    }}
                >
                    {resolvedVariantLabel}
                </Typography>

                <Divider sx={{ my: 0.25 }} />

                {/* 5. Previous and current price */}
                <Box sx={{ mt: "auto" }}>
                    <PriceBlock
                        finalPrice={finalPrice}
                        originalPrice={originalPrice}
                        discountPercent={resolvedDiscount}
                        size="sm"
                    />
                </Box>

                {/* 6. Stock status */}
                <Typography
                    variant="caption"
                    sx={{
                        fontSize: "11.5px",
                        fontWeight: 600,
                        color: !inStock
                            ? TEB_COLORS.textSecondary
                            : isLowStock
                                ? TEB_COLORS.error
                                : TEB_COLORS.primary,
                    }}
                >
                    {!inStock
                        ? "اتمام موجودی"
                        : isLowStock
                            ? `تنها ${formatFaNumber(stockCount!)} عدد در انبار`
                            : "موجود و آماده ارسال"}
                </Typography>

                {/* 7. Add to cart CTA (>= 44px touch target) */}
                <Box
                    component={inStock ? Link : "div"}
                    href={inStock ? href : undefined}
                    aria-label={inStock ? `افزودن ${title} به سبد خرید` : "ناموجود"}
                    sx={{
                        mt: 0.5,
                        minHeight: 44,
                        px: 1.5,
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.75,
                        fontSize: { xs: "12.5px", sm: "13px" },
                        fontWeight: 700,
                        textDecoration: "none",
                        userSelect: "none",
                        bgcolor: inStock ? TEB_COLORS.primary : TEB_COLORS.softSurface,
                        color: inStock ? "#FFFFFF" : TEB_COLORS.textSecondary,
                        border: inStock ? "1px solid transparent" : `1px solid ${TEB_COLORS.border}`,
                        pointerEvents: inStock ? "auto" : "none",
                        transition: "background-color 0.2s ease, transform 0.15s ease",
                        "@media (hover: hover)": {
                            "&:hover": {
                                bgcolor: TEB_COLORS.primaryDark,
                            },
                        },
                        "&:active": {
                            transform: "scale(0.985)",
                        },
                    }}
                >
                    <ShoppingBag size={16} strokeWidth={2} />
                    <span>{inStock ? "افزودن به سبد" : "ناموجود"}</span>
                </Box>
            </CardContent>
        </Card>
    );
}
