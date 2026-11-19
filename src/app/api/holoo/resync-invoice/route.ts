import { NextRequest, NextResponse } from "next/server";

import { resyncInvoiceToHoloo } from "@/holoo";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * POST /api/holoo/resync-invoice — correct an invoice already posted to Holoo.
 *
 * Holoo documents are append-only, so this reverses the previously-posted sale
 * with a return invoice (Type=2) and posts a fresh sale carrying the invoice's
 * current amounts. Use after fixing prices/amounts on a synced order.
 *
 * Always 200: the body carries { ok, skipped, detail } so the UI can show a
 * precise reason instead of a bare error status.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }
    const invoiceId = typeof body?.invoiceId === "string" ? body.invoiceId.trim() : "";
    if (!invoiceId) return jsonError(400, "invoiceId الزامی است");

    const result = await resyncInvoiceToHoloo(invoiceId);
    return NextResponse.json(result);
}
