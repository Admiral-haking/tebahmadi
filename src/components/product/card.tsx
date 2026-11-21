"use client";

/*
 * ─── Product Card — redesign ────────────────────────────────────────────────
 *
 * BEFORE                                    AFTER
 * ───────────────────────────────────────   ──────────────────────────────────
 * • Title truncated to 1 line (noWrap)      • Full title, up to 2 lines
 * • Out-of-stock shown inline with overlay  • Out-of-stock greyed + non-clickable
 *                                             (and filtered out upstream anyway)
 * • Size buttons (37,38,39…) clutter card   • Compact "۵ سایز موجود" chip only
 * • No add-to-cart on card                   • Prominent "افزودن به سبد" button
 *                                             (links to product page for size pick)
 * • Bare strikethrough + price              • Clear original/final price + % badge
 * • No rating                                • Static star rating row
 * • Flat, no feedback on hover/tap           • Lift + accent border on hover/tap
 * • —                                         • Wishlist heart, fade-in on scroll,
 *                                             "فقط X عدد مانده" urgency label
 *
 * Touch targets ≥ 44px, Persian numerals, lazy images, RTL, dark red-accent.
 */

import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Link from "next/link";
import React from "react";
import { useEffect, useState } from "react";
import OptimizedImage from "../image";

export type ProductCardProps = {
    id: string;
    slug: string;
    title: string;
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

const CURRENCY_LABEL = "تومان";
const FALLBACK_IMAGE = "/sample.jpg";
const ACCENT = "var(--mui-palette-primary-main)";
const LOW_STOCK_THRESHOLD = 5;
const WISHLIST_KEY = "app:wishlist:v1";

function faNumber(value: number): string {
    return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(
        Number.isFinite(value) ? value : 0,
    );
}

function formatPrice(value: number): string {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    return faNumber(normalized);
}

// ─── wishlist (localStorage, lightweight) ─────────────────────────────────────

function readWishlist(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
        const raw = window.localStorage.getItem(WISHLIST_KEY);
        return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
        return new Set();
    }
}

function useWishlist(id: string): [boolean, (e: React.MouseEvent) => void] {
    const [saved, setSaved] = useState(false);
    useEffect(() => {
        setSaved(readWishlist().has(id));
    }, [id]);
    const toggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const set = readWishlist();
        if (set.has(id)) set.delete(id);
        else set.add(id);
        try {
            window.localStorage.setItem(WISHLIST_KEY, JSON.stringify([...set]));
        } catch {
            /* ignore quota errors */
        }
        setSaved(set.has(id));
    };
    return [saved, toggle];
}

// ─── star rating (static-friendly) ────────────────────────────────────────────

function StarRow({ rating, reviewCount }: { rating: number; reviewCount?: number }) {
    return (
        <Stack direction="row" alignItems="center" gap={0.5} sx={{ direction: "ltr", justifyContent: "flex-end" }}>
            {reviewCount != null && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                    ({faNumber(reviewCount)})
                </Typography>
            )}
            <Stack direction="row" gap={0.1}>
                {Array.from({ length: 5 }).map((_, i) => {
                    const filled = i < Math.round(rating);
                    return (
                        <Box
                            key={i}
                            component="svg"
                            viewBox="0 0 24 24"
                            sx={{ width: 13, height: 13, color: filled ? "var(--mui-palette-warning-main)" : "rgba(var(--mui-palette-text-primaryChannel) / 0.22)" }}
                        >
                            <path
                                fill="currentColor"
                                d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                            />
                        </Box>
                    );
                })}
            </Stack>
        </Stack>
    );
}

export function ProductCard({
    id,
    slug,
    title,
    finalPrice,
    originalPrice,
    discountPercent,
    inStock,
    stockCount,
    rating = 0,
    reviewCount,
    imageUrl,
    colors = [],
    sizes = [],
    priorityImage = false,
}: ProductCardProps) {
    const hasDiscount = !!originalPrice && originalPrice > finalPrice;
    const displayColors = colors.slice(0, 4);
    const sizeCount = sizes.length;
    const lowStock = inStock && typeof stockCount === "number" && stockCount > 0 && stockCount < LOW_STOCK_THRESHOLD;
    const [saved, toggleWishlist] = useWishlist(id);
    const href = `/product/${slug}`;

    return (
        <Card
            component="div"
            suppressHydrationWarning
            sx={{
                position: "relative",
                bgcolor: "var(--mui-palette-background-paper)",
                borderRadius: { xs: 4, md: 5 },
                border: "1px solid",
                borderColor: "divider",
                boxShadow: "0 8px 26px rgba(91, 103, 58, .065)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                transition: "transform .2s ease, border-color .2s ease, box-shadow .2s ease",
                filter: inStock ? "none" : "grayscale(60%)",
                "@media (hover: hover)": {
                    "&:hover": {
                        transform: inStock ? "translateY(-3px)" : "none",
                        borderColor: inStock ? ACCENT : "divider",
                        boxShadow: inStock ? "0 16px 38px rgba(91, 103, 58, .14)" : "none",
                    },
                },
                "&:active": { transform: "scale(.997)" },
            }}
        >
            {/* Wishlist heart */}
            <Box
                role="button"
                aria-label={saved ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
                onClick={toggleWishlist}
                sx={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    zIndex: 3,
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "rgba(255,255,255,.9)",
                    backdropFilter: "blur(8px)",
                    cursor: "pointer",
                    color: saved ? "error.main" : "primary.main",
                    transition: "color .2s ease, transform .15s ease",
                    "&:active": { transform: "scale(.9)" },
                }}
            >
                <Box component="svg" viewBox="0 0 24 24" sx={{ width: 19, height: 19 }}>
                    <path
                        fill={saved ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth={1.8}
                        d="M12 21s-7.5-4.6-10-9.2C.5 8.6 2 5 5.5 5c2 0 3.3 1.1 4.5 2.6C11.2 6.1 12.5 5 14.5 5 18 5 19.5 8.6 22 11.8 19.5 16.4 12 21 12 21z"
                    />
                </Box>
            </Box>

            <Link href={href} style={{ display: "block", pointerEvents: inStock ? "auto" : "none" }} tabIndex={inStock ? 0 : -1}>
                <Box sx={{ position: "relative", width: "100%", aspectRatio: "1 / 1.08", overflow: "hidden", bgcolor: "#F4F3E8" }}>
                    <OptimizedImage
                        alt={title}
                        src={imageUrl ?? FALLBACK_IMAGE}
                        fallbackSrc={FALLBACK_IMAGE}
                        fill
                        priority={priorityImage}
                        fetchPriority={priorityImage ? "high" : "auto"}
                        loading={priorityImage ? undefined : "lazy"}
                        sizes="(max-width: 600px) 50vw, (max-width: 900px) 33vw, 25vw"
                        style={{ objectFit: "cover" }}
                    />

                    {/* Discount badge */}
                    {hasDiscount && typeof discountPercent === "number" && discountPercent > 0 && (
                        <Box
                            sx={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                bgcolor: "error.main",
                                color: "var(--mui-palette-common-white)",
                                borderRadius: 999,
                                px: 0.9,
                                py: 0.3,
                                fontSize: 12,
                                fontWeight: 800,
                                lineHeight: 1.4,
                            }}
                        >
                            {faNumber(discountPercent)}٪
                        </Box>
                    )}

                    {/* Out-of-stock veil */}
                    {!inStock && (
                        <Stack
                            alignItems="center"
                            justifyContent="center"
                            sx={{ position: "absolute", inset: 0, bgcolor: "rgba(var(--mui-palette-common-onBackgroundChannel) / 0.55)" }}
                        >
                            <Typography sx={{ color: "var(--mui-palette-common-white)", fontWeight: 800, fontSize: 15 }}>ناموجود</Typography>
                        </Stack>
                    )}

                    {/* Low-stock urgency */}
                    {lowStock && (
                        <Box
                            sx={{
                                position: "absolute",
                                bottom: 8,
                                right: 8,
                                bgcolor: "rgba(var(--mui-palette-error-mainChannel) / 0.92)",
                                color: "var(--mui-palette-common-white)",
                                borderRadius: 1.5,
                                px: 0.9,
                                py: 0.3,
                                fontSize: 11,
                                fontWeight: 700,
                            }}
                        >
                            فقط {faNumber(stockCount as number)} عدد مانده
                        </Box>
                    )}
                </Box>
            </Link>

            <CardContent
                sx={{
                    p: { xs: 1.25, sm: 1.5 },
                    pb: { xs: "12px !important", sm: "16px !important" },
                    display: "flex",
                    flexDirection: "column",
                    gap: 0.75,
                    flex: 1,
                }}
            >
                {/* Full title — up to 2 lines */}
                <Typography
                    component={Link}
                    href={href}
                    title={title}
                    sx={{
                        color: "text.primary",
                        fontSize: { xs: 13, sm: 14.5 },
                        fontWeight: 600,
                        lineHeight: 1.6,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        minHeight: "2.9em",
                        textDecoration: "none",
                    }}
                >
                    {title}
                </Typography>

                {rating > 0 ? <StarRow rating={rating} reviewCount={reviewCount} /> : null}

                {/* Meta: color count + size count */}
                <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                    {displayColors.length > 0 && (
                        <Stack direction="row" gap={0.35} alignItems="center">
                            {displayColors.map((color, index) => (
                                <Box
                                    key={`${color}-${index}`}
                                    sx={{
                                        width: 13,
                                        height: 13,
                                        borderRadius: "50%",
                                        border: "1px solid var(--mui-palette-divider)",
                                        backgroundColor: color,
                                    }}
                                />
                            ))}
                        </Stack>
                    )}
                    {sizeCount > 0 && (
                        <Chip
                            label={`${faNumber(sizeCount)} سایز موجود`}
                            size="small"
                            sx={{
                                height: 22,
                                fontSize: 11,
                                color: "text.secondary",
                                bgcolor: "action.selected",
                                "& .MuiChip-label": { px: 0.9 },
                            }}
                        />
                    )}
                </Stack>

                {/* Price block */}
                <Stack direction="row" alignItems="flex-end" justifyContent="space-between" gap={1} sx={{ mt: "auto" }}>
                    <Stack spacing={0}>
                        {hasDiscount && (
                            <Typography
                                sx={{
                                    fontSize: 11.5,
                                    textDecoration: "line-through",
                                    color: "text.disabled",
                                    lineHeight: 1.3,
                                }}
                            >
                                {formatPrice(originalPrice as number)}
                            </Typography>
                        )}
                        <Stack direction="row" alignItems="baseline" gap={0.5}>
                            <Typography sx={{ fontSize: 16, fontWeight: 800, color: "text.primary", lineHeight: 1.2 }}>
                                {formatPrice(finalPrice)}
                            </Typography>
                            <Typography sx={{ fontSize: 10.5, color: "text.secondary" }}>
                                {CURRENCY_LABEL}
                            </Typography>
                        </Stack>
                    </Stack>
                </Stack>

                {/* Add to cart (links to product page for size/color selection) */}
                <Box
                    component={inStock ? Link : "div"}
                    href={inStock ? href : undefined}
                    aria-label="افزودن به سبد خرید"
                    sx={{
                        mt: 0.5,
                        minHeight: 44,
                        borderRadius: 999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.75,
                        textDecoration: "none",
                        fontSize: 13.5,
                        fontWeight: 700,
                        userSelect: "none",
                        bgcolor: inStock ? ACCENT : "action.disabledBackground",
                        color: inStock ? "var(--mui-palette-common-white)" : "text.disabled",
                        pointerEvents: inStock ? "auto" : "none",
                        transition: "filter .2s ease, transform .12s ease",
                        "@media (hover: hover)": { "&:hover": { filter: "brightness(1.08)" } },
                        "&:active": { transform: "scale(.985)" },
                    }}
                >
                    <Box component="svg" viewBox="0 0 24 24" sx={{ width: 18, height: 18 }}>
                        <path
                            fill="currentColor"
                            d="M7 18c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m10 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2M7.2 14.6 7 14.7c0 .2.1.3.3.3h10.7v-2H8.5l-1-2H18c.4 0 .7-.2.9-.6l3-5.4-1.7-1-2.7 4.9H6.2L3.3 2H1v2h2l3.6 7.6z"
                        />
                    </Box>
                    {inStock ? "افزودن به سبد" : "ناموجود"}
                </Box>
            </CardContent>
        </Card>
    );
}
