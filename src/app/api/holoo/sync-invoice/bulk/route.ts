import { NextRequest, NextResponse } from "next/server";

import { syncInvoiceToHoloo } from "@/holoo";
import { HOLOO_CONNECTION_ID } from "@/holoo/constants/config";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { InvoiceModel } from "@/orders/models/Invoice";
import ServiceInfoModel from "@/settings/models/serviceInfo";

export const runtime = "nodejs";

const MAX_BATCH = 25;

/**
 * POST /api/holoo/sync-invoice/bulk — backfill several paid invoices to Holoo in
 * one request. Either pass explicit { invoiceIds: [...] }, or omit them to let
 * the server pick the oldest not-yet-synced paid invoices (bounded by MAX_BATCH
 * to stay under the HTTP timeout). Returns a per-invoice result summary.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    let body: { invoiceIds?: unknown } = {};
    try {
        body = await req.json();
    } catch {
        /* body optional */
    }

    let ids: string[] = Array.isArray(body?.invoiceIds)
        ? (body.invoiceIds as unknown[]).map((x) => String(x)).filter(Boolean).slice(0, MAX_BATCH)
        : [];

    // No explicit ids → auto-select oldest paid invoices without a Holoo marker.
    if (!ids.length) {
        const markers = await ServiceInfoModel.find(
            { service: "holoo", id: { $regex: "^invoice:" }, vendorId: HOLOO_CONNECTION_ID },
            { id: 1 },
        ).lean();
        const syncedNumbers = markers.map((m) => String((m as { id?: string }).id ?? "").replace(/^invoice:/, ""));
        // Newest-first: recent invoices reference current products and sync
        // cleanly, so the user sees immediate progress instead of the run
        // stalling on very old invoices whose products were since deleted.
        const pending = await InvoiceModel.find({ status: "paid", number: { $nin: syncedNumbers } })
            .sort({ createdAt: -1 })
            .limit(MAX_BATCH)
            .select("_id")
            .lean();
        ids = pending.map((p) => String((p as { _id: unknown })._id));
    }

    if (!ids.length) return NextResponse.json({ ok: true, processed: 0, succeeded: 0, results: [], done: true });

    const results: Array<{ id: string; ok: boolean; erpcode?: string; skipped?: string }> = [];
    let succeeded = 0;
    for (const id of ids) {
        try {
            const r = await syncInvoiceToHoloo(id);
            if (r.ok) succeeded += 1;
            results.push({ id, ok: r.ok, erpcode: (r as { erpcode?: string }).erpcode, skipped: (r as { skipped?: string }).skipped });
        } catch (e) {
            results.push({ id, ok: false, skipped: (e as { message?: string })?.message || "error" });
        }
    }

    return NextResponse.json({ ok: true, processed: ids.length, succeeded, results });
}
