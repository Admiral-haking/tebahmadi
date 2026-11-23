"use server";

import ProductModel, { type ProductDocument } from "@/catalog/models/Product";
import ProductTypeModel, { type AttributeDef, type AttributeKind } from "@/catalog/models/ProductType";
import CategoryModel from "@/catalog/models/Category";
import MediaModel from "@/media/models/Media";
import { connectMongoose } from "@/lib/mongoose";
import { effectiveUnitPrice } from "@/catalog/services/productService";
import { Types } from "mongoose";
import { ProductReviewModel } from "@/reviews/models/ProductReview";
import { isMongoConfigured, getPreviewProductDetail } from "@/lib/preview-fallback";

const ALLOWED_UNITS = ['unit', 'pair', 'kg', 'g', 'lb', 'oz', 'l', 'ml'] as const;
export type Unit = typeof ALLOWED_UNITS[number];

function isUnit(value: string): value is Unit {
    return (ALLOWED_UNITS as readonly string[]).includes(value);
}

function normalizeUnit(unit?: string | null): Unit | undefined {
    if (!unit) return undefined;
    const normalized = unit.trim().toLowerCase();
    return isUnit(normalized) ? normalized : undefined;
}

export type ProductCategoryInfo = {
    id: string;
    name: string;
    path: string;
};

export type ProductVariantMedia = {
    id: string;
    thumbId?: string;
    mobileId?: string;
    originalId?: string;
    previewUrl?: string;
    fullUrl?: string;
    url?: string;
};

export type ProductVariantDetail = {
    id: string;
    sku: string;
    priceModel: "fixed" | "per_unit";
    unitPrice: number;
    unitOfMeasure?: Unit;
    finalPrice: number;
    discountPercent?: number;
    offerAmount?: number;
    offerLabel?: string;
    offerStartsAt?: string;
    offerEndsAt?: string;
    inventoryQuantity: number;
    inventoryTrackingUnit: string;
    lowStockThreshold?: number | null;
    minimumOrderQuantity?: number;
    maximumOrderQuantity?: number;
    colorKey?: string;
    colorName?: string;
    colorSwatches?: string[];
    colorFamily?: string;
    attributes: { key: string; value: unknown }[];
    attributesSummary: string;
    attributeEntries: { label: string; value: string }[];
    variantAttributeValues: Record<string, string>;
    media: ProductVariantMedia[];
    mediaThumbId?: string;
    weightGramsPerUnit?: number;
    barcode?: string
};

export type VariantAttributeOption = {
    value: string;
    label: string;
    variantIds: string[];
    swatch?: string;
    swatches?: string[];
};

export type VariantAttributeDefinition = {
    key: string;
    label: string;
    kind: AttributeKind;
    isColor: boolean;
    options: VariantAttributeOption[];
};

export type ProductReview = {
    id: string;
    rating: number;
    comment?: string;
    author?: string;
    createdAt: string;
    variantSummary?: string;
};

export type ProductReviewStats = {
    averageRating: number;
    total: number;
};

export type ProductDetailData = {
    id: string;
    slug: string;
    title: string;
    description?: string;
    seoTitle?: string;
    seoDescription?: string;
    brand?: string;
    categories: ProductCategoryInfo[];
    productTypeId?: string;
    productTypeName?: string;
    productFacts: { key: string; label: string; value: string }[];
    variants: ProductVariantDetail[];
    activeVariantCount: number;
    hasInventory: boolean;
    colorAttributeLabel?: string;
    sizeAttributeLabel?: string;
    variantAttributes: VariantAttributeDefinition[];
    reviews?: ProductReview[];
    reviewStats?: ProductReviewStats;
};

function toStringId(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    if (value instanceof Types.ObjectId) return value.toString();
    return undefined;
}

const PRODUCT_FACT_LABELS: Record<string, string> = {
    ingredients: 'ترکیبات',
    usage: 'روش مصرف',
    brewing: 'روش دم‌آوری',
    origin: 'خاستگاه',
    source: 'منبع محصول',
    storage: 'شرایط نگهداری',
    warning: 'هشدار مصرف',
    expiry: 'مدت ماندگاری',
};

function formatAttributeValue(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === "object") {
        if (Array.isArray(value)) {
            return value.map((item) => `${item}`).join("، ");
        }
        const maybeColor = value as { name?: string; key?: string };
        if (maybeColor?.name) {
            return maybeColor.name;
        }
        if (maybeColor?.key) {
            return maybeColor.key;
        }
        return JSON.stringify(value);
    }
    return `${value}`;
}

function collectColorSwatches(...sources: unknown[]): string[] {
    const seen = new Set<string>();
    const swatches: string[] = [];
    const seenObjects = new Set<object>();

    const addSwatch = (value: unknown) => {
        if (typeof value !== "string") return;
        const trimmed = value.trim();
        if (!trimmed) return;
        const key = trimmed.toUpperCase();
        if (seen.has(key)) return;
        seen.add(key);
        swatches.push(trimmed);
    };

    const visit = (value: unknown) => {
        if (value === null || value === undefined) {
            return;
        }
        if (typeof value === "string") {
            addSwatch(value);
            return;
        }
        if (Array.isArray(value)) {
            value.forEach(visit);
            return;
        }
        if (typeof value === "object") {
            const obj = value as Record<string, unknown>;
            if (seenObjects.has(obj)) {
                return;
            }
            seenObjects.add(obj);
            if ("swatches" in obj) {
                visit(obj.swatches);
            }
            if ("swatch" in obj) {
                visit(obj.swatch);
            }
            if ("value" in obj) {
                visit(obj.value);
            }
        }
    };

    sources.forEach(visit);
    return swatches;
}

function extractRawAttributeValue(attributes: { key: string; value: unknown }[], key: string): unknown {
    return attributes.find((attr) => attr.key === key)?.value;
}

function buildAttributeEntries(
    attributes: { key: string; value: unknown }[],
    labelMap: Map<string, string>,
): { label: string; value: string }[] {
    return attributes
        .map(({ key, value }) => {
            const formatted = formatAttributeValue(value);
            if (!formatted) return undefined;
            const label = labelMap.get(key) ?? key;
            return { label, value: formatted };
        })
        .filter((entry): entry is { label: string; value: string } => entry !== undefined);
}

function buildAttributeSummary(
    attributes: { key: string; value: unknown }[],
    labelMap: Map<string, string>,
): string {
    return buildAttributeEntries(attributes, labelMap)
        .map(({ label, value }) => `${label}: ${value}`)
        .join(" | ");
}

function buildMediaUrls(media: ProductVariantMedia) {
    const previewId = media.thumbId ?? media.mobileId ?? media.originalId;
    const fullId = media.originalId ?? media.mobileId ?? media.thumbId ?? previewId;

    if (previewId) {
        const previewUrl = `/api/media/${previewId}`;
        media.previewUrl = previewUrl;
        media.url = previewUrl;
    }

    if (fullId) {
        media.fullUrl = `/api/media/${fullId}`;
    }
}

export async function loadProductDetail(slug: string): Promise<ProductDetailData | null> {
    if (!isMongoConfigured()) {
        return getPreviewProductDetail(slug);
    }
    try {
        await connectMongoose();

    const product = await ProductModel.findOne({ slug, status: "active" }).lean();
    if (!product) {
        return getPreviewProductDetail(slug);
    }

    const productTypeId = toStringId(product.productTypeId);
    const [productType, categories] = await Promise.all([
        productTypeId ? ProductTypeModel.findById(productTypeId).lean() : null,
        Array.isArray(product.categories) && product.categories.length
            ? CategoryModel.find({ _id: { $in: product.categories } }, { name: 1, path: 1 }).lean()
            : [],
    ]);

    const attributeLabelMap = new Map<string, string>();
    (productType?.attributes ?? []).forEach((attribute: AttributeDef | undefined) => {
        if (attribute?.key) {
            attributeLabelMap.set(attribute.key, attribute.label ?? attribute.key);
        }
    });

    const rawProductAttrs = product.attrs instanceof Map
        ? Object.fromEntries(product.attrs.entries())
        : (product.attrs && typeof product.attrs === 'object' ? product.attrs as Record<string, unknown> : {});
    const productFacts = Object.entries(rawProductAttrs)
        .filter(([key, value]) => key in PRODUCT_FACT_LABELS && value !== null && value !== undefined && String(value).trim())
        .map(([key, value]) => ({ key, label: PRODUCT_FACT_LABELS[key], value: formatAttributeValue(value) ?? '' }))
        .filter((item) => item.value.length > 0);

    const colorAttribute = (productType?.attributes ?? []).find((attr) => attr?.kind === 'color' && attr.variant);
    const sizeAttribute = (productType?.attributes ?? []).find((attr) => attr?.key?.toLowerCase() === 'size');

    const variantAttributeDefsRaw = (productType?.attributes ?? []).filter(
        (attr): attr is AttributeDef => Boolean(attr && attr.variant),
    );
    const attributeOptionMaps = new Map<string, Map<string, VariantAttributeOption>>();
    const attributeColorSwatchMaps = new Map<string, Map<string, string[]>>();
    variantAttributeDefsRaw.forEach((attr) => {
        attributeOptionMaps.set(attr.key, new Map());
        if (attr.kind === 'color') {
            const colorMap = new Map<string, string[]>();
            const register = (key: unknown, swatches: string[]) => {
                if (typeof key !== "string") return;
                const trimmed = key.trim();
                if (!trimmed) return;
                colorMap.set(trimmed, swatches);
                colorMap.set(trimmed.toUpperCase(), swatches);
            };
            const colorValues = Array.isArray(attr.values) ? attr.values : [];
            colorValues
                .filter((value) => value && value.active !== false)
                .forEach((value) => {
                    const normalized = collectColorSwatches(value?.swatches);
                    if (normalized.length === 0) {
                        return;
                    }
                    register(value?.key, normalized);
                    register(value?.name, normalized);
                    register(value?.rtlName, normalized);
                    (Array.isArray(value?.aliases) ? value.aliases : []).forEach((alias) => register(alias, normalized));
                });
            attributeColorSwatchMaps.set(attr.key, colorMap);
        }
    });

    const categoryInfos: ProductCategoryInfo[] = (categories ?? [])
        .map((category) => ({
            id: toStringId(category._id) ?? "",
            name: category.name ?? "",
            path: category.path ?? "",
        }))
        .filter((category) => category.id && category.name);

    const activeVariants = (product.variants ?? []).filter(
        (variant) => variant?.active !== false && Boolean(toStringId((variant as { _id?: unknown })._id)),
    );

    const mediaIds = new Set<string>();
    activeVariants.forEach((variant) => {
        const ids = Array.isArray(variant.mediaIds) ? variant.mediaIds : [];
        ids.forEach((id) => {
            const asString = toStringId(id);
            if (asString) {
                mediaIds.add(asString);
            }
        });
    });

    let mediaMap = new Map<string, ProductVariantMedia>();
    if (mediaIds.size > 0) {
        const docs = await MediaModel.find({ _id: { $in: Array.from(mediaIds).map((id) => new Types.ObjectId(id)) } })
            .select({ originalId: 1, mobileId: 1, thumbId: 1 })
            .lean();
        mediaMap = new Map(
            docs.map((doc) => {
                const id = toStringId(doc._id) ?? "";
                const media: ProductVariantMedia = {
                    id,
                    originalId: toStringId(doc.originalId),
                    mobileId: toStringId(doc.mobileId),
                    thumbId: toStringId(doc.thumbId),
                };
                buildMediaUrls(media);
                return [id, media];
            }),
        );
    }

    const now = new Date();

    const variants: ProductVariantDetail[] = activeVariants.map((variant) => {
        const variantId = toStringId((variant as { _id?: unknown })._id)!;
        const priceModel = variant.price?.model === "per_unit" ? "per_unit" : "fixed";
        const unitPrice = Number(variant.price?.amount ?? 0);
        const finalPrice = effectiveUnitPrice(variant as ProductDocument['variants'][number], now);
        let discountPercent: number | undefined;
        if (variant.offer && finalPrice < unitPrice && unitPrice > 0) {
            discountPercent = Math.round(((variant.offer.amount ?? 0) / unitPrice) * 100);
        }
        const inventoryQuantity = Number(variant.inventory?.quantity ?? 0);
        const lowStockThreshold = variant.inventory?.lowStockThreshold ?? undefined;
        const mediaList = Array.isArray(variant.mediaIds)
            ? variant.mediaIds
                .map((id) => toStringId(id))
                .filter((id): id is string => Boolean(id))
                .map((id) => mediaMap.get(id))
                .filter((item): item is ProductVariantMedia => Boolean(item))
            : [];
        const chosenMedia = mediaList[0];
        const mediaThumbFileId = chosenMedia?.thumbId ?? chosenMedia?.mobileId ?? chosenMedia?.originalId;
        const attributes = Array.isArray(variant.attributeValues) ? variant.attributeValues : [];
        const attributeEntries = buildAttributeEntries(attributes, attributeLabelMap);
        const attributesSummary = buildAttributeSummary(attributes, attributeLabelMap);
        const variantAttributeValues: Record<string, string> = {};
        const colorRawValues: unknown[] = [];

        variantAttributeDefsRaw.forEach((attr) => {
            const rawValue = extractRawAttributeValue(attributes, attr.key);
            let optionValue: string | undefined;
            let optionLabel: string | undefined;
            let paletteSwatches: string[] | undefined;

            if (attr.kind === 'color') {
                const formatted = formatAttributeValue(rawValue);
                optionValue = variant.colorKey ?? formatted ?? variant.colorName ?? undefined;
                optionLabel = variant.colorName ?? formatted ?? optionValue;
                if (!optionValue && optionLabel) {
                    optionValue = optionLabel;
                }
                const palette = attributeColorSwatchMaps.get(attr.key);
                const lookupPalette = (candidate: string | undefined) => {
                    if (!candidate) return undefined;
                    const trimmed = candidate.trim();
                    if (!trimmed) return undefined;
                    return palette?.get(trimmed) ?? palette?.get(trimmed.toUpperCase());
                };
                paletteSwatches = lookupPalette(optionValue) ?? lookupPalette(optionLabel);
                colorRawValues.push(rawValue, paletteSwatches);
            } else {
                optionValue = formatAttributeValue(rawValue);
                optionLabel = optionValue;
            }

            if (!optionValue) {
                return;
            }

            variantAttributeValues[attr.key] = optionValue;
            const optionMap = attributeOptionMaps.get(attr.key);
            if (!optionMap) return;

            const swatches =
                attr.kind === 'color'
                    ? collectColorSwatches(variant.colorSwatches, rawValue, paletteSwatches)
                    : undefined;

            const existing = optionMap.get(optionValue);

            if (existing) {
                if (!existing.variantIds.includes(variantId)) {
                    existing.variantIds.push(variantId);
                }
                if (swatches && swatches.length > 0) {
                    const merged = collectColorSwatches(existing.swatches, existing.swatch, swatches);
                    if (merged.length > 0) {
                        existing.swatches = merged;
                        [existing.swatch] = merged;
                    }
                }
            } else {
                optionMap.set(optionValue, {
                    value: optionValue,
                    label: optionLabel ?? optionValue,
                    variantIds: [variantId],
                    swatch: swatches?.[0],
                    swatches,
                });
            }
        });

        const variantColorSwatches = collectColorSwatches(variant.colorSwatches, colorRawValues);

        return {
            id: variantId,
            sku: variant.sku,
            priceModel,
            unitPrice,
            unitOfMeasure: normalizeUnit(variant.price?.unitOfMeasure ?? variant.inventory?.trackingUnit),
            finalPrice,
            barcode: variant.barcode,
            discountPercent,
            offerAmount: variant.offer?.amount ?? undefined,
            offerLabel: variant.offer?.label ?? undefined,
            offerStartsAt: variant.offer?.startsAt ? new Date(variant.offer.startsAt).toISOString() : undefined,
            offerEndsAt: variant.offer?.endsAt ? new Date(variant.offer.endsAt).toISOString() : undefined,
            inventoryQuantity,
            inventoryTrackingUnit: variant.inventory?.trackingUnit ?? "unit",
            lowStockThreshold,
            minimumOrderQuantity: variant.minimumOrderQuantity ?? undefined,
            maximumOrderQuantity: variant.maximumOrderQuantity ?? undefined,
            colorKey: variant.colorKey ?? undefined,
            colorName: variant.colorName ?? undefined,
            colorSwatches: variantColorSwatches.length > 0 ? variantColorSwatches : undefined,
            colorFamily: variant.colorFamily ?? undefined,
            attributes,
            attributesSummary,
            attributeEntries,
            variantAttributeValues,
            media: mediaList,
            mediaThumbId: mediaThumbFileId ?? undefined,
            weightGramsPerUnit: (variant.inventory as { weightGramsPerUnit?: number } | undefined)?.weightGramsPerUnit,
        };
    });
    const variantAttributes: VariantAttributeDefinition[] = variantAttributeDefsRaw
        .map((attr) => {
            const options = Array.from(attributeOptionMaps.get(attr.key)?.values() ?? []);
            return {
                key: attr.key,
                label: attr.label ?? attr.key,
                kind: attr.kind,
                isColor: attr.kind === 'color',
                options,
            };
        })
        .filter((attribute) => attribute.options.length > 0);

    const hasInventory = variants.some((variant) => variant.inventoryQuantity > 0);

    const productObjectId = new Types.ObjectId(product._id);

    const [publishedReviews, reviewAggregates] = await Promise.all([
        ProductReviewModel.find({ productId: productObjectId, status: "published" })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean(),
        ProductReviewModel.aggregate([
            { $match: { productId: productObjectId, status: "published" } },
            { $group: { _id: null, average: { $avg: "$rating" }, total: { $sum: 1 } } },
        ]),
    ]);

    const reviews: ProductReview[] = (publishedReviews ?? [])
        .map((review) => ({
            id: toStringId(review._id) ?? "",
            rating: review.rating ?? 0,
            comment: typeof review.comment === "string" ? review.comment : undefined,
            author:
                typeof review.authorName === "string" && review.authorName.trim() ? review.authorName.trim() : undefined,
            variantSummary: typeof review.variantSummary === "string" ? review.variantSummary : undefined,
            createdAt:
                review.createdAt instanceof Date
                    ? review.createdAt.toISOString()
                    : new Date(review.createdAt).toISOString(),
        }))
        .filter((review) => review.id);

    const aggregateAverage = Array.isArray(reviewAggregates) ? reviewAggregates[0]?.average : undefined;
    const aggregateTotal = Array.isArray(reviewAggregates) ? reviewAggregates[0]?.total : undefined;
    const averageRating =
        typeof aggregateAverage === "number"
            ? aggregateAverage
            : reviews.length > 0
                ? reviews.reduce((sum, review) => sum + (review.rating ?? 0), 0) / reviews.length
                : 0;
    const totalReviews = typeof aggregateTotal === "number" ? aggregateTotal : reviews.length;

        return {
            id: toStringId(product._id) ?? "",
            slug: product.slug ?? slug,
            title: product.title ?? "بدون عنوان",
            description: product.description ?? undefined,
            seoTitle: typeof product.seoTitle === "string" ? product.seoTitle : undefined,
            seoDescription: typeof product.seoDescription === "string" ? product.seoDescription : undefined,
            brand: product.brand ?? undefined,
            categories: categoryInfos,
            productTypeId,
            productTypeName: productType?.name ?? undefined,
            productFacts,
            variants,
            activeVariantCount: variants.length,
            hasInventory,
            colorAttributeLabel: colorAttribute?.label,
            sizeAttributeLabel: sizeAttribute?.label ?? sizeAttribute?.key,
            variantAttributes,
            reviews,
            reviewStats: {
                averageRating,
                total: totalReviews,
            },
        };
    } catch (error) {
        console.warn("loadProductDetail failed; serving preview product", error);
        return getPreviewProductDetail(slug);
    }
}
