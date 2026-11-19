import ProductModel from "@/catalog/models/Product";
import DgkVariantModel from "@/digikala/models/variants";

import BslVariantModel, { ensureBslVariantIndexes } from "../models/variants";
import { bslGetProducts } from "./products";
import { bslVariantUpdate } from "./updateVarinat";

function normalizeSku(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

type SiteLink = {
    productId?: unknown;
    variantId?: unknown;
    barcode?: string;
    siteStock?: number;
};

/**
 * Resolve the site variant a Basalaam SKU points at.
 *
 * The LAST segment of a Basalaam SKU is the variant number that the site stamps
 * on each variant — e.g. `dkp-3814-7220433` -> site variant sku "7220433", and
 * `dkp-3814-21732563-78975970` -> site variant sku "78975970". So we match that
 * number precisely against the site variant `sku` first, then fall back to the
 * Digikala variant id (dgkVariantId) when the site variant is keyed differently.
 *
 * We deliberately do NOT fall back to matching the Digikala *product* id: a
 * product-level SKU maps to many size variants, so linking to an arbitrary one
 * would sync stock to the wrong size.
 */
async function resolveSiteLinkFromBslSku(sku: string): Promise<SiteLink | null> {
    const parts = sku.split("-");
    const variantNo = parts[parts.length - 1];
    if (!/^\d+$/.test(variantNo)) return null;

    // 1) Site variant whose sku is exactly the variant number.
    const bySiteSku = await ProductModel.findOne(
        { "variants.sku": variantNo },
        { "variants.$": 1 },
    );
    const sv = bySiteSku?.variants?.[0];
    if (bySiteSku && sv) {
        return {
            productId: bySiteSku._id,
            variantId: sv._id,
            barcode: sv.barcode ?? sv.sku,
            siteStock: Math.max(0, Number(sv.inventory?.quantity ?? 0) || 0),
        };
    }

    // 2) Resolve through the Digikala variant id -> its linked site variant.
    const dgk = await DgkVariantModel.findOne({ dgkVariantId: Number(variantNo) });
    if (dgk?.variantId) {
        const sp = await ProductModel.findOne(
            { _id: dgk.productId, "variants._id": dgk.variantId },
            { "variants.$": 1 },
        );
        const spv = sp?.variants?.[0];
        return {
            productId: dgk.productId,
            variantId: dgk.variantId,
            barcode: dgk.barcode,
            siteStock: spv ? Math.max(0, Number(spv.inventory?.quantity ?? 0) || 0) : undefined,
        };
    }

    return null;
}

export async function getBslVariantSync(vendorId: string) {
    await ensureBslVariantIndexes();

    // Heal historical over-linking: records with no sku must not carry a site
    // link (the old empty-sku match attached hundreds of unrelated products to a
    // single variant). Clear those links up-front so the panel is correct even
    // before each record re-syncs.
    await BslVariantModel.updateMany(
        { vendorId, variantId: { $ne: null }, $or: [{ sku: "" }, { sku: null }, { sku: { $exists: false } }] },
        { $set: { variantId: null, productId: null, barcode: null } },
    );

    let page = 1;
    let pages = 1;

    try {
        while (page <= pages) {
            const { data, total_page } = await bslGetProducts(vendorId, page, 100);

            // One query for which page records already carried a link, and one
            // bulkWrite for the whole page instead of two ops per variation.
            const existingRows = await BslVariantModel.find(
                { vendorId, bslProductId: { $in: data.map((d) => d.id) } },
                { bslProductId: 1, bslVariantId: 1, variantId: 1 },
            ).lean();
            const existingMap = new Map(existingRows.map((r) => [`${r.bslProductId}:${r.bslVariantId}`, r.variantId]));
            const ops: any[] = [];
            const pendingPushes: { barcode: string; stock: number }[] = [];

            for (let index = 0; index < data.length; index++) {
                const { title, id, variant, inventory: stock, sku, primary_price } = data[index];

                if (variant?.length) {
                    for (const item of variant) {
                        const itemSku = normalizeSku(item.sku) || normalizeSku(sku) || String(item.id);

                        try {
                            let inventory: any = {
                                bslProductId: id,
                                bslVariantId: item.id,
                                quantity: item.stock,
                                displayName: title.concat(` | ${item.properties.map((x) => `${x.property.title}: ${x.value.title}`).join(", ")}`),
                                vendorId,
                                sku: itemSku,
                                price: item.primary_price || primary_price,
                                // Default to UNLINKED; only set on a real match. Without
                                // this, an empty sku matched the first site variant with an
                                // empty barcode and linked hundreds of unrelated Basalam
                                // products to it. Defaulting to null also clears stale bad
                                // links on the next re-sync.
                                productId: null,
                                variantId: null,
                                barcode: itemSku || null,
                            };

                            let siteStock: number | undefined;

                            const product = itemSku ? await ProductModel.findOne({
                                $or: [
                                    { "variants.barcode": itemSku },
                                    { "variants.sku": itemSku },
                                ],
                            }) : null;

                            if (product) {
                                const matchedVariant = product.variants.find((x) => x.barcode === itemSku || x.sku === itemSku);
                                siteStock = Math.max(0, Number(matchedVariant?.inventory?.quantity ?? 0) || 0);

                                inventory = {
                                    ...inventory,
                                    productId: product?._id,
                                    variantId: matchedVariant?._id,
                                    barcode: itemSku,
                                };
                            } else if (itemSku.startsWith("dkp-")) {
                                const link = await resolveSiteLinkFromBslSku(itemSku);
                                if (link) {
                                    if (link.siteStock !== undefined) siteStock = link.siteStock;
                                    inventory = {
                                        ...inventory,
                                        productId: link.productId,
                                        variantId: link.variantId,
                                        barcode: link.barcode ?? inventory.barcode,
                                    };
                                }
                            }

                            const filter = { vendorId, bslProductId: inventory.bslProductId, bslVariantId: inventory.bslVariantId };
                            const existingVariantId = existingMap.get(`${inventory.bslProductId}:${inventory.bslVariantId}`);

                            ops.push({ updateOne: { filter, update: { $set: inventory }, upsert: true } });

                            if (!existingVariantId && inventory.variantId && inventory.barcode && siteStock !== undefined) {
                                pendingPushes.push({ barcode: inventory.barcode, stock: siteStock });
                            }
                        } catch (err) {
                            console.error("bsl save variant error:", err);
                        }
                    }
                } else {
                    const productSku = normalizeSku(sku);
                    let inventory: any = {
                        bslProductId: id,
                        bslVariantId: null,
                        quantity: stock,
                        displayName: title,
                        vendorId,
                        sku: productSku,
                        price: primary_price,
                        // Default to UNLINKED (see note above) so an empty sku never
                        // links to an arbitrary site variant and stale links self-clear.
                        productId: null,
                        variantId: null,
                        barcode: productSku || null,
                    };

                    let siteStock: number | undefined;

                    const product = productSku ? await ProductModel.findOne({
                        $or: [
                            { "variants.barcode": productSku },
                            { "variants.sku": productSku },
                        ],
                    }) : null;

                    if (product) {
                        const matchedVariant = product.variants.find((x) => x.barcode === productSku || x.sku === productSku);
                        siteStock = Math.max(0, Number(matchedVariant?.inventory?.quantity ?? 0) || 0);

                        inventory = {
                            ...inventory,
                            productId: product?._id,
                            variantId: matchedVariant?._id,
                            barcode: productSku,
                        };
                    } else if (productSku.startsWith("dkp-")) {
                        const link = await resolveSiteLinkFromBslSku(productSku);
                        if (link) {
                            if (link.siteStock !== undefined) siteStock = link.siteStock;
                            inventory = {
                                ...inventory,
                                productId: link.productId,
                                variantId: link.variantId,
                                barcode: link.barcode ?? inventory.barcode,
                            };
                        }
                    }

                    const filter = { vendorId, bslProductId: inventory.bslProductId, bslVariantId: inventory.bslVariantId };
                    const existingVariantId = existingMap.get(`${inventory.bslProductId}:${inventory.bslVariantId}`);

                    ops.push({ updateOne: { filter, update: { $set: inventory }, upsert: true } });

                    if (!existingVariantId && inventory.variantId && inventory.barcode && siteStock !== undefined) {
                        pendingPushes.push({ barcode: inventory.barcode, stock: siteStock });
                    }
                }
            }

            if (ops.length) {
                try {
                    await BslVariantModel.bulkWrite(ops, { ordered: false });
                } catch (err) {
                    console.error("bsl variant bulk write failed", vendorId, err instanceof Error ? err.message : err);
                }
            }

            // Initial stock push for newly-linked items (marketplace-rate-limited).
            for (const push of pendingPushes) {
                try {
                    await bslVariantUpdate(vendorId, push.barcode, push.stock);
                } catch (syncError) {
                    console.error("bsl initial stock push failed", syncError);
                }
            }

            pages = total_page;

            await new Promise((res) => setTimeout(res, 250));

            page += 1;
        }
    } catch (err: any) {
        console.error("sync vendor failed", err?.message ?? err, err?.data);
    }
}
