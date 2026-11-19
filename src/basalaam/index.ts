import { connectMongoose } from "@/lib/mongoose";
import { getVendors } from "@/settings/services/vendorService";
import { getBslVariantSync } from "./services/syncVariants";
import { bslVariantPriceUpdate, bslVariantUpdate } from "./services/updateVarinat";
import { bslSyncOrders } from "./services/syncOrders";
import { mapConcurrent, VENDOR_CONCURRENCY } from "@/sync/concurrency";

// Vendors are independent accounts → synced in parallel.

export async function syncBslVendorsVariants() {
    await connectMongoose();
    const vendors = await getVendors("basalaam");
    await mapConcurrent(vendors, VENDOR_CONCURRENCY, (vendorId) => getBslVariantSync(vendorId));
}


type SyncStockProps = {
    barcode: string
    stock: number
}[]
export async function syncBslVendorsStock(variants: SyncStockProps) {
    await connectMongoose();
    const vendors = await getVendors("basalaam");
    await mapConcurrent(vendors, VENDOR_CONCURRENCY, async (vendorId) => {
        for (let i = 0; i < variants.length; i++) {
            const { barcode, stock } = variants[i];
            await bslVariantUpdate(vendorId, barcode, stock);
        }
    });
}

type SyncPriceProps = {
    barcode: string
    price: number
}[]
export async function syncBslVendorsPrice(variants: SyncPriceProps) {
    await connectMongoose();
    const vendors = await getVendors("basalaam");
    await mapConcurrent(vendors, VENDOR_CONCURRENCY, async (vendorId) => {
        for (let i = 0; i < variants.length; i++) {
            const { barcode, price } = variants[i];
            await bslVariantPriceUpdate(vendorId, barcode, price);
        }
    });
}


export async function syncBslVendorsOrders() {
    await connectMongoose();
    const vendors = await getVendors("basalaam");
    await mapConcurrent(vendors, VENDOR_CONCURRENCY, (vendorId) => bslSyncOrders(vendorId));
}
