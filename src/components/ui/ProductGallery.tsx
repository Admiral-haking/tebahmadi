"use client";

import { useState } from "react";
import { Box, Stack } from "@mui/material";
import OptimizedImage from "@/components/image";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";

export type ProductGalleryImage = {
    id: string;
    src: string;
    alt: string;
};

export type ProductGalleryProps = {
    images: ProductGalleryImage[];
    fallbackSrc?: string;
    discountBadge?: React.ReactNode;
};

const DEFAULT_FALLBACK = "/images/tebahmadi/herbal-tea.jpg";

export function ProductGallery({
    images,
    fallbackSrc = DEFAULT_FALLBACK,
    discountBadge,
}: ProductGalleryProps) {
    const safeImages =
        images.length > 0
            ? images
            : [{ id: "fallback", src: fallbackSrc, alt: "تصویر محصول طب احمدی" }];

    const [activeIndex, setActiveIndex] = useState(0);
    const boundedIndex = activeIndex < safeImages.length ? activeIndex : 0;
    const current = safeImages[boundedIndex];

    return (
        <Stack spacing={1.5}>
            <Box
                sx={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: `${TEB_RADII.lg}px`,
                    overflow: "hidden",
                    bgcolor: TEB_COLORS.softSurface,
                    border: `1px solid ${TEB_COLORS.border}`,
                }}
            >
                <OptimizedImage
                    src={current.src}
                    fallbackSrc={fallbackSrc}
                    alt={current.alt}
                    fill
                    priority
                    sizes="(max-width: 900px) 100vw, 50vw"
                    style={{ objectFit: "cover" }}
                />
                {discountBadge}
            </Box>

            {safeImages.length > 1 && (
                <Stack
                    direction="row"
                    gap={1}
                    sx={{
                        overflowX: "auto",
                        pb: 0.5,
                    }}
                >
                    {safeImages.map((image, index) => {
                        const isSelected = index === boundedIndex;
                        return (
                            <Box
                                key={image.id}
                                component="button"
                                type="button"
                                onClick={() => setActiveIndex(index)}
                                aria-label={`نمایش تصویر ${index + 1}`}
                                aria-pressed={isSelected}
                                sx={{
                                    position: "relative",
                                    width: 72,
                                    height: 72,
                                    flexShrink: 0,
                                    p: 0,
                                    borderRadius: `${TEB_RADII.md}px`,
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    bgcolor: TEB_COLORS.softSurface,
                                    border: `2px solid ${isSelected ? TEB_COLORS.primary : TEB_COLORS.border}`,
                                    transition: "border-color 0.18s ease, transform 0.15s ease",
                                    "&:hover": {
                                        borderColor: TEB_COLORS.primary,
                                    },
                                }}
                            >
                                <OptimizedImage
                                    src={image.src}
                                    fallbackSrc={fallbackSrc}
                                    alt={image.alt}
                                    fill
                                    sizes="72px"
                                    style={{ objectFit: "cover" }}
                                />
                            </Box>
                        );
                    })}
                </Stack>
            )}
        </Stack>
    );
}
