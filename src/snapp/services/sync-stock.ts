import { snpGetVendors, snpUpdateProducts } from "../api";
import SnapVariantModel from "../models/variants";

export async function snpSyncStock(vendorId: string, products: { sku: string, stock: number, price?: number }[]) {

    try {
        const { data } = await snpGetVendors(vendorId);
        const syncedProducts: { sku: string, stock: number, price: number }[] = [];

        for (let index = 0; index < products.length; index++) {
            const { sku: barcode } = products[index];
            const s = await SnapVariantModel.findOne({ vendorId, barcode })
            if (!s) continue;

            syncedProducts.push({
                ...products[index],
                price: (s.price || 0) * 10
            });
        }

        if (syncedProducts.length)
            return Promise.all(
                data.map(async ({ id }) => {
                    try {
                        console.log("sync back to snapp", { products: syncedProducts });

                        await snpUpdateProducts(vendorId, id, { products: syncedProducts })
                        await Promise.all(
                            syncedProducts.map(({ sku, stock }) =>
                                SnapVariantModel.updateMany(
                                    { vendorId, barcode: sku },
                                    { $set: { quantity: stock } }
                                )
                            )
                        );
                    } catch (err: any) {
                        if (err?.status !== 404) console.error("snapp stock update failed", err?.status, err?.message);
                    }
                })
            )
    } catch { }
}
/**
 * Set a time-boxed special (discount) price on Snapp. `special_price` arrives in
 * تومان (converted ×10 to ریال here, like the regular price). Passing
 * special_price = 0 with no dates clears the discount.
 */
export async function snpSyncSpecialPrice(
    vendorId: string,
    products: { sku: string; special_price: number; special_price_start_at?: string; special_price_end_at?: string }[],
) {
    try {
        const { data } = await snpGetVendors(vendorId);
        const synced: Record<string, unknown>[] = [];
        for (const p of products) {
            const s = await SnapVariantModel.findOne({ vendorId, barcode: p.sku });
            if (!s) continue;
            synced.push({
                sku: p.sku,
                special_price: Math.max(0, p.special_price) * 10,
                ...(p.special_price_start_at ? { special_price_start_at: p.special_price_start_at } : {}),
                ...(p.special_price_end_at ? { special_price_end_at: p.special_price_end_at } : {}),
            });
        }
        if (!synced.length) return;
        return Promise.all(
            data.map(async ({ id }) => {
                try {
                    await snpUpdateProducts(vendorId, id, { products: synced as never });
                } catch (err: any) {
                    if (err?.status !== 404) console.error("snapp special-price update failed", err?.status, err?.message);
                }
            }),
        );
    } catch { }
}

export async function snpSyncPrice(vendorId: string, products: { sku: string, price: number }[]) {

    try {
        const { data } = await snpGetVendors(vendorId);
        const syncedProducts: { sku: string, price: number }[] = [];
        const localPrices: { sku: string, price: number }[] = [];

        for (let index = 0; index < products.length; index++) {
            const { sku: barcode } = products[index];
            const s = await SnapVariantModel.findOne({ vendorId, barcode })
            if (!s) continue;

            localPrices.push(products[index]);
            syncedProducts.push({
                ...products[index],
                price: products[index].price * 10
            });
        }

        if (syncedProducts.length)
            return Promise.all(
                data.map(async ({ id }) => {
                    try {
                        await snpUpdateProducts(vendorId, id, { products: syncedProducts })
                        await Promise.all(
                            localPrices.map(({ sku, price }) =>
                                SnapVariantModel.updateMany(
                                    { vendorId, barcode: sku },
                                    { $set: { price } }
                                )
                            )
                        );
                    } catch (err: any) {
                        if (err?.status !== 404) console.error("snapp stock update failed", err?.status, err?.message);
                    }
                })
            )
    } catch { }
}
