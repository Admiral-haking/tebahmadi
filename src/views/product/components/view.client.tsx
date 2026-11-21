"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
    Alert,
    Box,
    Breadcrumbs,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    Rating,
    Stack,
    Typography,
} from "@mui/material";
import {
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    Leaf,
    PackageCheck,
    Scale,
    ShoppingBag,
    Sparkles,
    Truck,
} from "lucide-react";
import { useCart } from "@/components/cart/useCart";
import { ProductGallery } from "@/components/ui/ProductGallery";
import { PriceBlock } from "@/components/ui/PriceBlock";
import { QuantityControl } from "@/components/ui/QuantityControl";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type {
    ProductDetailData,
    ProductVariantDetail,
    VariantAttributeDefinition,
} from "../data";
import { TEB_COLORS, TEB_RADII } from "@/theme/tokens";
import { formatFaNumber, formatPersianDate } from "@/lib/format";

type AttributeSelection = Record<string, string | undefined>;

function filterVariants(
    variants: ProductVariantDetail[],
    selections: AttributeSelection,
    attributes: VariantAttributeDefinition[],
): ProductVariantDetail[] {
    return variants.filter((variant) =>
        attributes.every((attr) => {
            const selectedValue = selections[attr.key];
            if (!selectedValue) return true;
            return variant.variantAttributeValues?.[attr.key] === selectedValue;
        }),
    );
}

function parseDescriptionSections(description?: string): Array<{ title: string; body: string; tone?: "warning" }> {
    if (!description || !description.trim()) {
        return [
            {
                title: "معرفی محصول",
                body: "محصول طبیعی و دست‌چین فروشگاه طب احمدی با بسته‌بندی استاندارد و حفظ حداکثری عطر و تازگی.",
            },
        ];
    }

    const cleaned = description.replace(/<[^>]+>/g, "\n").trim();
    const knownHeaders: Array<{ prefix: string; title: string; tone?: "warning" }> = [
        { prefix: "معرفی:", title: "معرفی محصول" },
        { prefix: "ترکیبات:", title: "ترکیبات و مواد مؤثره" },
        { prefix: "روش مصرف:", title: "روش مصرف و دم‌آوری" },
        { prefix: "هشدار مصرف:", title: "هشدار و شرایط نگهداری", tone: "warning" },
    ];

    const paragraphs = cleaned
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);

    const parsed: Array<{ title: string; body: string; tone?: "warning" }> = [];
    paragraphs.forEach((para) => {
        const matched = knownHeaders.find((h) => para.startsWith(h.prefix));
        if (matched) {
            parsed.push({
                title: matched.title,
                body: para.slice(matched.prefix.length).trim(),
                tone: matched.tone,
            });
        } else if (parsed.length === 0) {
            parsed.push({ title: "معرفی محصول", body: para });
        } else {
            parsed[parsed.length - 1].body += `\n${para}`;
        }
    });

    if (!parsed.some((s) => s.tone === "warning")) {
        parsed.push({
            title: "شرایط نگهداری و هشدار مصرف",
            body: "در ظرف دربسته، دور از نور مستقیم آفتاب و رطوبت نگهداری شود. در دوران بارداری، شیردهی یا مصرف داروهای خاص، پیش از مصرف مداوم با پزشک مشورت فرمایید.",
            tone: "warning",
        });
    }

    return parsed;
}

export default function ProductDetailClient({
    product,
    initialVariantId,
}: {
    product: ProductDetailData;
    initialVariantId?: string;
}) {
    const { addFixedLine, addPerUnitLine } = useCart();
    const variantAttributes = product.variantAttributes ?? [];

    const initialSelections = useMemo<AttributeSelection>(() => {
        const target =
            (initialVariantId ? product.variants.find((v) => v.id === initialVariantId) : undefined) ??
            product.variants.find((v) => v.inventoryQuantity > 0) ??
            product.variants[0];

        const next: AttributeSelection = {};
        if (target) {
            variantAttributes.forEach((attr) => {
                const val = target.variantAttributeValues?.[attr.key];
                if (val) next[attr.key] = val;
            });
        }
        return next;
    }, [initialVariantId, product.variants, variantAttributes]);

    const [selections, setSelections] = useState<AttributeSelection>(initialSelections);
    const [quantity, setQuantity] = useState(1);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [addedDialogOpen, setAddedDialogOpen] = useState(false);

    useEffect(() => {
        setSelections(initialSelections);
    }, [initialSelections]);

    const matchingVariants = useMemo(
        () => filterVariants(product.variants, selections, variantAttributes),
        [product.variants, selections, variantAttributes],
    );

    const activeVariant = matchingVariants[0] ?? product.variants[0];
    const inStock = (activeVariant?.inventoryQuantity ?? 0) > 0;
    const maxOrder = Math.max(
        1,
        Math.min(
            activeVariant?.maximumOrderQuantity ?? 99,
            activeVariant?.inventoryQuantity ?? 99,
        ),
    );
    const minOrder = Math.max(1, activeVariant?.minimumOrderQuantity ?? 1);

    useEffect(() => {
        setQuantity(minOrder);
    }, [activeVariant?.id, minOrder]);

    const galleryImages = useMemo(() => {
        const media = activeVariant?.media ?? [];
        return media
            .map((item, idx) => ({
                id: `${item.id}-${idx}`,
                src: item.fullUrl ?? item.previewUrl ?? item.url ?? "/images/tebahmadi/herbal-tea.jpg",
                alt: `${product.title} - تصویر ${idx + 1}`,
            }))
            .filter((img) => Boolean(img.src));
    }, [activeVariant, product.title]);

    const handleSelectOption = useCallback(
        (attrKey: string, value: string) => {
            setSelections((prev) => ({ ...prev, [attrKey]: value }));
            setErrorMessage(null);
        },
        [],
    );

    const handleAddToCart = () => {
        if (!activeVariant) {
            setErrorMessage("لطفاً بسته‌بندی محصول را انتخاب کنید.");
            return;
        }
        if (!inStock) {
            setErrorMessage("این محصول در حال حاضر ناموجود است.");
            return;
        }

        const line = {
            productId: product.id,
            productSlug: product.slug,
            title: product.title,
            variantId: activeVariant.id,
            sku: activeVariant.sku,
            priceModel: activeVariant.priceModel,
            unitOfMeasure: activeVariant.unitOfMeasure,
            unitPriceBase: activeVariant.unitPrice,
            variantOfferAmount: activeVariant.offerAmount ?? 0,
            mediaThumbId: activeVariant.mediaThumbId,
            attributesSummary: activeVariant.attributesSummary || undefined,
            weightGramsPerUnit: activeVariant.weightGramsPerUnit,
            minimumOrderQuantity: activeVariant.minimumOrderQuantity,
            maximumOrderQuantity: activeVariant.maximumOrderQuantity,
        } as const;

        if (activeVariant.priceModel === "per_unit") {
            addPerUnitLine(line, quantity, activeVariant.unitOfMeasure);
        } else {
            addFixedLine(line, quantity);
        }

        setErrorMessage(null);
        setAddedDialogOpen(true);
    };

    const descriptionSections = useMemo(
        () => parseDescriptionSections(product.description),
        [product.description],
    );

    const reviews = product.reviews ?? [];

    return (
        <>
            {/* Breadcrumb */}
            <Breadcrumbs
                separator={<ChevronLeft size={14} color={TEB_COLORS.textSecondary} />}
                aria-label="مسیر محصول"
                sx={{ mb: 2.5, fontSize: "12.5px" }}
            >
                <Box component={Link} href="/" sx={{ color: TEB_COLORS.textSecondary }}>
                    خانه
                </Box>
                <Box component={Link} href="/store" sx={{ color: TEB_COLORS.textSecondary }}>
                    فروشگاه
                </Box>
                {product.categories[0] && (
                    <Box
                        component={Link}
                        href={`/store/${product.categories[0].path}`}
                        sx={{ color: TEB_COLORS.textSecondary }}
                    >
                        {product.categories[0].name}
                    </Box>
                )}
                <Typography variant="caption" fontWeight={700} color={TEB_COLORS.primary} noWrap>
                    {product.title}
                </Typography>
            </Breadcrumbs>

            {/* Primary 2-column Product Showcase */}
            <Grid container spacing={{ xs: 3, md: 4.5 }} alignItems="flex-start">
                {/* Media gallery */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <ProductGallery
                        images={galleryImages}
                        discountBadge={
                            activeVariant?.discountPercent ? (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        top: 14,
                                        right: 14,
                                        px: 1.5,
                                        py: 0.5,
                                        borderRadius: "9999px",
                                        bgcolor: TEB_COLORS.error,
                                        color: "#FFFFFF",
                                        fontSize: "13px",
                                        fontWeight: 700,
                                    }}
                                >
                                    {formatFaNumber(activeVariant.discountPercent)}٪ تخفیف
                                </Box>
                            ) : undefined
                        }
                    />
                </Grid>

                {/* Product purchase & variant panel */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Stack
                        spacing={2.5}
                        sx={{
                            p: { xs: 2.5, md: 3.5 },
                            borderRadius: `${TEB_RADII.lg}px`,
                            bgcolor: TEB_COLORS.surface,
                            border: `1px solid ${TEB_COLORS.border}`,
                        }}
                    >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                            {product.categories[0] && (
                                <StatusBadge label={product.categories[0].name} tone="neutral" />
                            )}
                            <StatusBadge
                                label={inStock ? "موجود و آماده ارسال" : "اتمام موجودی"}
                                tone={inStock ? "success" : "error"}
                            />
                        </Stack>

                        <Typography
                            variant="h1"
                            sx={{
                                fontSize: { xs: "21px", sm: "24px", md: "26px" },
                                fontWeight: 800,
                                color: TEB_COLORS.textPrimary,
                                lineHeight: 1.45,
                            }}
                        >
                            {product.title}
                        </Typography>

                        {/* Rating + Weight + Inventory metadata */}
                        <Stack direction="row" flexWrap="wrap" gap={2} alignItems="center">
                            {product.reviewStats && product.reviewStats.total > 0 && (
                                <Stack direction="row" alignItems="center" gap={0.75}>
                                    <Rating
                                        value={product.reviewStats.averageRating}
                                        precision={0.5}
                                        readOnly
                                        size="small"
                                        sx={{ color: TEB_COLORS.gold }}
                                    />
                                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                        ({formatFaNumber(product.reviewStats.total)} دیدگاه)
                                    </Typography>
                                </Stack>
                            )}
                            {activeVariant?.weightGramsPerUnit && (
                                <Stack direction="row" alignItems="center" gap={0.5} color={TEB_COLORS.textSecondary}>
                                    <Scale size={15} />
                                    <Typography variant="caption" fontWeight={600}>
                                        وزن تقریبی ارسال: {formatFaNumber(activeVariant.weightGramsPerUnit)} گرم
                                    </Typography>
                                </Stack>
                            )}
                        </Stack>

                        <Divider />

                        {/* Variant selectors right near price & buy button */}
                        {variantAttributes.length > 0 && (
                            <Stack spacing={2}>
                                {variantAttributes.map((attr) => (
                                    <Stack key={attr.key} spacing={1}>
                                        <Typography variant="subtitle2" fontWeight={700}>
                                            انتخاب {attr.label}:
                                        </Typography>
                                        <Stack direction="row" flexWrap="wrap" gap={1}>
                                            {attr.options.map((opt) => {
                                                const isSelected = selections[attr.key] === opt.value;
                                                return (
                                                    <Button
                                                        key={opt.value}
                                                        variant={isSelected ? "contained" : "outlined"}
                                                        size="small"
                                                        onClick={() => handleSelectOption(attr.key, opt.value)}
                                                        sx={{
                                                            minHeight: 42,
                                                            px: 2,
                                                            bgcolor: isSelected ? TEB_COLORS.primary : TEB_COLORS.background,
                                                            color: isSelected ? "#FFFFFF" : TEB_COLORS.textPrimary,
                                                            borderColor: isSelected ? TEB_COLORS.primary : TEB_COLORS.border,
                                                        }}
                                                    >
                                                        {opt.label}
                                                    </Button>
                                                );
                                            })}
                                        </Stack>
                                    </Stack>
                                ))}
                            </Stack>
                        )}

                        {/* Price + Quantity + Buy CTA */}
                        <Box
                            sx={{
                                p: 2.25,
                                borderRadius: `${TEB_RADII.md}px`,
                                bgcolor: TEB_COLORS.softSurface,
                                border: `1px solid ${TEB_COLORS.border}`,
                            }}
                        >
                            <Stack spacing={2}>
                                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}>
                                    <PriceBlock
                                        finalPrice={activeVariant?.finalPrice ?? 0}
                                        originalPrice={
                                            activeVariant && activeVariant.finalPrice < activeVariant.unitPrice
                                                ? activeVariant.unitPrice
                                                : undefined
                                        }
                                        discountPercent={activeVariant?.discountPercent}
                                        size="lg"
                                        showDiscountBadge
                                    />

                                    <QuantityControl
                                        value={quantity}
                                        min={minOrder}
                                        max={maxOrder}
                                        disabled={!inStock}
                                        onChange={setQuantity}
                                    />
                                </Stack>

                                {errorMessage && (
                                    <Alert severity="error" sx={{ borderRadius: "12px" }}>
                                        {errorMessage}
                                    </Alert>
                                )}

                                <Button
                                    variant="contained"
                                    size="large"
                                    fullWidth
                                    disabled={!inStock}
                                    onClick={handleAddToCart}
                                    startIcon={<ShoppingBag size={19} />}
                                    sx={{ minHeight: 50, fontSize: "15px", fontWeight: 700 }}
                                >
                                    {inStock ? "افزودن به سبد خرید" : "این محصول ناموجود است"}
                                </Button>
                            </Stack>
                        </Box>

                        {/* Real fulfillment notes */}
                        <Stack direction={{ xs: "column", sm: "row" }} gap={1.5} sx={{ color: TEB_COLORS.textSecondary }}>
                            <Stack direction="row" alignItems="center" gap={0.75}>
                                <Truck size={16} color={TEB_COLORS.primary} />
                                <Typography variant="caption" fontWeight={600}>
                                    ارسال با پست پیشتاز به سراسر کشور
                                </Typography>
                            </Stack>
                            <Stack direction="row" alignItems="center" gap={0.75}>
                                <PackageCheck size={16} color={TEB_COLORS.primary} />
                                <Typography variant="caption" fontWeight={600}>
                                    بسته‌بندی بهداشتی و مقاوم
                                </Typography>
                            </Stack>
                        </Stack>
                    </Stack>
                </Grid>
            </Grid>

            {/* Structured Herbal Details: Intro, Ingredients, Usage, Warnings */}
            <Box sx={{ mt: { xs: 4, md: 6 } }}>
                <Grid container spacing={2.5}>
                    {descriptionSections.map((section) => {
                        const isWarning = section.tone === "warning";
                        return (
                            <Grid key={section.title} size={{ xs: 12, md: 6 }}>
                                <Box
                                    sx={{
                                        height: "100%",
                                        p: 3,
                                        borderRadius: `${TEB_RADII.lg}px`,
                                        bgcolor: isWarning ? TEB_COLORS.errorSoft : TEB_COLORS.surface,
                                        border: `1px solid ${isWarning ? "#E6C7C8" : TEB_COLORS.border}`,
                                    }}
                                >
                                    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1.25 }}>
                                        {isWarning ? (
                                            <AlertTriangle size={18} color={TEB_COLORS.error} />
                                        ) : (
                                            <Leaf size={18} color={TEB_COLORS.primary} />
                                        )}
                                        <Typography
                                            variant="h6"
                                            fontWeight={700}
                                            color={isWarning ? TEB_COLORS.error : TEB_COLORS.textPrimary}
                                        >
                                            {section.title}
                                        </Typography>
                                    </Stack>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: TEB_COLORS.textSecondary,
                                            lineHeight: 1.9,
                                            whiteSpace: "pre-line",
                                        }}
                                    >
                                        {section.body}
                                    </Typography>
                                </Box>
                            </Grid>
                        );
                    })}
                </Grid>
            </Box>

            {/* Customer Reviews */}
            {reviews.length > 0 && (
                <Box
                    sx={{
                        mt: { xs: 4, md: 5 },
                        p: { xs: 2.5, md: 3.5 },
                        borderRadius: `${TEB_RADII.lg}px`,
                        bgcolor: TEB_COLORS.surface,
                        border: `1px solid ${TEB_COLORS.border}`,
                    }}
                >
                    <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2.5 }}>
                        <Sparkles size={18} color={TEB_COLORS.gold} />
                        <Typography variant="h5" fontWeight={700}>
                            دیدگاه خریداران ({formatFaNumber(reviews.length)})
                        </Typography>
                    </Stack>

                    <Grid container spacing={2}>
                        {reviews.map((review) => (
                            <Grid key={review.id} size={{ xs: 12, md: 6 }}>
                                <Box
                                    sx={{
                                        p: 2.25,
                                        borderRadius: `${TEB_RADII.md}px`,
                                        bgcolor: TEB_COLORS.background,
                                        border: `1px solid ${TEB_COLORS.border}`,
                                    }}
                                >
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                        <Typography variant="subtitle2" fontWeight={700}>
                                            {review.author || "خریدار طب احمدی"}
                                        </Typography>
                                        <Rating value={review.rating} readOnly size="small" sx={{ color: TEB_COLORS.gold }} />
                                    </Stack>
                                    {review.comment && (
                                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                                            {review.comment}
                                        </Typography>
                                    )}
                                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                                        {formatPersianDate(review.createdAt)}
                                        {review.variantSummary ? ` — ${review.variantSummary}` : ""}
                                    </Typography>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            )}

            {/* Mobile Sticky Add-to-Cart Bar (sits cleanly above MobileBottomNav) */}
            <Box
                sx={{
                    display: { xs: "block", md: "none" },
                    position: "fixed",
                    bottom: 61,
                    left: 0,
                    right: 0,
                    zIndex: 1090,
                    px: 1.5,
                    py: 1,
                    bgcolor: "rgba(255, 255, 255, 0.96)",
                    backdropFilter: "blur(8px)",
                    borderTop: `1px solid ${TEB_COLORS.border}`,
                }}
            >
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.5}>
                    <PriceBlock finalPrice={activeVariant?.finalPrice ?? 0} size="sm" />
                    <Button
                        variant="contained"
                        disabled={!inStock}
                        onClick={handleAddToCart}
                        startIcon={<ShoppingBag size={16} />}
                        sx={{ minHeight: 44, px: 2.5 }}
                    >
                        {inStock ? "افزودن به سبد" : "ناموجود"}
                    </Button>
                </Stack>
            </Box>

            {/* Added to Cart Dialog */}
            <Dialog open={addedDialogOpen} onClose={() => setAddedDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, color: TEB_COLORS.primary }}>
                    <CheckCircle2 size={22} />
                    <span>به سبد خرید اضافه شد</span>
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        «{product.title}» با موفقیت به سبد خرید شما اضافه شد. می‌توانید خرید خود را ادامه دهید یا به سبد خرید بروید.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button variant="outlined" onClick={() => setAddedDialogOpen(false)}>
                        ادامه خرید
                    </Button>
                    <Button component={Link} href="/cart" variant="contained" onClick={() => setAddedDialogOpen(false)}>
                        مشاهده سبد خرید
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
