import ProductModel from "@/catalog/models/Product";

import { snpGetProducts, snpGetVendors } from "../api";
import SnapVariantModel, { ensureSnpVariantIndexes } from "../models/variants";
import { snpSyncStock } from "./sync-stock";

export async function snpSyncVariants(vendorId: string) {
    await ensureSnpVariantIndexes();
    const { data } = await snpGetVendors(vendorId);

    return Promise.all(
        data.map(async ({ id }) => {
            let page = 1;
            let pages = 1;
            try {
                while (page <= pages) {
                    const {
                        data: products,
                        meta: {
                            pagination: { total_pages },
                        },
                    } = await snpGetProducts(vendorId, id, page);

                    page++;

                    if (products.length) {
                        // Resolve the whole page in a few queries instead of two per
                        // product — far fewer DB round-trips on a large catalog.
                        const skus = Array.from(new Set(products.map((p) => p.sku).filter(Boolean)));
                        const snpIds = products.map((p) => p.id);

                        const [siteProducts, existingRows] = await Promise.all([
                            skus.length
                                ? ProductModel.find(
                                    { "variants.barcode": { $in: skus } },
                                    { _id: 1, "variants._id": 1, "variants.barcode": 1, "variants.inventory.quantity": 1 },
                                ).lean()
                                : Promise.resolve([]),
                            SnapVariantModel.find({ snpProductId: { $in: snpIds } }, { snpProductId: 1, variantId: 1 }).lean(),
                        ]);

                        // barcode -> { productId, variantId, stock }
                        const byBarcode = new Map<string, { productId: unknown; variantId: unknown; stock: number }>();
                        for (const p of siteProducts) {
                            for (const v of p.variants ?? []) {
                                if (v.barcode && !byBarcode.has(v.barcode)) {
                                    byBarcode.set(v.barcode, {
                                        productId: p._id,
                                        variantId: v._id,
                                        stock: Math.max(0, Number(v.inventory?.quantity ?? 0) || 0),
                                    });
                                }
                            }
                        }
                        const linkedBefore = new Set(
                            existingRows.filter((r) => r.variantId).map((r) => String(r.snpProductId)),
                        );

                        const ops = products.map((snpProduct) => {
                            const match = snpProduct.sku ? byBarcode.get(snpProduct.sku) : undefined;
                            return {
                                updateOne: {
                                    filter: { snpProductId: snpProduct.id },
                                    update: {
                                        $set: {
                                            productId: match?.productId ?? null,
                                            variantId: match?.variantId ?? null,
                                            barcode: snpProduct.sku,
                                            snpProductId: snpProduct.id,
                                            quantity: snpProduct.stock,
                                            displayName: snpProduct.title,
                                            vendorId,
                                            price: snpProduct.price / 10,
                                        },
                                    },
                                    upsert: true,
                                },
                            };
                        });

                        await SnapVariantModel.bulkWrite(ops, { ordered: false });

                        // Push the correct site stock for newly-linked items, batched
                        // into a single vendor call.
                        const initialPush = products
                            .filter((p) => p.sku && !linkedBefore.has(String(p.id)) && byBarcode.get(p.sku)?.variantId)
                            .map((p) => ({ sku: p.sku, stock: byBarcode.get(p.sku)!.stock }));
                        if (initialPush.length) {
                            try {
                                await snpSyncStock(vendorId, initialPush);
                            } catch (syncError) {
                                console.log("snapp initial stock push failed", syncError);
                            }
                        }
                    }

                    pages = total_pages;
                }
            } catch {
                // ignore vendor sync errors
            }
        }),
    );
}
