"use server"

import { ProductCardProps } from "@/components/product";
import { loadDiscountProducts, loadNewestProducts, loadPopularProducts } from "@/lib/cache";
import MediaModel from "@/models/Media";
import { formatFinalProduct } from "@/views/store/components/product-loader";
import { selectDiscountProducts } from "./discount-selection";
import { Types } from "mongoose";
import { isMongoConfigured } from "@/lib/mongoose";
import {
    getPreviewDiscountProducts,
    getPreviewNewestProducts,
    getPreviewPopularProducts,
} from "@/lib/preview-fallback";

export async function loadPopular() {
    try {
        const { items } = await loadPopularProducts();

        if (!isMongoConfigured()) {
            return getPreviewPopularProducts().items;
        }

        const mediaIds = new Set<string>();
        items.forEach((product) => {
            const variants = Array.isArray(product.activeVariants) ? product.activeVariants : [];
            variants.forEach((variant: any) => {
                if (!Array.isArray(variant.mediaIds) || variant.mediaIds.length === 0) {
                    return;
                }
                const mediaId = variant.mediaIds[0];
                if (mediaId instanceof Types.ObjectId) {
                    mediaIds.add(mediaId.toString());
                } else if (typeof mediaId === "string") {
                    mediaIds.add(mediaId);
                }
            });
        });

        let mediaMap = new Map<string, { originalId?: Types.ObjectId; mobileId?: Types.ObjectId; thumbId?: Types.ObjectId }>();
        if (mediaIds.size > 0) {
            const idsToFetch = Array.from(mediaIds)
                .filter((id) => Types.ObjectId.isValid(id))
                .map((id) => new Types.ObjectId(id));
            if (idsToFetch.length > 0) {
                const docs = await MediaModel.find({ _id: { $in: idsToFetch } })
                    .select({ originalId: 1, mobileId: 1, thumbId: 1 })
                    .lean();
                mediaMap = new Map(
                    docs.map((doc) => {
                        const key = doc._id instanceof Types.ObjectId ? doc._id.toString() : `${doc._id}`;
                        return [key, doc];
                    }),
                );
            }
        }

        const products: ProductCardProps[] = (await Promise.all(items.map(async (product) => await formatFinalProduct(product, mediaMap)))).filter((product) => product.inStock);

        return products;
    } catch (error) {
        console.warn("loadPopular failed; returning no published products:", error);
        return [];
    }
}

export async function loadDiscount() {
    try {
        const { items } = await loadDiscountProducts();

        if (!isMongoConfigured()) {
            return getPreviewDiscountProducts().items;
        }

        const mediaIds = new Set<string>();
        items.forEach((product) => {
            const variants = Array.isArray(product.activeVariants) ? product.activeVariants : [];
            variants.forEach((variant: any) => {
                if (!Array.isArray(variant.mediaIds) || variant.mediaIds.length === 0) {
                    return;
                }
                const mediaId = variant.mediaIds[0];
                if (mediaId instanceof Types.ObjectId) {
                    mediaIds.add(mediaId.toString());
                } else if (typeof mediaId === "string") {
                    mediaIds.add(mediaId);
                }
            });
        });

        let mediaMap = new Map<string, { originalId?: Types.ObjectId; mobileId?: Types.ObjectId; thumbId?: Types.ObjectId }>();
        if (mediaIds.size > 0) {
            const idsToFetch = Array.from(mediaIds)
                .filter((id) => Types.ObjectId.isValid(id))
                .map((id) => new Types.ObjectId(id));
            if (idsToFetch.length > 0) {
                const docs = await MediaModel.find({ _id: { $in: idsToFetch } })
                    .select({ originalId: 1, mobileId: 1, thumbId: 1 })
                    .lean();
                mediaMap = new Map(
                    docs.map((doc) => {
                        const key = doc._id instanceof Types.ObjectId ? doc._id.toString() : `${doc._id}`;
                        return [key, doc];
                    }),
                );
            }
        }

        const products: ProductCardProps[] = await Promise.all(
            items.map(async (product) => await formatFinalProduct(product, mediaMap)),
        );

        return selectDiscountProducts(products);
    } catch (error) {
        console.warn("loadDiscount failed; returning no special offers:", error);
        return [];
    }
}

export async function loadNewest() {
    try {
        const { items } = await loadNewestProducts();

        if (!isMongoConfigured()) {
            return getPreviewNewestProducts().items;
        }

        const mediaIds = new Set<string>();
        items.forEach((product) => {
            const variants = Array.isArray(product.activeVariants) ? product.activeVariants : [];
            variants.forEach((variant: any) => {
                if (!Array.isArray(variant.mediaIds) || variant.mediaIds.length === 0) {
                    return;
                }
                const mediaId = variant.mediaIds[0];
                if (mediaId instanceof Types.ObjectId) {
                    mediaIds.add(mediaId.toString());
                } else if (typeof mediaId === "string") {
                    mediaIds.add(mediaId);
                }
            });
        });

        let mediaMap = new Map<string, { originalId?: Types.ObjectId; mobileId?: Types.ObjectId; thumbId?: Types.ObjectId }>();
        if (mediaIds.size > 0) {
            const idsToFetch = Array.from(mediaIds)
                .filter((id) => Types.ObjectId.isValid(id))
                .map((id) => new Types.ObjectId(id));
            if (idsToFetch.length > 0) {
                const docs = await MediaModel.find({ _id: { $in: idsToFetch } })
                    .select({ originalId: 1, mobileId: 1, thumbId: 1 })
                    .lean();
                mediaMap = new Map(
                    docs.map((doc) => {
                        const key = doc._id instanceof Types.ObjectId ? doc._id.toString() : `${doc._id}`;
                        return [key, doc];
                    }),
                );
            }
        }

        const products: ProductCardProps[] = (await Promise.all(items.map(async (product) => await formatFinalProduct(product, mediaMap)))).filter((product) => product.inStock);

        return products;
    } catch (error) {
        console.warn("loadNewest failed; returning no published products:", error);
        return [];
    }
}
