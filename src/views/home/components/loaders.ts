"use server"

import { ProductCardProps } from "@/components/product";
import { loadDiscountProducts, loadNewestProducts, loadPopularProducts } from "@/lib/cache";
import MediaModel from "@/models/Media";
import { formatFinalProduct } from "@/views/store/components/product-loader";
import { Types } from "mongoose";
import {
    getPreviewDiscountProducts,
    getPreviewNewestProducts,
    getPreviewPopularProducts,
} from "@/lib/preview-fallback";

export async function loadPopular() {
    const { items } = await loadPopularProducts();

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

    if (products.length === 0) {
        return getPreviewPopularProducts().items;
    }

    return products;
}

export async function loadDiscount() {
    const { items } = await loadDiscountProducts();

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

    if (products.length === 0) {
        return getPreviewDiscountProducts().items;
    }

    return products;
}
export async function loadNewest() {
    const { items } = await loadNewestProducts();

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

    if (products.length === 0) {
        return getPreviewNewestProducts().items;
    }

    return products;
}