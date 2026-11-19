import ProductModel from "@/catalog/models/Product";
import ProductTypeModel, { ProductTypeDocument } from "@/catalog/models/ProductType";

import DgkVariantModel, { ensureDgkVariantIndexes } from "../models/variants";
import { dgkGetVariants } from "./get-variants";
import { getDgkVariantUpdate } from "./veriant-update";

export async function getDgkVariantSync(vendorId: string) {
    await ensureDgkVariantIndexes();

    let page = 1;
    let pages = 1;

    try {
        while (page <= pages) {
            const { items, pager: { total_pages }, rate_limit: { current, max, resetTime } } = await dgkGetVariants(vendorId, page);

            const barcodes = items.map((item) => item.supplier_code).filter(Boolean);
            const skus = items.map((item) => String(item.product_variant_id)).filter(Boolean);

            const productTypes = await ProductTypeModel.find().lean<ProductTypeDocument[]>();
            const products = await ProductModel.find({
                $or: [
                    { "variants.sku": { $in: skus } },
                    { "variants.barcode": { $in: barcodes } },
                ],
            });

            // Which records already carried a site link (so we only push initial
            // stock for newly-linked ones). One query for the whole page.
            const pageVariantIds = items.map((i) => i.product_variant_id);
            const existingRows = await DgkVariantModel.find(
                { vendorId, dgkVariantId: { $in: pageVariantIds } },
                { dgkVariantId: 1, variantId: 1 },
            ).lean();
            const linkedBefore = new Set(existingRows.filter((r) => r.variantId).map((r) => Number(r.dgkVariantId)));

            // Collect DB writes and push the whole page in one bulkWrite.
            const ops: any[] = [];
            const pendingPushes: { barcode: string; stock: number }[] = [];

            for (let index = 0; index < items.length; index++) {
                const { supplier_code, marketplace_seller_stock, product_variant_id, product_id, title, price_sale } = items[index];

                const dgkSku = String(product_variant_id);
                const product = products.find((p) => p.variants.some((v) => v.sku === dgkSku))
                    || products.find((p) => p.variants.some((v) => v.barcode === supplier_code));
                const variant = product?.variants.find((v) => v.sku === dgkSku)
                    || product?.variants.find((v) => v.barcode === supplier_code);
                const localStock = Math.max(0, Number(variant?.inventory?.quantity ?? 0) || 0);

                let match: any;

                if (product && variant) {
                    const type = productTypes.find((t) => `${t._id}` === `${product.productTypeId}`);
                    const attrTitle = variant.attributeValues
                        .map((item) => {
                            if (item.key === "weightGrams") return "";
                            const attribute = type?.attributes.find((x) => x.key === item.key);
                            return `${attribute?.label || item.key}: ${item.key === "color" ? (item.value as any).name : item.value}`;
                        })
                        .filter((x) => !!x);

                    match = {
                        attributeValues: variant.attributeValues,
                        barcode: variant.barcode || supplier_code,
                        mediaId: variant.mediaIds?.[0] && `${variant.mediaIds?.[0]}`,
                        price: variant.price.amount,
                        productId: `${product._id}`,
                        quantity: localStock,
                        sku: variant.sku,
                        trackingUnit: variant.inventory.trackingUnit,
                        variantId: `${variant._id}`,
                        displayName: `${product.title} ${attrTitle.join(" | ")}`,
                        slug: product.slug,
                    };
                }

                ops.push({
                    updateOne: {
                        filter: { vendorId, dgkProductId: product_id, dgkVariantId: product_variant_id },
                        update: {
                            $set: {
                                productId: match?.productId,
                                variantId: match?.variantId,
                                barcode: match?.barcode || supplier_code,
                                quantity: marketplace_seller_stock,
                                displayName: title,
                                vendorId,
                                price: price_sale / 10,
                            },
                        },
                        upsert: true,
                    },
                });

                const resolvedBarcode = match?.barcode || supplier_code;
                if (!linkedBefore.has(product_variant_id) && match?.variantId && resolvedBarcode) {
                    pendingPushes.push({ barcode: resolvedBarcode, stock: localStock });
                }
            }

            if (ops.length) {
                try {
                    await DgkVariantModel.bulkWrite(ops, { ordered: false });
                } catch (err) {
                    console.error("dgk variant bulk write failed", vendorId, err instanceof Error ? err.message : err);
                }
            }

            // Initial stock push for newly-linked items (marketplace-rate-limited,
            // so kept sequential per item).
            for (const push of pendingPushes) {
                try {
                    await getDgkVariantUpdate(vendorId, push.barcode, push.stock);
                } catch (syncError) {
                    console.error("dgk initial stock push failed", syncError);
                }
            }

            pages = total_pages;

            const rTime = new Date(resetTime?.date).getTime();
            const diffMs = Number.isFinite(rTime) ? Math.max(0, rTime - Date.now()) : 0;
            // Smart wait: if rate limit is not close to max, wait less
            const waitMs = max - current > 5
                ? Math.min(800, Math.max(200, Math.ceil(diffMs / Math.max(total_pages, 1))))
                : max - current > 2
                    ? Math.min(1200, Math.max(300, Math.ceil(diffMs / Math.max(total_pages, 1))))
                    : Math.min(10000, diffMs + 500);

            await new Promise((res) => setTimeout(res, waitMs));

            page += 1;
        }
    } catch (err: any) {
        console.error("sync vendor failed", err?.message ?? err, err?.data);
    }
}
