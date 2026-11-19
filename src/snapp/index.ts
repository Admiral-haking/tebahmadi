import { connectMongoose } from "@/lib/mongoose";
import { getVendors } from "@/settings/services/vendorService";
import { snpSyncVariants } from "./services/sycn-variants";
import { snpSyncPrice, snpSyncStock } from "./services/sync-stock";
import { snpSyncOrders } from "./services/sync-orders";
import { mapConcurrent, VENDOR_CONCURRENCY } from "@/sync/concurrency";

// Vendors are independent accounts → synced in parallel.

export async function syncSnpVendorsVariants() {
    await connectMongoose();
    const vendors = await getVendors("snapp");
    await mapConcurrent(vendors, VENDOR_CONCURRENCY, (vendorId) => snpSyncVariants(vendorId));
}


type SyncStockProps = {
    barcode: string
    stock: number
}[]
export async function syncSnpVendorsStock(variants: SyncStockProps) {
    await connectMongoose();
    const vendors = await getVendors("snapp");
    await mapConcurrent(vendors, VENDOR_CONCURRENCY, (vendorId) =>
        snpSyncStock(vendorId, variants.map(x => ({ sku: x.barcode, stock: x.stock }))),
    );
}
type SyncPriceProps = {
    barcode: string
    price: number
}[]
export async function syncSnpVendorsPrice(variants: SyncPriceProps) {
    await connectMongoose();
    const vendors = await getVendors("snapp");
    await mapConcurrent(vendors, VENDOR_CONCURRENCY, (vendorId) =>
        snpSyncPrice(vendorId, variants.map(x => ({ sku: x.barcode, price: x.price }))),
    );
}


export async function syncSnpVendorsOrders() {
    await connectMongoose();
    const vendors = await getVendors("snapp");
    await mapConcurrent(vendors, VENDOR_CONCURRENCY, (vendorId) => snpSyncOrders(vendorId));
}
