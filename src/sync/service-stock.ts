import { PipelineStage } from "mongoose";

import { bslVariantPriceUpdate, bslVariantUpdate } from "@/basalaam/services/updateVarinat";
import BslVariantModel from "@/basalaam/models/variants";
import ProductModel from "@/catalog/models/Product";
import { getDgkPriceUpdate } from "@/digikala/services/price-update";
import { getDgkVariantUpdate } from "@/digikala/services/veriant-update";
import DgkVariantModel from "@/digikala/models/variants";
import { connectMongoose } from "@/lib/mongoose";
import { getVendors } from "@/settings/services/vendorService";
import { snpSyncPrice, snpSyncStock } from "@/snapp/services/sync-stock";
import SnapVariantModel from "@/snapp/models/variants";
import { mapConcurrent, PUSH_CONCURRENCY } from "./concurrency";
import { MARKETPLACE_INTEGRATIONS_ENABLED } from "@/config/admin-features";

export type SyncStockProps = {
    barcode: string
    stock: number
}[]

export type SyncPriceProps = {
    barcode: string
    price: number
}[]

export type SyncServiceSummary = {
    attempted: number;
    succeeded: number;
    failed: number;
    errors: string[];
}

const DISABLED_SYNC_SUMMARY: SyncServiceSummary = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
};

function normalizeStockPayload(variants: SyncStockProps): SyncStockProps {
    return variants
        .map(({ barcode, stock }) => ({ barcode: barcode?.trim(), stock: Math.max(Number(stock) || 0, 0) }))
        .filter((variant) => !!variant.barcode);
}

function normalizePricePayload(variants: SyncPriceProps): SyncPriceProps {
    return variants
        .map(({ barcode, price }) => ({ barcode: barcode?.trim(), price: Math.max(Number(price) || 0, 0) }))
        .filter((variant) => !!variant.barcode);
}

function getSettledError(reason: unknown) {
    if (reason instanceof Error) return reason.message;
    if (typeof reason === "string") return reason;
    return "sync_request_failed";
}

async function settleSyncTasks(tasks: Promise<unknown>[]): Promise<SyncServiceSummary> {
    if (!tasks.length) return { attempted: 0, succeeded: 0, failed: 0, errors: [] };
    return summarizeSettled(await Promise.allSettled(tasks));
}

function summarizeSettled(results: PromiseSettledResult<unknown>[]): SyncServiceSummary {
    const errors = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => getSettledError(result.reason));
    return {
        attempted: results.length,
        succeeded: results.length - errors.length,
        failed: errors.length,
        errors: Array.from(new Set(errors)).slice(0, 8),
    };
}

function mergeSummaries(list: SyncServiceSummary[]): SyncServiceSummary {
    return list.reduce<SyncServiceSummary>(
        (acc, s) => ({
            attempted: acc.attempted + s.attempted,
            succeeded: acc.succeeded + s.succeeded,
            failed: acc.failed + s.failed,
            errors: Array.from(new Set([...acc.errors, ...s.errors])).slice(0, 8),
        }),
        { attempted: 0, succeeded: 0, failed: 0, errors: [] },
    );
}

/** One vendor's bounded per-variant push run, summarized. */
async function runVendorPush<T>(items: T[], fn: (item: T) => Promise<unknown>): Promise<SyncServiceSummary> {
    return summarizeSettled(await mapConcurrent(items, PUSH_CONCURRENCY, fn));
}

/** Wrap a single-call vendor push (e.g. Snapp's batch endpoint) as a summary. */
async function runSingleCall(call: Promise<unknown>): Promise<SyncServiceSummary> {
    try {
        await call;
        return { attempted: 1, succeeded: 1, failed: 0, errors: [] };
    } catch (error) {
        return { attempted: 1, succeeded: 0, failed: 1, errors: [getSettledError(error)] };
    }
}

export async function syncServiceStock(variants: SyncStockProps): Promise<SyncServiceSummary> {
    if (!MARKETPLACE_INTEGRATIONS_ENABLED) return DISABLED_SYNC_SUMMARY;
    await connectMongoose();

    const payload = normalizeStockPayload(variants);
    if (!payload.length) return { attempted: 0, succeeded: 0, failed: 0, errors: [] };

    const [dgkVendors, bslVendors, snpVendors] = await Promise.all([
        getVendors("dgk"),
        getVendors("basalaam"),
        getVendors("snapp"),
    ]);

    // Vendors run in parallel (independent rate limits); within each vendor the
    // per-variant pushes are bounded so one account isn't hammered into 429s.
    const summary = mergeSummaries(
        await Promise.all([
            ...dgkVendors.map((vendorId) => runVendorPush(payload, ({ barcode, stock }) => getDgkVariantUpdate(vendorId, barcode, stock))),
            ...bslVendors.map((vendorId) => runVendorPush(payload, ({ barcode, stock }) => bslVariantUpdate(vendorId, barcode, stock))),
            ...snpVendors.map((vendorId) => runSingleCall(snpSyncStock(vendorId, payload.map(({ barcode, stock }) => ({ sku: barcode, stock }))))),
        ]),
    );

    return summary;
}

export async function syncServicePrice(variants: SyncPriceProps): Promise<SyncServiceSummary> {
    if (!MARKETPLACE_INTEGRATIONS_ENABLED) return DISABLED_SYNC_SUMMARY;
    await connectMongoose();

    const payload = normalizePricePayload(variants);
    if (!payload.length) return { attempted: 0, succeeded: 0, failed: 0, errors: [] };

    const [dgkVendors, bslVendors, snpVendors] = await Promise.all([
        getVendors("dgk"),
        getVendors("basalaam"),
        getVendors("snapp"),
    ]);

    return mergeSummaries(
        await Promise.all([
            ...dgkVendors.map((vendorId) => runVendorPush(payload, ({ barcode, price }) => getDgkPriceUpdate(vendorId, barcode, price))),
            ...bslVendors.map((vendorId) => runVendorPush(payload, ({ barcode, price }) => bslVariantPriceUpdate(vendorId, barcode, price))),
            ...snpVendors.map((vendorId) => runSingleCall(snpSyncPrice(vendorId, payload.map(({ barcode, price }) => ({ sku: barcode, price }))))),
        ]),
    );
}

/**
 * Find linked variants whose marketplace cached quantity differs from the site
 * stock. The periodic back-sync only pushes recently-updated variants, so any
 * drift (orders, earlier failed pushes, marketplace-side edits) lingers as a
 * permanent discrepancy. This surfaces those so they can be reconciled.
 */
export async function findStockDiscrepancies(limit = 200): Promise<SyncStockProps> {
    if (!MARKETPLACE_INTEGRATIONS_ENABLED) return [];
    await connectMongoose();

    const rows = await ProductModel.aggregate([
        { $match: { "variants.0": { $exists: true } } },
        { $unwind: "$variants" },
        {
            $addFields: {
                siteStock: { $ifNull: ["$variants.inventory.quantity", 0] },
                barcodeText: { $ifNull: ["$variants.barcode", ""] },
            },
        },
        { $match: { barcodeText: { $ne: "" } } },
        // Match marketplace records on variantId OR barcode. A bare variantId join
        // silently drops every record whose variantId went stale after a catalog
        // re-import, so those variants were never seen as out-of-sync and never
        // reconciled. barcode is the stable key the push itself uses.
        ...(["dgkvariants", "bslvariants", "snpvariants"] as const).map((from, i) => ({
            $lookup: {
                from,
                let: { vid: "$variants._id", bc: "$barcodeText" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $or: [
                                    { $eq: ["$variantId", "$$vid"] },
                                    { $eq: ["$barcode", "$$bc"] },
                                ],
                            },
                        },
                    },
                ],
                as: ["dgk", "bsl", "snp"][i],
            },
        }) as PipelineStage.Lookup),
        {
            $addFields: {
                serviceCount: { $add: [{ $size: "$dgk" }, { $size: "$bsl" }, { $size: "$snp" }] },
                hasMismatch: {
                    $or: [
                        { $anyElementTrue: { $map: { input: "$dgk", as: "s", in: { $ne: ["$$s.quantity", "$siteStock"] } } } },
                        { $anyElementTrue: { $map: { input: "$bsl", as: "s", in: { $ne: ["$$s.quantity", "$siteStock"] } } } },
                        { $anyElementTrue: { $map: { input: "$snp", as: "s", in: { $ne: ["$$s.quantity", "$siteStock"] } } } },
                    ],
                },
            },
        },
        { $match: { serviceCount: { $gt: 0 }, hasMismatch: true } },
        { $project: { _id: 0, barcode: "$barcodeText", stock: "$siteStock" } },
        { $limit: Math.max(1, limit) },
    ]);

    return rows.map((row) => ({ barcode: String(row.barcode), stock: Number(row.stock) || 0 }));
}

/**
 * Push the correct site stock to every marketplace for variants that are
 * currently out of sync. Self-limiting: each successful push updates the local
 * cached quantity, so the discrepancy set shrinks toward zero over runs.
 */
export async function reconcileStockDiscrepancies(limit = 200): Promise<SyncServiceSummary> {
    const payload = await findStockDiscrepancies(limit);
    if (!payload.length) return { attempted: 0, succeeded: 0, failed: 0, errors: [] };
    return syncServiceStock(payload);
}

/**
 * Push price/stock to exactly the marketplace records LINKED to this variant —
 * resolved by variantId OR the site barcode — using each record's OWN vendorId
 * and barcode. A bare site-barcode fan-out (syncServiceStock) misses records
 * linked by variantId whose barcode drifted from the site after a re-import, so
 * their stock never updates. This targets the real linked rows instead.
 */
export async function syncLinkedVariantToServices(
    variantId: unknown,
    siteBarcode: string | undefined,
    payload: { stock?: number; price?: number },
): Promise<SyncServiceSummary> {
    if (!MARKETPLACE_INTEGRATIONS_ENABLED) return DISABLED_SYNC_SUMMARY;
    const stock = payload.stock === undefined ? undefined : Math.max(0, Number(payload.stock) || 0);
    const price = payload.price === undefined ? undefined : Math.max(0, Number(payload.price) || 0);
    if (stock === undefined && price === undefined) {
        return { attempted: 0, succeeded: 0, failed: 0, errors: [] };
    }

    await connectMongoose();

    const trimmedBarcode = siteBarcode?.trim();
    const or: Record<string, unknown>[] = [];
    if (variantId) or.push({ variantId });
    if (trimmedBarcode) or.push({ barcode: trimmedBarcode });
    if (!or.length) return { attempted: 0, succeeded: 0, failed: 0, errors: [] };

    const projection = { vendorId: 1, barcode: 1 } as const;
    const [dgk, bsl, snp] = await Promise.all([
        DgkVariantModel.find({ $or: or }, projection).lean(),
        BslVariantModel.find({ $or: or }, projection).lean(),
        SnapVariantModel.find({ $or: or }, projection).lean(),
    ]);

    const tasks: Promise<unknown>[] = [];
    for (const r of dgk) {
        const bc = String(r.barcode || "").trim();
        if (!r.vendorId || !bc) continue;
        if (stock !== undefined) tasks.push(getDgkVariantUpdate(r.vendorId, bc, stock));
        if (price !== undefined) tasks.push(getDgkPriceUpdate(r.vendorId, bc, price));
    }
    for (const r of bsl) {
        const bc = String(r.barcode || "").trim();
        if (!r.vendorId || !bc) continue;
        if (stock !== undefined) tasks.push(bslVariantUpdate(r.vendorId, bc, stock));
        if (price !== undefined) tasks.push(bslVariantPriceUpdate(r.vendorId, bc, price));
    }
    for (const r of snp) {
        const bc = String(r.barcode || "").trim();
        if (!r.vendorId || !bc) continue;
        if (stock !== undefined) tasks.push(snpSyncStock(r.vendorId, [{ sku: bc, stock }]));
        if (price !== undefined) tasks.push(snpSyncPrice(r.vendorId, [{ sku: bc, price }]));
    }

    return settleSyncTasks(tasks);
}

export async function syncVariantStockById(variantId: unknown) {
    if (!MARKETPLACE_INTEGRATIONS_ENABLED || !variantId) return;

    const product = await ProductModel.findOne({ "variants._id": variantId }, { variants: 1 }).lean();
    const variant = product?.variants?.find((item) => `${item._id}` === `${variantId}`);
    if (!variant) return;

    await syncLinkedVariantToServices(variantId, variant.barcode, { stock: variant.inventory?.quantity ?? 0 });
}
