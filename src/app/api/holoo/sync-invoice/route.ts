import { NextRequest, NextResponse } from "next/server";

import { syncInvoiceToHoloo } from "@/holoo";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * POST /api/holoo/sync-invoice — manually (re)post a paid invoice to Holoo.
 * Useful for retrying invoices that failed auto-sync (e.g. unmapped products).
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

    // Always 200: the body carries { ok, skipped, detail } so the UI can show a
    // precise reason (e.g. unmapped products) instead of a bare 409.
    const result = await syncInvoiceToHoloo(invoiceId);
    return NextResponse.json(result);
}
