import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { InvoiceModel } from "@/orders/models/Invoice";
import ServiceInfoModel from "@/settings/models/serviceInfo";
import { TrackerModel } from "@/tracking";

import { HOLOO_CONNECTION_ID } from "../constants/config";
import {
    isHolooAutoSyncEnabled,
    syncInvoiceToHoloo,
    syncReturnToHoloo,
    syncTrackerToHoloo,
    syncTrackerReturnToHoloo,
} from "./sync-invoice";

/**
 * Background catch-up sweep that pushes still-unsynced documents to Holoo a few
 * at a time, so "everything transfers automatically" without a storm.
 *
 * Design constraints that keep it safe:
 *  - OFF by default. Enable per deployment with HOLOO_AUTO_SWEEP=1 (and the
 *    worker-only DISABLE_BACKGROUND_JOBS guard, like the invoice sweep).
 *  - Bounded: at most BATCH invoices + BATCH trackers per run.
 *  - Idempotent: relies on the existing dedup markers (`invoice:<n>` /
 *    `tracker:<service>:<orderId>`); already-synced docs are skipped.
 *  - Error-isolated: one failure never aborts the rest.
 */

const SWEEP_INTERVAL_MS = 2 * 60 * 1000; // every 2 minutes
const BATCH = 8;                          // per type, per run
const SCAN_WINDOW = 120;                  // how many recent docs to inspect

type SchedulerState = typeof globalThis & { __holooAutoSweepInterval?: ReturnType<typeof setInterval> };
const schedulerState = globalThis as SchedulerState;

/** Marker ids that already exist among the given candidate ids. */
async function existingMarkers(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const rows = await ServiceInfoModel.find(
        { service: "holoo", vendorId: HOLOO_CONNECTION_ID, id: { $in: ids } },
        { id: 1 },
    ).lean();
    return new Set(rows.map((r) => String((r as { id?: string }).id)));
}

/** Sync up to BATCH recent paid site invoices that have no Holoo marker yet. */
async function sweepSiteInvoices(): Promise<{ attempted: number; ok: number }> {
    const paid = await InvoiceModel.find({ status: "paid" })
        .sort({ createdAt: -1 })
        .limit(SCAN_WINDOW)
        .select("_id number")
        .lean();

    const have = await existingMarkers(paid.map((p) => `invoice:${(p as { number?: string }).number}`));
    const todo = paid
        .filter((p) => !have.has(`invoice:${(p as { number?: string }).number}`))
        .slice(0, BATCH);

    let ok = 0;
    for (const inv of todo) {
        try {
            const res = await syncInvoiceToHoloo(String((inv as { _id: unknown })._id));
            if (res.ok) ok++;
        } catch {
            /* error-isolated; logged inside the sync fn */
        }
    }
    return { attempted: todo.length, ok };
}

/** Sync up to BATCH recent marketplace trackers that have no Holoo marker yet. */
async function sweepTrackers(): Promise<{ attempted: number; ok: number }> {
    const trackers = await TrackerModel.find({ serviceId: { $in: ["dgk", "basalaam", "snapp"] } })
        .sort({ _id: -1 })
        .limit(SCAN_WINDOW)
        .select("_id serviceId orderId")
        .lean();

    const idOf = (t: { serviceId?: string; orderId?: string; _id?: unknown }) =>
        `tracker:${t.serviceId}:${String(t.orderId || t._id)}`;
    const have = await existingMarkers(trackers.map((t) => idOf(t as never)));
    const todo = trackers
        .filter((t) => !have.has(idOf(t as never)))
        .slice(0, BATCH);

    let ok = 0;
    for (const t of todo) {
        try {
            const res = await syncTrackerToHoloo(String((t as { _id: unknown })._id));
            if (res.ok) ok++;
        } catch {
            /* error-isolated */
        }
    }
    return { attempted: todo.length, ok };
}

/** Post returns for canceled/refunded SITE invoices not yet reversed in Holoo. */
async function sweepSiteReturns(): Promise<{ attempted: number; ok: number }> {
    const canceled = await InvoiceModel.find({ status: { $in: ["canceled", "refunded"] } })
        .sort({ updatedAt: -1 })
        .limit(SCAN_WINDOW)
        .select("_id number")
        .lean();

    const have = await existingMarkers(canceled.map((p) => `return:${(p as { number?: string }).number}`));
    const todo = canceled
        .filter((p) => !have.has(`return:${(p as { number?: string }).number}`))
        .slice(0, BATCH);

    let ok = 0;
    for (const inv of todo) {
        try {
            // syncReturnToHoloo self-guards: skips with no_prior_sale unless the
            // sale actually reached Holoo, so a missing return marker is fine.
            const res = await syncReturnToHoloo(String((inv as { _id: unknown })._id));
            if (res.ok) ok++;
        } catch { /* error-isolated */ }
    }
    return { attempted: todo.length, ok };
}

/** Post returns for canceled/refunded MARKETPLACE orders not yet reversed. */
async function sweepTrackerReturns(): Promise<{ attempted: number; ok: number }> {
    const canceled = await TrackerModel.find({
        serviceId: { $in: ["dgk", "basalaam", "snapp"] },
        orderStatus: { $in: ["canceled", "cancelled", "refunded", "returned", "CANCELED", "REFUNDED"] },
    })
        .sort({ _id: -1 })
        .limit(SCAN_WINDOW)
        .select("_id serviceId orderId")
        .lean();

    const idOf = (t: { serviceId?: string; orderId?: string; _id?: unknown }) =>
        `tracker-return:${t.serviceId}:${String(t.orderId || t._id)}`;
    const have = await existingMarkers(canceled.map((t) => idOf(t as never)));
    const todo = canceled.filter((t) => !have.has(idOf(t as never))).slice(0, BATCH);

    let ok = 0;
    for (const t of todo) {
        try {
            const res = await syncTrackerReturnToHoloo(String((t as { _id: unknown })._id));
            if (res.ok) ok++;
        } catch { /* error-isolated */ }
    }
    return { attempted: todo.length, ok };
}

let sweepRunning = false;

export async function runHolooAutoSyncSweep(): Promise<void> {
    if (!isHolooAutoSyncEnabled()) return;
    if (sweepRunning) return; // never overlap runs
    sweepRunning = true;
    try {
        await connectMongoose();
        const inv = await sweepSiteInvoices();
        const trk = await sweepTrackers();
        const invRet = await sweepSiteReturns();
        const trkRet = await sweepTrackerReturns();
        if (inv.attempted || trk.attempted || invRet.attempted || trkRet.attempted) {
            logErrorLater({
                level: "info",
                category: "system",
                source: "holoo.auto-sweep",
                message: "holoo_auto_sweep_run",
                metadata: { invoices: inv, trackers: trk, invoiceReturns: invRet, trackerReturns: trkRet },
            });
        }
    } finally {
        sweepRunning = false;
    }
}

/** Start the recurring sweep (worker instance only, opt-in via env). */
export function ensureHolooAutoSyncScheduler(): void {
    if (typeof window !== "undefined") return;
    if (process.env.DISABLE_BACKGROUND_JOBS === "1") return;
    if (process.env.HOLOO_AUTO_SWEEP !== "1") return; // OFF unless explicitly enabled
    if (schedulerState.__holooAutoSweepInterval) return;

    schedulerState.__holooAutoSweepInterval = setInterval(() => {
        runHolooAutoSyncSweep().catch((error) => {
            console.error("Holoo auto-sync sweep failed", error);
        });
    }, SWEEP_INTERVAL_MS);
    if (typeof schedulerState.__holooAutoSweepInterval.unref === "function") {
        schedulerState.__holooAutoSweepInterval.unref();
    }
}

// Start on module load (no-op unless HOLOO_AUTO_SWEEP=1).
ensureHolooAutoSyncScheduler();
