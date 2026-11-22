"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import OptimizedImage from "@/components/image";
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    Divider,
    Grid,
    IconButton,
    InputAdornment,
    InputBase,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
    Rating,
} from "@mui/material";

import { useCart } from "@/components/cart/useCart";
import type {
    ProductDetailData,
    ProductVariantDetail,
    ProductVariantMedia,
    VariantAttributeDefinition,
} from "../data";
import Link from "next/link";


const FALLBACK_IMAGE = "/product-placeholder.svg";
const FORMATTER = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });

const formatPrice = (value: number) => `${FORMATTER.format(Math.max(0, Math.floor(value)))} تومان`;
const QUANTITY_FORMATTER = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const formatQuantity = (value: number) => QUANTITY_FORMATTER.format(value);
const REVIEW_DATE_FORMATTER = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

type AttributeSelection = Record<string, string | undefined>;

type SelectionError = {
    key: string;
    message: string;
};

function resolveVariantImage(variant?: ProductVariantDetail): string {
    if (!variant) return FALLBACK_IMAGE;
    const mediaWithFull = variant.media.find((media) => media.fullUrl);
    if (mediaWithFull?.fullUrl) {
        return mediaWithFull.fullUrl;
    }
    const mediaWithPreview = variant.media.find((media) => media.previewUrl);
    if (mediaWithPreview?.previewUrl) {
        return mediaWithPreview.previewUrl;
    }
    return FALLBACK_IMAGE;
}

function getThumbnailSource(media: ProductVariantMedia): string {
    return media.previewUrl ?? media.fullUrl ?? FALLBACK_IMAGE;
}

function filterVariants(
    variants: ProductVariantDetail[],
    selections: AttributeSelection,
    attributes: VariantAttributeDefinition[],
): ProductVariantDetail[] {
    return variants.filter((variant) => {
        return attributes.every((attr) => {
            const selectedValue = selections[attr.key];
            if (!selectedValue) {
                return true;
            }
            return variant.variantAttributeValues?.[attr.key] === selectedValue;
        });
    });
}

function findExactVariant(
    variants: ProductVariantDetail[],
    selections: AttributeSelection,
    attributes: VariantAttributeDefinition[],
): ProductVariantDetail | undefined {
    if (!attributes.every((attr) => selections[attr.key])) {
        return undefined;
    }
    return variants.find((variant) =>
        attributes.every((attr) => variant.variantAttributeValues?.[attr.key] === selections[attr.key]),
    );
}

function applySingleOptionDefaults(
    currentSelections: AttributeSelection,
    variants: ProductVariantDetail[],
    attributes: VariantAttributeDefinition[],
): AttributeSelection {
    let changed = false;
    const nextSelections: AttributeSelection = { ...currentSelections };

    attributes.forEach((attribute) => {
        if (attribute.options.length !== 1) {
            return;
        }
        if (nextSelections[attribute.key]) {
            return;
        }
        const [option] = attribute.options;
        if (!option?.value) {
            return;
        }
        const prospectiveSelections: AttributeSelection = {
            ...nextSelections,
            [attribute.key]: option.value,
        };
        const matching = filterVariants(variants, prospectiveSelections, attributes);
        if (matching.length === 0) {
            return;
        }
        nextSelections[attribute.key] = option.value;
        changed = true;
    });

    return changed ? nextSelections : currentSelections;
}

function formatReviewDate(value?: string | null): string {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "";
    }
    return REVIEW_DATE_FORMATTER.format(parsed);
}

export default function ProductDetailClient({
    product,
    initialVariantId,
}: {
    product: ProductDetailData;
    initialVariantId?: string;
}) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));
    const { addFixedLine, addPerUnitLine, lines } = useCart();
    const hasVariants = product.variants.length > 0;
    const variantAttributes = product.variantAttributes ?? [];
    const reviews = product.reviews ?? [];
    const reviewStats = product.reviewStats;
    const hasReviews = reviews.length > 0;
    const variantMap = useMemo(() => {
        const map = new Map<string, ProductVariantDetail>();
        product.variants.forEach((variant) => {
            map.set(variant.id, variant);
        });
        return map;
    }, [product.variants]);

    const variantColorSwatchMap = useMemo(() => {
        const map = new Map<string, string[]>();
        product.variants.forEach((variant) => {
            if (!Array.isArray(variant.colorSwatches) || variant.colorSwatches.length === 0) {
                return;
            }
            const seen = new Set<string>();
            const normalized: string[] = [];
            variant.colorSwatches.forEach((swatch) => {
                if (typeof swatch !== "string") {
                    return;
                }
                const trimmed = swatch.trim();
                if (!trimmed) {
                    return;
                }
                const key = trimmed.toUpperCase();
                if (seen.has(key)) {
                    return;
                }
                seen.add(key);
                normalized.push(trimmed);
            });
            if (normalized.length > 0) {
                map.set(variant.id, normalized);
            }
        });
        return map;
    }, [product.variants]);

    const [selections, setSelections] = useState<AttributeSelection>(() =>
        applySingleOptionDefaults({}, product.variants, variantAttributes),
    );
    const [quantity, setQuantity] = useState<number>(1);
    const [requestedQty, setRequestedQty] = useState<number>(1);
    const [activeImage, setActiveImage] = useState<string>(() => resolveVariantImage(product.variants[0]));
    const [selectionErrors, setSelectionErrors] = useState<SelectionError[]>([]);
    const initializedVariantRef = useRef<string | null>(null);

    const [showSuc, setShowSuc] = useState(false);

    const matchingVariants = useMemo(
        () => filterVariants(product.variants, selections, variantAttributes),
        [product.variants, selections, variantAttributes],
    );

    const displayVariant = matchingVariants[0] ?? product.variants[0];
    const selectedVariant = useMemo(
        () => findExactVariant(product.variants, selections, variantAttributes),
        [product.variants, selections, variantAttributes],
    );

    const effectiveVariant = selectedVariant ?? displayVariant;
    const isPerUnit = effectiveVariant?.priceModel === "per_unit";
    const inStock = (effectiveVariant?.inventoryQuantity ?? 0) > 0;
    const lowStock = inStock && effectiveVariant?.lowStockThreshold !== undefined
        ? effectiveVariant.inventoryQuantity <= (effectiveVariant.lowStockThreshold ?? 0)
        : false;

    const rawMinOrder = effectiveVariant?.minimumOrderQuantity;
    const rawMaxOrder = effectiveVariant?.maximumOrderQuantity;
    const minOrder = typeof rawMinOrder === "number" && rawMinOrder > 0 ? rawMinOrder : undefined;
    const maxOrderCandidate = typeof rawMaxOrder === "number" && rawMaxOrder > 0 ? rawMaxOrder : undefined;
    const maxOrder =
        maxOrderCandidate !== undefined && minOrder !== undefined && maxOrderCandidate < minOrder
            ? minOrder
            : maxOrderCandidate;

    const effectiveInventoryLimit =
        typeof effectiveVariant?.inventoryQuantity === "number"
            ? effectiveVariant.inventoryQuantity
            : undefined;

    const inputMax = (() => {
        if (maxOrder !== undefined && typeof effectiveInventoryLimit === "number") {
            return Math.min(maxOrder, effectiveInventoryLimit);
        }
        return maxOrder ?? effectiveInventoryLimit;
    })();

    const clampFixedQuantity = (value: number): number | undefined => {
        if (Number.isNaN(value) || value <= 0) {
            return undefined;
        }
        const minQty = Math.max(1, Math.ceil(minOrder ?? 1));
        const inventoryCapRaw = effectiveVariant?.inventoryQuantity ?? Number.MAX_SAFE_INTEGER;
        const inventoryCap =
            Number.isFinite(inventoryCapRaw) && inventoryCapRaw >= 0
                ? Math.floor(inventoryCapRaw)
                : Number.MAX_SAFE_INTEGER;
        const maxOrderRaw = maxOrder !== undefined ? Math.floor(maxOrder) : Number.MAX_SAFE_INTEGER;
        let effectiveMax = Math.min(
            Number.isFinite(inventoryCap) ? Math.max(minQty, inventoryCap) : Number.MAX_SAFE_INTEGER,
            Number.isFinite(maxOrderRaw) ? Math.max(minQty, maxOrderRaw) : Number.MAX_SAFE_INTEGER,
        );
        if (!Number.isFinite(effectiveMax)) {
            effectiveMax = Math.max(minQty, inventoryCap);
        }
        if (effectiveMax < minQty) {
            effectiveMax = minQty;
        }
        return Math.min(Math.max(Math.floor(value), minQty), effectiveMax);
    };

    const clampPerUnitQuantity = (value: number): number | undefined => {
        if (Number.isNaN(value) || value <= 0) {
            return undefined;
        }
        let result = Number(value.toFixed(2));
        if (minOrder !== undefined && result < minOrder) {
            result = minOrder;
        }
        if (maxOrder !== undefined && result > maxOrder) {
            result = maxOrder;
        }
        return Number(result.toFixed(2));
    };

    const quantityConstraintLabel = (() => {
        if (!minOrder && !maxOrder) {
            return undefined;
        }
        const unitLabel = isPerUnit && effectiveVariant?.unitOfMeasure ? ` ${effectiveVariant.unitOfMeasure}` : "";
        if (minOrder && maxOrder) {
            return `حداقل ${formatQuantity(minOrder)} و حداکثر ${formatQuantity(maxOrder)} در هر سفارش${unitLabel}`;
        }
        if (minOrder) {
            return `حداقل سفارش: ${formatQuantity(minOrder)}${unitLabel}`;
        }
        return maxOrder ? `حداکثر سفارش: ${formatQuantity(maxOrder)}${unitLabel}` : undefined;
    })();

    useEffect(() => {
        const fallbackFixed = Math.max(1, Math.ceil(minOrder ?? 1));
        const fallbackPerUnit = minOrder ?? 1;

        if (isPerUnit) {
            setRequestedQty(Number(fallbackPerUnit.toFixed(2)));
        } else {
            setQuantity(fallbackFixed);
        }
    }, [effectiveVariant?.id, isPerUnit, minOrder]);

    useEffect(() => {
        setActiveImage(resolveVariantImage(displayVariant));
    }, [displayVariant?.id]);

    useEffect(() => {
        setSelections((prev) => applySingleOptionDefaults(prev, product.variants, variantAttributes));
    }, [product.variants, variantAttributes]);

    if (!hasVariants) {
        return (
            <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                    <Box
                        sx={{
                            p: 4,
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            textAlign: "center",
                        }}
                    >
                        <Typography variant="h5" fontWeight={600} gutterBottom>
                            موجودی محصول در دسترس نیست
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            لطفاً بعداً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.
                        </Typography>
                    </Box>
                </Grid>
            </Grid>
        );
    }

    const thumbnails = displayVariant?.media ?? [];

    const cartVariantMessages = useMemo(
        () =>
            lines
                .filter((line) => line.productId === product.id)
                .map((line) => {
                    const variant = variantMap.get(line.variantId);
                    const attributeEntries = variant?.attributeEntries ?? [];
                    const descriptor = attributeEntries.length
                        ? attributeEntries.map(({ label, value }) => `${label} ${value}`).join(" | ")
                        : variant?.attributesSummary ?? line.attributesSummary ?? product.title;
                    return {
                        variantId: line.variantId,
                        text: `${descriptor} به سبد خرید شما اضافه شده است.`,
                    };
                }),
        [lines, product.id, product.title, variantMap],
    );

    const clearSelectionError = (attrKey: string) => {
        setSelectionErrors((prev) =>
            prev.filter((error) =>
                error.key !== attrKey && error.key !== "variant" && error.key !== "stock",
            ),
        );
    };
    useEffect(() => {
        if (!initialVariantId) {
            initializedVariantRef.current = null;
            return;
        }
        if (initializedVariantRef.current === initialVariantId) {
            return;
        }
        const variant = variantMap.get(initialVariantId);
        if (!variant) {
            return;
        }
        const nextSelections: AttributeSelection = {};
        variantAttributes.forEach((attr) => {
            const value = variant.variantAttributeValues?.[attr.key];
            if (value) {
                nextSelections[attr.key] = value;
            }
        });
        setSelections(nextSelections);
        setActiveImage(resolveVariantImage(variant));
        setSelectionErrors([]);
        initializedVariantRef.current = initialVariantId;
    }, [initialVariantId, variantMap, variantAttributes]);

    const isOptionDisabled = useCallback(
        (attribute: VariantAttributeDefinition, optionValue: string) => {
            const prospectiveSelections: AttributeSelection = {
                ...selections,
                [attribute.key]: optionValue,
            };
            const matching = filterVariants(product.variants, prospectiveSelections, variantAttributes);
            if (!matching.length) {
                return true;
            }
            return !matching.some((variant) => (variant.inventoryQuantity ?? 0) > 0);
        },
        [product.variants, selections, variantAttributes],
    );

    const handleAttributeSelect = (attribute: VariantAttributeDefinition, value: string) => {
        if (isOptionDisabled(attribute, value)) {
            return;
        }

        let shouldClearError = false;
        let variantUnavailable = false;

        setSelections((prev) => {
            const currentValue = prev[attribute.key];
            const nextValue = currentValue === value ? undefined : value;

            if (nextValue === undefined) {
                shouldClearError = true;
                return {
                    ...prev,
                    [attribute.key]: undefined,
                };
            }

            const updatedSelections: AttributeSelection = {
                ...prev,
                [attribute.key]: nextValue,
            };

            const matchingVariantsForSelection = filterVariants(
                product.variants,
                updatedSelections,
                variantAttributes,
            );

            if (matchingVariantsForSelection.length > 0) {
                shouldClearError = true;
                return updatedSelections;
            }

            variantUnavailable = true;
            return prev;
        });

        if (variantUnavailable) {
            setSelectionErrors([{ key: "variant", message: "این ترکیب در حال حاضر موجود نیست." }]);
        } else if (shouldClearError) {
            clearSelectionError(attribute.key);
        }
    };

    const handleThumbnailClick = (media: ProductVariantMedia) => {
        const nextImage = media.fullUrl ?? media.previewUrl ?? FALLBACK_IMAGE;
        setActiveImage(nextImage);
    };

    const handleAddToCart = () => {
        const missingAttributes = variantAttributes
            .filter((attr) => attr.options.length > 0 && !selections[attr.key])
            .map((attr) => ({ key: attr.key, message: `لطفاً ${attr.label} را انتخاب کنید.` }));

        if (missingAttributes.length > 0) {
            setSelectionErrors(missingAttributes);
            return;
        }

        if (!selectedVariant) {
            setSelectionErrors([{ key: "variant", message: "گزینه انتخاب شده در دسترس نیست." }]);
            return;
        }

        if (!inStock) {
            setSelectionErrors([{ key: "stock", message: "این ترکیب در حال حاضر موجود نیست." }]);
            return;
        }

        if (isPerUnit && requestedQty <= 0) {
            setSelectionErrors([{ key: "qty", message: "لطفاً مقدار معتبر وارد کنید." }]);
            return;
        }

        const variantMin =
            typeof selectedVariant.minimumOrderQuantity === "number" && selectedVariant.minimumOrderQuantity > 0
                ? selectedVariant.minimumOrderQuantity
                : undefined;
        const variantMaxCandidate =
            typeof selectedVariant.maximumOrderQuantity === "number" && selectedVariant.maximumOrderQuantity > 0
                ? selectedVariant.maximumOrderQuantity
                : undefined;
        const variantMax =
            variantMaxCandidate !== undefined && variantMin !== undefined && variantMaxCandidate < variantMin
                ? variantMin
                : variantMaxCandidate;
        const qtyLabel = selectedVariant.priceModel === "per_unit" ? "مقدار" : "تعداد";
        const unitSuffix =
            selectedVariant.priceModel === "per_unit" && selectedVariant.unitOfMeasure
                ? ` ${selectedVariant.unitOfMeasure}`
                : "";

        if (selectedVariant.priceModel === "per_unit") {
            if (variantMin !== undefined && requestedQty < variantMin) {
                setSelectionErrors([
                    { key: "qty", message: `حداقل ${qtyLabel} قابل سفارش ${formatQuantity(variantMin)}${unitSuffix} است.` },
                ]);
                return;
            }
            if (variantMax !== undefined && requestedQty > variantMax) {
                setSelectionErrors([
                    { key: "qty", message: `حداکثر ${qtyLabel} قابل سفارش ${formatQuantity(variantMax)}${unitSuffix} است.` },
                ]);
                return;
            }
        } else {
            if (variantMin !== undefined && quantity < variantMin) {
                setSelectionErrors([
                    { key: "qty", message: `حداقل ${qtyLabel} قابل سفارش ${formatQuantity(variantMin)}${unitSuffix} است.` },
                ]);
                return;
            }
            if (variantMax !== undefined && quantity > variantMax) {
                setSelectionErrors([
                    { key: "qty", message: `حداکثر ${qtyLabel} قابل سفارش ${formatQuantity(variantMax)}${unitSuffix} است.` },
                ]);
                return;
            }
        }

        const summary = selectedVariant.attributesSummary || undefined;
        const line = {
            productId: product.id,
            productSlug: product.slug,
            title: product.title,
            variantId: selectedVariant.id,
            sku: selectedVariant.sku,
            priceModel: selectedVariant.priceModel,
            unitOfMeasure: selectedVariant.unitOfMeasure,
            unitPriceBase: selectedVariant.unitPrice,
            variantOfferAmount: selectedVariant.offerAmount ?? 0,
            mediaThumbId: selectedVariant.mediaThumbId,
            attributesSummary: summary,
            weightGramsPerUnit: selectedVariant.weightGramsPerUnit,
            minimumOrderQuantity: selectedVariant.minimumOrderQuantity,
            maximumOrderQuantity: selectedVariant.maximumOrderQuantity,
        } as const;

        if (selectedVariant.priceModel === "per_unit") {
            const normalized = clampPerUnitQuantity(requestedQty) ?? requestedQty;
            addPerUnitLine(line, normalized, selectedVariant.unitOfMeasure);
        } else {
            const normalized = clampFixedQuantity(quantity) ?? quantity;
            addFixedLine(line, normalized);
        }

        setSelectionErrors([]);
        setShowSuc(true);
    };

    const renderAttributeControl = (attribute: VariantAttributeDefinition) => {
        if (!attribute.options.length) {
            return null;
        }

        const selectedValue = selections[attribute.key];

        if (attribute.isColor) {
            return (
                <Stack key={attribute.key} spacing={1}>
                    <Typography variant="subtitle2">{attribute.label}</Typography>
                    <Stack direction="row" gap={1} flexWrap="wrap" aria-label={attribute.label}>
                        {attribute.options.map((option) => {
                            const isActive = option.value === selectedValue;
                            const isDisabled = isOptionDisabled(attribute, option.value);
                            const normalizedSwatches = (() => {
                                const collected = new Set<string>();
                                const values: string[] = [];
                                const add = (value: unknown) => {
                                    if (typeof value !== "string") {
                                        return;
                                    }
                                    const trimmed = value.trim();
                                    if (!trimmed) {
                                        return;
                                    }
                                    const key = trimmed.toUpperCase();
                                    if (collected.has(key)) {
                                        return;
                                    }
                                    collected.add(key);
                                    values.push(trimmed);
                                };
                                const addAll = (source: unknown) => {
                                    if (source === null || source === undefined) {
                                        return;
                                    }
                                    if (Array.isArray(source)) {
                                        source.forEach(addAll);
                                        return;
                                    }
                                    add(source);
                                };
                                addAll((option as typeof option & { swatches?: string[] }).swatches);
                                addAll(option.swatch);
                                option.variantIds.forEach((variantId) => {
                                    const swatches = variantColorSwatchMap.get(variantId);
                                    if (!swatches) {
                                        return;
                                    }
                                    addAll(swatches);
                                });
                                return values;
                            })();
                            const hasMultipleSwatches = normalizedSwatches.length > 1;
                            const fallbackSwatchValue =
                                typeof option.swatch === "string" && option.swatch.trim().length > 0
                                    ? option.swatch.trim()
                                    : undefined;
                            const fallbackSwatch = "linear-gradient(135deg, var(--mui-palette-grey-400), var(--mui-palette-grey-100))";
                            const backgroundSwatch = normalizedSwatches[0] ?? fallbackSwatchValue ?? fallbackSwatch;
                            const showLabelFallback = normalizedSwatches.length === 0 && !fallbackSwatchValue;
                            return (
                                <Box
                                    key={option.value}
                                    role="button"
                                    tabIndex={isDisabled ? -1 : 0}
                                    aria-disabled={isDisabled}
                                    onClick={() => {
                                        if (isDisabled) return;
                                        handleAttributeSelect(attribute, option.value);
                                    }}
                                    onKeyDown={(event) => {
                                        if (isDisabled) return;
                                        if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            handleAttributeSelect(attribute, option.value);
                                        }
                                    }}
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: "50%",
                                        border: isActive
                                            ? "2px solid var(--mui-palette-primary-main)"
                                            : "2px solid var(--mui-palette-primary-main)",
                                        boxShadow: isActive ? "0 0 0 2px rgba(var(--mui-palette-primary-mainChannel) / 0.2)" : "none",
                                        background: backgroundSwatch,
                                        cursor: isDisabled ? "not-allowed" : "pointer",
                                        position: "relative",
                                        overflow: "hidden",
                                        opacity: isDisabled && !isActive ? 0.4 : 1,
                                        ...(isDisabled
                                            ? {
                                                "&::after": {
                                                    content: '"x"',
                                                    position: "absolute",
                                                    inset: 0,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: "error.main",
                                                    fontSize: 18,
                                                    fontWeight: 700,
                                                    pointerEvents: "none",
                                                },
                                            }
                                            : {}),
                                    }}
                                    title={option.label}
                                >
                                    {hasMultipleSwatches && (
                                        <Box
                                            component="span"
                                            sx={{
                                                position: "absolute",
                                                inset: 0,
                                                display: "flex",
                                                borderRadius: "50%",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {normalizedSwatches.map((swatch, index) => (
                                                <Box
                                                    key={`${option.value}-${swatch}-${index}`}
                                                    component="span"
                                                    sx={{
                                                        flex: 1,
                                                        background: swatch,
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    )}
                                    {showLabelFallback && (
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                position: "absolute",
                                                inset: 0,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "text.primary",
                                            }}
                                        >
                                            {option.label.slice(0, 2)}
                                        </Typography>
                                    )}
                                    {isActive && (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width={24}
                                            height={24}
                                            viewBox="0 0 24 24"
                                            style={{
                                                left: 0,
                                                right: 0,
                                                top: 0,
                                                bottom: 0,
                                                margin: 'auto',
                                                position: 'absolute',
                                                mixBlendMode: 'difference'

                                            }}>
                                            <g fill="none" fillRule="evenodd">
                                                <path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"></path>
                                                <path fill="currentColor" d="M19.495 3.133a1 1 0 0 1 1.352.309l.99 1.51a1 1 0 0 1-.155 1.279l-.003.004l-.014.013l-.057.053l-.225.215a84 84 0 0 0-3.62 3.736c-2.197 2.416-4.806 5.578-6.562 8.646c-.49.856-1.687 1.04-2.397.301l-6.485-6.738a1 1 0 0 1 .051-1.436l1.96-1.768A1 1 0 0 1 5.6 9.2l3.309 2.481c5.169-5.097 8.1-7.053 10.586-8.548m.21 2.216c-2.29 1.432-5.148 3.509-9.998 8.358A1 1 0 0 1 8.4 13.8l-3.342-2.506l-.581.524l5.317 5.526c1.846-3.07 4.387-6.126 6.49-8.438a86 86 0 0 1 3.425-3.552l-.003-.005Z"></path>
                                            </g>
                                        </svg>
                                    )}
                                </Box>
                            );
                        })}
                    </Stack>
                </Stack>
            );
        }

        return (
            <Stack key={attribute.key} spacing={1}>
                <Typography variant="subtitle2">{attribute.label}</Typography>
                <Stack direction="row" gap={1} flexWrap="wrap" aria-label={attribute.label}>
                    {attribute.options.map((option) => {
                        const isActive = option.value === selectedValue;
                        const isDisabled = isOptionDisabled(attribute, option.value);
                        return (
                            <Box
                                key={option.value}
                                role="button"
                                tabIndex={isDisabled ? -1 : 0}
                                aria-disabled={isDisabled}
                                onClick={() => {
                                    if (isDisabled) return;
                                    handleAttributeSelect(attribute, option.value);
                                }}
                                onKeyDown={(event) => {
                                    if (isDisabled) return;
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        handleAttributeSelect(attribute, option.value);
                                    }
                                }}
                                sx={{
                                    minWidth: 52,
                                    height: 42,
                                    px: 1,
                                    borderRadius: 1,
                                    border: isActive
                                        ? "2px solid var(--mui-palette-text-primary)"
                                        : "1px solid var(--mui-palette-divider)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: isDisabled ? "not-allowed" : "pointer",
                                    bgcolor: isDisabled
                                        ? "action.disabledBackground"
                                        : isActive
                                            ? "text.primary"
                                            : "transparent",
                                    color: isDisabled
                                        ? "text.disabled"
                                        : isActive
                                            ? "background.default"
                                            : "text.secondary",
                                    position: "relative",
                                    opacity: isDisabled && !isActive ? 0.7 : 1,
                                    ...(isDisabled
                                        ? {
                                            "&::after": {
                                                content: '"x"',
                                                position: "absolute",
                                                inset: 0,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "error.main",
                                                fontSize: 16,
                                                fontWeight: 700,
                                                pointerEvents: "none",
                                            },
                                        }
                                        : {}),
                                }}
                            >
                                <Typography
                                    fontSize={14}
                                    fontWeight={isActive ? 600 : 400}
                                    sx={{ opacity: isDisabled && !isActive ? 0.5 : 1 }}
                                >
                                    {option.label}
                                </Typography>
                            </Box>
                        );
                    })}
                </Stack>
            </Stack>
        );
    };

    return (
        <>
            <Grid container spacing={{ xs: 2, md: 3 }} alignItems="flex-start">
                <Grid
                    size={{ xs: 12, md: 6 }}
                    sx={{
                        p: { xs: 1.5, sm: 2 },
                        borderRadius: { xs: 4, md: 6 },
                        bgcolor: "background.paper",
                        border: "1px solid",
                        borderColor: "divider",
                    }}
                >
                    {
                        isMobile && <>
                            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" aria-label="دسته بندی">
                                {product.categories.map((category) => (
                                    <Chip key={category.id} label={category.name} size="small" />
                                ))}
                            </Stack>

                            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                                <Typography variant="h1" sx={{ fontSize: 26, fontWeight: 700 }}>
                                    {product.title}
                                </Typography>
                                <IconButton aria-label="اشتراک گذاری">
                                    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                                        <g fill="none" stroke="currentColor" strokeWidth={1.5}>
                                            <path d="M9 11.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0Z" />
                                            <path strokeLinecap="round" d="M14.32 16.802L9 13.29m5.42-6.45L9.1 10.352" opacity={0.5} />
                                            <path d="M19 18.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0Zm0-13a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0Z" />
                                        </g>
                                    </svg>
                                </IconButton>
                            </Stack>
                        </>
                    }
                    <Stack spacing={1.5} alignItems="center">
                        <Box
                            sx={{
                                position: "relative",
                                width: "100%",
                                height: "100%",
                                minHeight: { xs: 360, sm: 520, md: 420, lg: 480 },
                                borderRadius: { xs: 3, md: 5 },
                                overflow: "hidden",
                                bgcolor: "rgba(42, 90, 68, .045)",
                                '&  *': {
                                    backgroundColor: 'transparent !important'
                                }
                            }}
                        >

                            <OptimizedImage
                                alt={product.title}
                                src={activeImage}
                                fallbackSrc={FALLBACK_IMAGE}
                                fill
                                priority
                                transparentBackground
                                style={{ objectFit: "contain", padding: isMobile ? "4%" : "2%" }}
                                containerStyle={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
                            />
                        </Box>

                        {thumbnails.length > 1 && (
                            <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="center" sx={{ width: "100%" }}>
                                {thumbnails.map((media, index) => {
                                    const thumbSrc = getThumbnailSource(media);
                                    const fullSrc = media.fullUrl ?? thumbSrc;
                                    const isActive = fullSrc === activeImage;
                                    return (
                                        <Box
                                            key={`${media.id}-${index}`}
                                            onClick={() => handleThumbnailClick(media)}
                                            sx={{
                                                width: 72,
                                                height: 72,
                                                borderRadius: 2.5,
                                                overflow: "hidden",
                                                bgcolor: isActive ? "background.paper" : "background.default",
                                                border: "2px solid",
                                                borderColor: isActive ? "primary.main" : "divider",
                                                cursor: "pointer",
                                            }}
                                        >
                                            <OptimizedImage
                                                alt={`${product.title} thumbnail ${index + 1}`}
                                                src={thumbSrc}
                                                fallbackSrc={FALLBACK_IMAGE}
                                                width={72}
                                                height={72}
                                                transparentBackground
                                                style={{ objectFit: "cover" }}
                                            />
                                        </Box>
                                    );
                                })}
                            </Stack>
                        )}
                    </Stack>
                </Grid>

                <Grid
                    size={{ xs: 12, md: 6 }}
                    sx={{
                        p: { xs: 2, sm: 2.5, md: 3 },
                        borderRadius: { xs: 4, md: 6 },
                        bgcolor: "background.paper",
                        border: "1px solid",
                        borderColor: "divider",
                        boxShadow: "0 14px 44px rgba(42, 90, 68, .07)",
                    }}
                >
                    <Stack gap={2.25} sx={{ height: "100%" }}>
                        {
                            !isMobile && <>
                                <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap" aria-label="دسته بندی">
                                    {product.categories.map((category) => (
                                        <Chip key={category.id} label={category.name} size="small" />
                                    ))}
                                </Stack>

                                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                                    <Typography variant="h1" sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 700 }}>
                                        {product.title}
                                    </Typography>
                                    <IconButton aria-label="اشتراک گذاری">
                                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                                            <g fill="none" stroke="currentColor" strokeWidth={1.5}>
                                                <path d="M9 11.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0Z" />
                                                <path strokeLinecap="round" d="M14.32 16.802L9 13.29m5.42-6.45L9.1 10.352" opacity={0.5} />
                                                <path d="M19 18.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0Zm0-13a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0Z" />
                                            </g>
                                        </svg>
                                    </IconButton>
                                </Stack>
                            </>
                        }

                        {
                            isMobile && variantAttributes.map((attribute) => renderAttributeControl(attribute))
                        }

                        <Stack gap={0.5}>
                            {!!effectiveVariant?.barcode && <Stack direction="row" gap={2} alignItems="center" sx={{ width: '100%' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', width: 100 }}>
                                    کد محصول:
                                </Typography>
                                <Divider sx={{ flex: '1 1 auto' }} />
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', width: 100, textAlign: 'end' }}>
                                    {effectiveVariant.barcode}
                                </Typography>
                            </Stack>}

                            {!!product.brand && <Stack direction="row" gap={2} alignItems="center" sx={{ width: '100%' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', width: 100 }}>
                                    برند:
                                </Typography>
                                <Divider sx={{ flex: '1 1 auto' }} />
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', width: 100, textAlign: 'end' }}>
                                    {product.brand}
                                </Typography>
                            </Stack>}
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">

                            {!!effectiveVariant?.attributeEntries?.length && <Stack direction="row" gap={2}>
                                <Typography variant="caption" color="text.secondary">
                                    مشخصات:
                                </Typography>
                                <Stack>
                                    {effectiveVariant.attributeEntries.map((entry) => (
                                        entry.label === 'weightGrams' ? null :
                                            <Typography key={`${entry.label}-${entry.value}`} variant="caption" color="text.secondary">
                                                {entry.label}: {entry.value}
                                            </Typography>
                                    ))}
                                </Stack>
                            </Stack>}
                            <Stack justifyContent="space-between" alignItems="end" gap={1}>
                                <Stack direction="row" alignItems="center" gap={1}>
                                    <Typography fontSize={20} fontWeight={700}>
                                        {formatPrice(effectiveVariant?.finalPrice ?? 0)}
                                    </Typography>
                                    {isPerUnit && effectiveVariant?.unitOfMeasure ? (
                                        <Typography variant="caption" color="text.secondary">
                                            / هر {effectiveVariant.unitOfMeasure}
                                        </Typography>
                                    ) : null}
                                </Stack>
                                {effectiveVariant?.offerAmount ? (
                                    <Stack direction="row" alignItems="center" gap={1}>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ textDecoration: "line-through", opacity: 0.7 }}
                                        >
                                            {formatPrice(effectiveVariant.unitPrice)}
                                        </Typography>
                                        {effectiveVariant.discountPercent ? (
                                            <Chip label={`${effectiveVariant.discountPercent}%`} color="error" size="small" />
                                        ) : null}
                                    </Stack>
                                ) : null}
                            </Stack>
                        </Stack>

                        {!isMobile && variantAttributes.map((attribute) => renderAttributeControl(attribute))}


                        {lowStock ? (
                            <Typography color="warning.main" fontWeight={600}>
                                موجودی محدود
                            </Typography>
                        ) : null}
                        {!inStock ? (
                            <Typography color="error.main" fontWeight={600}>
                                موجودی این گزینه به پایان رسیده است
                            </Typography>
                        ) : null}
                        <Stack
                            direction={{ xs: "column", sm: "row" }}
                            gap={1.5}
                            alignItems={{ xs: "stretch", sm: "center" }}
                            sx={{
                                mt: 2,
                                position: { xs: "sticky", md: "static" },
                                bottom: { xs: 82, md: "auto" },
                                zIndex: 10,
                                p: { xs: 1, md: 0 },
                                mx: { xs: -1, md: 0 },
                                borderRadius: 3,
                                bgcolor: { xs: "rgba(255,255,255,.94)", md: "transparent" },
                                backdropFilter: { xs: "blur(12px)", md: "none" },
                            }}
                        >
                            <Stack spacing={0.5}>
                                <Stack direction="row" alignItems="center">
                                    <IconButton
                                        size="small"
                                        aria-label="کاهش"
                                        onClick={() => {
                                            if (isPerUnit) {
                                                const next = clampPerUnitQuantity(requestedQty - 1);
                                                if (next === undefined) return;
                                                setRequestedQty(next);
                                            } else {
                                                const next = clampFixedQuantity(quantity - 1);
                                                if (next === undefined) return;
                                                setQuantity(next);
                                            }
                                            setSelectionErrors((prev) => prev.filter((error) => error.key !== "qty"));
                                        }}
                                        sx={{ fontSize: '1.1rem' }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                                            <path fill="currentColor" d="M19 12.998H5v-2h14z"></path>
                                        </svg>
                                    </IconButton>
                                    <InputBase
                                        value={isPerUnit ? requestedQty : quantity}
                                        type="number"
                                        slotProps={{
                                            input: {
                                                min: isPerUnit ? minOrder ?? undefined : Math.max(1, Math.ceil(minOrder ?? 1)),
                                                max: inputMax,
                                                step: isPerUnit ? 0.5 : 1,
                                                inputMode: 'decimal',
                                                dir: 'ltr',
                                                style: {
                                                    textAlign: 'center',
                                                },
                                            },
                                        }}
                                        onChange={(event) => {
                                            const value = Number(event.target.value);
                                            if (Number.isNaN(value) || value <= 0) return;
                                            if (isPerUnit) {
                                                const next = clampPerUnitQuantity(value);
                                                if (next === undefined) return;
                                                setRequestedQty(next);
                                            } else {
                                                const next = clampFixedQuantity(value);
                                                if (next === undefined) return;
                                                setQuantity(next);
                                            }
                                            setSelectionErrors((prev) => prev.filter((error) => error.key !== "qty"));
                                        }}
                                        sx={{
                                    p: 0.5,
                                            minWidth: 50,
                                            width: 60,
                                            textAlign: 'center',
                                            '& input[type=number]': {
                                                MozAppearance: 'textfield',
                                            },
                                            '& input[type=number]::-webkit-outer-spin-button': {
                                                WebkitAppearance: 'none',
                                                margin: 0,
                                            },
                                            '& input[type=number]::-webkit-inner-spin-button': {
                                                WebkitAppearance: 'none',
                                                margin: 0,
                                            },
                                        }}
                                    />
                                    <InputAdornment position="end">{isPerUnit ? "مقدار سفارشی" : "تعداد"}</InputAdornment>

                                    <IconButton
                                        size="small"
                                        aria-label="افزایش"
                                        onClick={() => {
                                            if (isPerUnit) {
                                                const next = clampPerUnitQuantity(requestedQty + 1);
                                                if (next === undefined) return;
                                                setRequestedQty(next);
                                            } else {
                                                const next = clampFixedQuantity(quantity + 1);
                                                if (next === undefined) return;
                                                setQuantity(next);
                                            }
                                            setSelectionErrors((prev) => prev.filter((error) => error.key !== "qty"));
                                        }}
                                        sx={{ fontSize: '1.1rem' }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24">
                                            <path fill="currentColor" d="M18 12.998h-5v5a1 1 0 0 1-2 0v-5H6a1 1 0 0 1 0-2h5v-5a1 1 0 0 1 2 0v5h5a1 1 0 0 1 0 2"></path>
                                        </svg>
                                    </IconButton>
                                </Stack>
                                {quantityConstraintLabel ? (
                                    <Typography variant="caption" color="text.secondary">
                                        {quantityConstraintLabel}
                                    </Typography>
                                ) : null}
                            </Stack>
                            <Button
                                size="large"
                                variant="contained"
                                color="primary"
                                onClick={handleAddToCart}
                                fullWidth
                                disabled={!inStock}
                                startIcon={
                                    <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
                                        <path fill="currentColor" d="M7.5 18a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3m9 0a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3"></path>
                                        <path fill="currentColor" d="M2.084 2.751a.75.75 0 0 1 .956-.459l.301.106c.617.217 1.14.401 1.553.603c.44.217.818.483 1.102.899c.282.412.399.865.452 1.362q.035.333.044.738H17.13c1.685 0 3.202 0 3.646.577s.27 1.447-.077 3.186l-.5 2.425c-.315 1.528-.472 2.293-1.024 2.742c-.552.45-1.332.45-2.893.45h-5.303c-2.79 0-4.184 0-5.05-.914s-.93-1.884-.93-4.826V7.038c0-.74 0-1.235-.042-1.615c-.04-.363-.109-.545-.2-.677c-.087-.129-.22-.25-.524-.398c-.323-.158-.762-.314-1.43-.549l-.26-.091a.75.75 0 0 1-.46-.957" opacity={0.5}></path>
                                        <path fill="currentColor" d="M13.75 9a.75.75 0 0 0-1.5 0v1.25H11a.75.75 0 0 0 0 1.5h1.25V13a.75.75 0 0 0 1.5 0v-1.25H15a.75.75 0 0 0 0-1.5h-1.25z"></path>
                                    </svg>
                                }
                            >
                                افزودن به سبد خرید
                            </Button>
                        </Stack>

                        {cartVariantMessages.length > 0 && (
                            <Stack spacing={0.5} sx={{ mt: 1 }}>
                                {cartVariantMessages.map(({ variantId, text }) => (
                                    <Typography key={variantId} variant="body2" color="text.secondary">
                                        {text.replace(/\| weightGrams [0-9]+/g, "")}
                                    </Typography>
                                ))}
                            </Stack>
                        )}

                        {product.description ? (
                            <Box
                                sx={{
                                    position: "relative",
                                    mt: 2.5,
                                    p: { xs: 1.75, sm: 2.25 },
                                    borderRadius: 3,
                                    overflow: "hidden",
                                    border: "1px solid",
                                    borderColor: "divider",
                                    background: "rgba(42, 90, 68, .045)",
                                }}
                            >
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={800}
                                    mb={1}
                                    sx={{
                                        position: "relative",
                                        color: "primary.main",
                                    }}
                                >
                                    توضیحات محصول
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        position: "relative",
                                        color: "var(--mui-palette-text-primary)",
                                        whiteSpace: "pre-line",
                                        lineHeight: 2,
                                    }}
                                >
                                    {product.description}
                                </Typography>
                            </Box>
                        ) : null}

                        {product.productFacts.length > 0 ? (
                            <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>
                                {product.productFacts.map((fact) => (
                                    <Box
                                        key={fact.key}
                                        sx={{
                                            p: 1.5,
                                            borderRadius: 2.5,
                                            border: '1px solid',
                                            borderColor: fact.key === 'warning' ? 'warning.light' : 'divider',
                                            bgcolor: fact.key === 'warning' ? 'rgba(194, 139, 47, .08)' : 'background.default',
                                        }}
                                    >
                                        <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">
                                            {fact.label}
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: .5, lineHeight: 1.8 }}>
                                            {fact.value}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        ) : null}
                    </Stack>
                </Grid>
            </Grid>

            {hasReviews ? (
                <Box
                    sx={{
                        mt: 4,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        p: { xs: 2, md: 3 },
                        background: "linear-gradient(135deg, rgba(var(--mui-palette-text-primaryChannel) / 0.04), rgba(var(--mui-palette-text-primaryChannel) / 0.02))",
                    }}
                >
                    <Stack
                        direction="row"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                        justifyContent="space-between"
                        gap={2}
                        flexWrap="wrap"
                        mb={2}
                    >
                        <Stack spacing={0.5}>
                            <Typography variant="h6" fontWeight={700}>
                                نظر خریداران
                            </Typography>
                            {reviewStats ? (
                                <Stack direction="row" alignItems="center" gap={1}>
                                    <Rating value={reviewStats.averageRating} precision={0.5} readOnly />
                                    <Typography variant="body2" color="text.secondary">
                                        {reviewStats.averageRating.toFixed(1)} از {reviewStats.total} نظر
                                    </Typography>
                                </Stack>
                            ) : null}
                        </Stack>
                    </Stack>
                    <Stack spacing={2}>
                        {reviews.map((review) => (
                            <Box
                                key={review.id}
                                sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    bgcolor: "background.paper",
                                    border: "1px solid",
                                    borderColor: "divider",
                                    boxShadow: "0 6px 24px rgba(var(--mui-palette-common-onBackgroundChannel) / 0.04)",
                                }}
                            >
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    gap={1}
                                    flexWrap="wrap"
                                >
                                    <Stack direction="row" alignItems="center" gap={1}>
                                        <Typography fontWeight={700}>
                                            {review.author ?? "خریدار تایید شده"}
                                        </Typography>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary">
                                        {formatReviewDate(review.createdAt)}
                                    </Typography>
                                </Stack>
                                <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1 }}>
                                    <Rating value={review.rating ?? 0} precision={0.5} readOnly size="small" />
                                    <Typography variant="body2" color="text.secondary">
                                        {typeof review.rating === "number" ? review.rating.toFixed(1) : review.rating}
                                    </Typography>
                                </Stack>
                                {review.comment ? (
                                    <Typography variant="body2" sx={{ mt: 1.5, lineHeight: 1.8 }}>
                                        {review.comment}
                                    </Typography>
                                ) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                        این خریدار امتیاز داده است.
                                    </Typography>
                                )}
                            </Box>
                        ))}
                    </Stack>
                </Box>
            ) : (
                <Box
                    sx={{
                        mt: 4,
                        p: 2,
                        borderRadius: 2,
                        border: "1px dashed",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                    }}
                >
                    <Typography color="text.secondary">
                        هنوز نظری ثبت نشده است. اگر این محصول را خریده‌اید، می‌توانید پس از تحویل آن را ارزیابی کنید.
                    </Typography>
                </Box>
            )}

            <Dialog
                open={!!selectionErrors.length}
                onClose={() => setSelectionErrors([])}
                maxWidth="sm"
                fullWidth
            >
                <DialogContent>
                    <Stack gap={2} alignItems="center" justifyContent="center">
                        <svg xmlns="http://www.w3.org/2000/svg" width={100} height={100} viewBox="0 0 40 40">
                            <g fill="none" strokeMiterlimit={10}>
                                <path fill="#A54A4C" stroke="#7D383A" d="M.5 20a19.5 19.5 0 1 0 39 0a19.5 19.5 0 0 0-39 0Z" strokeWidth={1}></path>
                                <path fill="#fff" stroke="#231f20" d="M30.08 25.41c-.16-.77-2.31-3.15-4.48-5.41c2.17-2.26 4.32-4.64 4.48-5.41c.46-.89-.63-2.11-1.59-3.08s-2.19-2-3.08-1.59c-.77.16-3.15 2.31-5.41 4.48c-2.26-2.17-4.64-4.32-5.41-4.48c-.89-.46-2.11.63-3.07 1.59s-2.06 2.19-1.6 3.08c.16.77 2.31 3.15 4.48 5.41c-2.17 2.26-4.32 4.64-4.48 5.41c-.46.89.63 2.11 1.59 3.08s2.19 2.05 3.08 1.59c.77-.16 3.15-2.31 5.41-4.48c2.26 2.17 4.64 4.32 5.41 4.48c.89.46 2.11-.63 3.08-1.59s2.05-2.19 1.59-3.08Z" strokeWidth={1}></path>
                                <path stroke="#fff" strokeLinecap="round" d="M27.56 5a15.4 15.4 0 0 1 5.26 3.73" strokeWidth={1}></path>
                            </g>
                        </svg>
                        {
                            selectionErrors.map((x, i) => <Typography key={i}>{x.message}</Typography>)
                        }
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelectionErrors([])} variant="contained">
                        متوجه شدم
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog
                open={showSuc}
                onClose={() => setShowSuc(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogContent>
                    <Stack gap={2} alignItems="center" justifyContent="center">
                        <svg xmlns="http://www.w3.org/2000/svg" width={150} height={150} viewBox="0 0 40 40">
                            <g fill="none" stroke="#00034a" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit={10} strokeWidth={1}>
                                <path fill="#00034a" d="M28.875 4.312c2.42-2.258 4.85-1.367 6.643 0c2.39 1.871 4.626 4.889 3.076 7.949c-.522 1.604-3.273 6.35-7.592 12.044c-.925 1.22-1.77 2.344-2.544 3.373c-3.118 4.15-5.098 6.784-6.633 8.199c-1.676 1.546-3.384 1.467-5.283.445c-1.584-.853-3.67-2.442-6.238-4.399l-1.13-.861c-2.49-1.898-6.543-4.515-7.822-7.617c-1.252-1.68.312-4.213 1.68-6.007c1.366-1.795 3.492-3.93 5.456-3.17c1.159.141 3.958 2.05 7.507 4.745c.97-1.328 2.034-2.739 3.153-4.226l.026-.035c4.32-5.695 8.258-9.49 9.7-10.44"></path>
                                <path fill="#C5A059" d="M35.518 4.312c-1.795-1.367-4.224-2.258-6.643 0c-1.443.95-5.382 4.745-9.7 10.44a380 380 0 0 0-3.18 4.26c-3.55-2.694-6.348-4.602-7.507-4.745c-1.964-.759-4.09 1.377-5.457 3.17c-1.366 1.794-2.932 4.327-1.68 6.008c.447 1.082 2.97 3.35 6.52 6.055c4.262 3.236 7.337 5.694 9.14 5.922c2.761 1.072 4.745-2.192 12.689-12.68c4.319-5.694 7.07-10.439 7.593-12.043c1.479-2.923-.03-5.02-1.775-6.387"></path>
                            </g>
                        </svg>
                        <Typography variant="subtitle1">
                            این محصول با موفقیت به سبد خرید اضافه شد.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowSuc(false)} variant="outlined">
                        افزودن موارد دیگر
                    </Button>
                    <Button LinkComponent={Link} href="/cart" variant="contained">
                        تکمیل خرید
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
