import ProductModel from "@/catalog/models/Product";
import type { SnappOrder } from "../api/type";

export type EnrichedSnappItem = {
    title: string;
    summary: string;
    imageId: string;
    slug: string;
};

/** Build a short variant summary (e.g. "زیتونی، 41") from attribute values. */
function summarize(attributeValues: { key: string; value: unknown }[] = []): string {
    return attributeValues
        .filter((a) => a.key !== "weightGrams")
        .map((a) => {
            const v = a.value;
            if (v && typeof v === "object" && "name" in (v as Record<string, unknown>)) {
                return String((v as { name?: unknown }).name ?? "");
            }
            return v === undefined || v === null ? "" : String(v);
        })
        .filter(Boolean)
        .join("، ");
}

/**
 * Snapp's order API only carries the sku / vendor_product_info_id for each line —
 * no title or image. Resolve those from the local catalog (variant barcode = sku)
 * so the panel, copy text and tracking can show the real product name + photo.
 * Returns a map keyed by sku.
 */
export async function buildSnappItemMap(orders: SnappOrder[]): Promise<Record<string, EnrichedSnappItem>> {
    const skus = Array.from(
        new Set(
            orders
                .flatMap((order) => order.items.map((item) => item.sku))
                .filter((sku): sku is string => Boolean(sku && sku.trim())),
        ),
    );
    if (!skus.length) return {};

    const products = await ProductModel.find(
        { "variants.barcode": { $in: skus } },
        { title: 1, slug: 1, "variants.barcode": 1, "variants.mediaIds": 1, "variants.attributeValues": 1 },
    ).lean();

    const map: Record<string, EnrichedSnappItem> = {};
    for (const product of products) {
        for (const variant of product.variants ?? []) {
            const barcode = variant.barcode;
            if (!barcode || !skus.includes(barcode) || map[barcode]) continue;
            map[barcode] = {
                title: product.title ?? "",
                summary: summarize(variant.attributeValues as { key: string; value: unknown }[]),
                imageId: variant.mediaIds?.[0] ? String(variant.mediaIds[0]) : "",
                slug: product.slug ?? "",
            };
        }
    }
    return map;
}
