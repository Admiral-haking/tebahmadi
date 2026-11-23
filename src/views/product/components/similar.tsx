import ProductCard, { type ProductCardProps } from "@/components/product";
import ProductModel, { type ProductDocument, type VariantSchema } from "@/catalog/models/Product";
import { effectiveUnitPrice } from "@/catalog/services/productService";
import MediaModel from "@/media/models/Media";
import { connectMongoose } from "@/lib/mongoose";
import { Grid, Stack, Typography } from "@mui/material";
import { Types } from "mongoose";
import type { ProductDetailData } from "../data";
import { isMongoConfigured, getPreviewSimilarProducts } from "@/lib/preview-fallback";

const SIMILAR_LIMIT = 8;

type LeanVariant = VariantSchema & {
    mediaIds?: (Types.ObjectId | string)[];
};

type SimilarProductDoc = {
    _id: Types.ObjectId;
    slug: string;
    title: string;
    variants: LeanVariant[];
    attrs?: ProductDocument["attrs"];
};

type MediaProjection = {
    _id: Types.ObjectId;
    originalId?: Types.ObjectId;
    mobileId?: Types.ObjectId;
    thumbId?: Types.ObjectId;
};

function toPlainAttrs(value: SimilarProductDoc["attrs"]): Record<string, unknown> {
    if (!value) {
        return {};
    }
    if (value instanceof Map) {
        return Object.fromEntries(value.entries());
    }
    return value as Record<string, unknown>;
}

function formatSimilarProduct(
    product: SimilarProductDoc,
    mediaMap: Map<string, MediaProjection>,
    now: Date,
): ProductCardProps | null {
    const variants = Array.isArray(product.variants)
        ? product.variants.filter((variant) => variant?.active)
        : [];
    if (variants.length === 0) {
        return null;
    }

    let selectedFinalPrice = Number.POSITIVE_INFINITY;
    let selectedBasePrice: number | undefined;
    let selectedDiscountPercent: number | undefined;
    let inventoryTotal = 0;

    variants.forEach((variant) => {
        const basePrice = Number(variant?.price?.amount ?? Number.NaN);
        const finalPrice = effectiveUnitPrice(variant as ProductDocument["variants"][number], now);
        const quantity = Number(variant?.inventory?.quantity ?? 0);
        if (Number.isFinite(quantity)) {
            inventoryTotal += quantity;
        }
        if (Number.isNaN(basePrice)) {
            return;
        }
        if (finalPrice < selectedFinalPrice) {
            selectedFinalPrice = finalPrice;
            selectedBasePrice = basePrice;
            if (variant.offer && finalPrice < basePrice) {
                const discount = variant.offer.amount ?? 0;
                if (discount > 0 && basePrice > 0) {
                    selectedDiscountPercent = Math.round((discount / basePrice) * 100);
                } else {
                    selectedDiscountPercent = undefined;
                }
            } else {
                selectedDiscountPercent = undefined;
            }
        }
    });

    if (!Number.isFinite(selectedFinalPrice)) {
        return null;
    }

    const attrs = toPlainAttrs(product.attrs);
    const sizesRaw = attrs.size;
    const sizes = Array.isArray(sizesRaw)
        ? sizesRaw.map((item) => `${item}`).filter((item) => item.length > 0)
        : typeof sizesRaw === "string"
            ? [sizesRaw]
            : [];

    const colorEntries = variants
        .filter((variant) => Array.isArray(variant.colorSwatches) && variant.colorSwatches.length > 0)
        .map((variant) => ({
            key: variant.colorKey ?? variant.sku,
            swatches: variant.colorSwatches ?? [],
        }));
    const uniqueColors = Array.from(new Map(colorEntries.map((entry) => [entry.key, entry])).values()).slice(0, 4);

    let imageUrl: string | undefined;
    const mediaSourceVariant = variants.find(
        (variant) => Array.isArray(variant.mediaIds) && variant.mediaIds.length > 0,
    );
    if (mediaSourceVariant?.mediaIds && mediaSourceVariant.mediaIds.length > 0) {
        const primaryMediaId = mediaSourceVariant.mediaIds[0];
        const key = primaryMediaId instanceof Types.ObjectId ? primaryMediaId.toString() : `${primaryMediaId}`;
        const media = mediaMap.get(key);
        const imageId = media?.thumbId ?? media?.mobileId ?? media?.originalId;
        if (imageId) {
            imageUrl = `/api/media/${imageId.toString()}`;
        }
    }

    return {
        id: product._id.toString(),
        slug: product.slug,
        title: product.title,
        finalPrice: selectedFinalPrice,
        originalPrice:
            selectedBasePrice && selectedFinalPrice < selectedBasePrice ? selectedBasePrice : undefined,
        discountPercent: selectedDiscountPercent,
        inStock: inventoryTotal > 0,
        imageUrl,
        colors: uniqueColors.map((item) => item.swatches[0]).filter(Boolean),
        sizes,
    };
}

async function loadSimilarProducts(product: ProductDetailData): Promise<ProductCardProps[]> {
    if (!isMongoConfigured()) {
        return getPreviewSimilarProducts(product.slug);
    }
    const categoryIds = (product.categories ?? [])
        .map((category) => (Types.ObjectId.isValid(category.id) ? new Types.ObjectId(category.id) : undefined))
        .filter((id): id is Types.ObjectId => Boolean(id));
    const productTypeId =
        product.productTypeId && Types.ObjectId.isValid(product.productTypeId)
            ? new Types.ObjectId(product.productTypeId)
            : undefined;

    if (categoryIds.length === 0 && !productTypeId) {
        return [];
    }

    try {
        await connectMongoose();

    const baseQuery: Record<string, unknown> = {
        status: "active",
        slug: { $ne: product.slug },
    };

    const similarityFilters: Record<string, unknown>[] = [];
    if (categoryIds.length > 0) {
        similarityFilters.push({ categories: { $in: categoryIds } });
    }
    if (productTypeId) {
        similarityFilters.push({ productTypeId });
    }

    if (similarityFilters.length > 0) {
        baseQuery.$or = similarityFilters;
    }

    const rawProducts = (await ProductModel.find(baseQuery)
        .select({
            slug: 1,
            title: 1,
            variants: 1,
            attrs: 1,
            createdAt: 1,
        })
        .sort({ createdAt: -1 })
        .limit(SIMILAR_LIMIT * 3)
        .lean<any[]>());

    if (rawProducts.length === 0) {
        return [];
    }

    const mediaIds = new Set<string>();
    rawProducts.forEach((doc) => {
        doc.variants?.forEach((variant: any) => {
            if (!Array.isArray(variant.mediaIds) || variant.mediaIds.length === 0) {
                return;
            }
            const mediaId = variant.mediaIds[0];
            if (mediaId instanceof Types.ObjectId) {
                mediaIds.add(mediaId.toString());
            } else if (typeof mediaId === "string" && mediaId.trim().length > 0) {
                mediaIds.add(mediaId);
            }
        });
    });

    let mediaMap = new Map<string, MediaProjection>();
    if (mediaIds.size > 0) {
        const idsToFetch = Array.from(mediaIds)
            .filter((id) => Types.ObjectId.isValid(id))
            .map((id) => new Types.ObjectId(id));
        if (idsToFetch.length > 0) {
            const docs = (await MediaModel.find({ _id: { $in: idsToFetch } })
                .select({ originalId: 1, mobileId: 1, thumbId: 1 })
                .lean()) as MediaProjection[];
            mediaMap = new Map(docs.map((doc) => [doc._id.toString(), doc]));
        }
    }

    const now = new Date();
    const products: ProductCardProps[] = [];
    rawProducts.forEach((doc) => {
        if (products.length >= SIMILAR_LIMIT) {
            return;
        }
        const card = formatSimilarProduct(doc, mediaMap, now);
        if (card) {
            products.push(card);
        }
    });

    return products;
    } catch (error) {
        console.warn("loadSimilarProducts failed; serving preview products", error);
        return getPreviewSimilarProducts(product.slug);
    }
}

export default async function SimilarProducts({
    product,
}: {
    product: ProductDetailData;
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    const similarProducts = await loadSimilarProducts(product);
    if (similarProducts.length === 0) {
        return null;
    }

    return (
        <Stack spacing={2} sx={{ mt: { xs: 4, md: 6 } }}>
            <Typography variant="h6" fontWeight={600}>
                محصولات مشابه
            </Typography>
            <Grid container spacing={2}>
                {similarProducts.map((item) => (
                    <Grid key={item.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                        <ProductCard {...item} />
                    </Grid>
                ))}
            </Grid>
        </Stack>
    );
}
