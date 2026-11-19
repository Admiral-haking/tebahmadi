import { syncBslVendorsOrders, syncBslVendorsVariants } from "@/basalaam";
import { searchVariantsWithDisplayName } from "@/catalog/services/variantsService";
import { syncDgkVendorsOrders, syncDgkVendorsVariants } from "@/digikala";
import { connectMongoose } from "@/lib/mongoose";
import { InvoiceModel } from "@/models/Invoice";
import { logErrorLater } from "@/observability/error-log";
import { syncInvoiceTracker } from "@/orders/services/invoiceService";
import { syncSnpVendorsOrders, syncSnpVendorsVariants } from "@/snapp";
import { TrackerModel } from "@/tracking";
import { reconcileStockDiscrepancies, syncServiceStock } from "./service-stock";

export { default as syncLockStatus } from "./model/sync";
export { syncServicePrice, syncServiceStock } from "./service-stock";

function getSyncErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "sync_failed";
}

async function runSettledSyncTasks(source: string, tasks: Array<Promise<unknown>>) {
    const results = await Promise.allSettled(tasks);
    const failed = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");

    failed.forEach((result) => {
        logErrorLater({
            category: "sync",
            source,
            error: result.reason,
            metadata: { message: getSyncErrorMessage(result.reason) },
        });
    });

    if (failed.length === results.length && results.length > 0) {
        throw new Error(`${source}_all_services_failed`);
    }
}

export async function syncServicesVariants() {
    await runSettledSyncTasks("sync.variants.services", [
        syncDgkVendorsVariants(),
        syncBslVendorsVariants(),
        syncSnpVendorsVariants()
    ])
}


export async function syncServicesOrders() {
    await runSettledSyncTasks("sync.orders.services", [
        syncDgkVendorsOrders(),
        syncBslVendorsOrders(),
        syncSnpVendorsOrders()
    ])

    try {

        const invoices = await InvoiceModel.find({ 'progress.current': 'order-finished' });

        for (let index = 0; index < invoices.length; index++) {
            const invoice = invoices[index];
            const exists = await TrackerModel.findOne({ orderId: invoice.number });

            if (exists) continue;

            await syncInvoiceTracker(invoice);
        }
    }
    catch (err) {
        logErrorLater({
            category: "sync",
            source: "sync.orders.tracker",
            error: err,
        });

    }
}

export async function syncInventoryBackToServices(updated_at_from?: Date) {
    await connectMongoose();

    const { data } = await searchVariantsWithDisplayName("", 1, 1e3, updated_at_from || new Date(Date.now() - (1e3 * 60 * 60)));

    const variants = data.map(x => ({ barcode: x.barcode, stock: x.inventory.quantity })).filter(x => !!x.barcode);

    const pushed = variants.length
        ? await syncServiceStock(variants)
        : { attempted: 0, succeeded: 0, failed: 0, errors: [] as string[] };

    // Reconcile standing discrepancies that fall outside the recent-update window
    // (drift from orders, earlier failed pushes, marketplace-side edits). The job
    // now heartbeats its lock, so a longer reconcile run can't be falsely requeued
    // — push more per run for faster convergence on the powerful host.
    let reconciled = { attempted: 0, succeeded: 0, failed: 0, errors: [] as string[] };
    try {
        reconciled = await reconcileStockDiscrepancies(250);
    } catch (err) {
        logErrorLater({ category: "sync", source: "sync.stock.reconcile", error: err });
    }

    return { pushedVariants: variants.length, pushed, reconciled };
}
