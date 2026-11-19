import { connectMongoose } from "@/lib/mongoose";
import { getVendors } from "@/settings/services/vendorService";
import { getDgkVariantSync } from "./services/sync-variants";
import { getDgkVariantUpdate } from "./services/veriant-update";
import { getDgkPriceUpdate } from "./services/price-update";
import { dgkSyncActiveOrders } from "./services/sync-active-orders";
import { dgkSyncHistoryOrders } from "./services/sync-history-orders";
import { dgkSyncShipBySellerOrders } from "./services/sync-sbs-orders";
import { mapConcurrent, VENDOR_CONCURRENCY } from "@/sync/concurrency";

// Vendors are independent accounts (separate rate limits), so they're synced in
// parallel; the per-vendor item paging stays sequential to respect each
// account's rate limit.

export async function syncDgkVendorsVariants() {
    await connectMongoose();
    const vendors = await getVendors("dgk");
    await mapConcurrent(vendors, VENDOR_CONCURRENCY, (vendorId) => getDgkVariantSync(vendorId));
}

type SyncStockProps = {
    barcode: string
    stock: number
}[]
export async function syncDgkVendorsStock(variants: SyncStockProps) {
    await connectMongoose();
    const vendors = await getVendors("dgk");
    await mapConcurrent(vendors, VENDOR_CONCURRENCY, async (vendorId) => {
        for (let i = 0; i < variants.length; i++) {
            const { barcode, stock } = variants[i];
            await getDgkVariantUpdate(vendorId, barcode, stock);
        }
    });
}

type SyncPriceProps = {
    barcode: string
    price: number
}[]
export async function syncDgkVendorsPrice(variants: SyncPriceProps) {
    await connectMongoose();
    const vendors = await getVendors("dgk");
    await mapConcurrent(vendors, VENDOR_CONCURRENCY, async (vendorId) => {
        for (let i = 0; i < variants.length; i++) {
            const { barcode, price } = variants[i];
            await getDgkPriceUpdate(vendorId, barcode, price);
        }
    });
}


export async function syncDgkVendorsOrders() {
    await connectMongoose();
    const vendors = await getVendors("dgk");
    await mapConcurrent(vendors, VENDOR_CONCURRENCY, async (vendorId) => {
        await dgkSyncActiveOrders(vendorId);
        await dgkSyncHistoryOrders(vendorId);
        // SBS sync backfills postal tracking codes + shipment status onto the
        // trackers. A vendor without the sbs_orders scope just 401/403s — don't
        // let that abort the other vendors' order sync.
        try {
            await dgkSyncShipBySellerOrders(vendorId);
        } catch (err) {
            console.error("dgk SBS sync failed", vendorId, (err as { message?: string })?.message ?? err);
        }
    });
}
