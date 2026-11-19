import { NextRequest, NextResponse } from "next/server";

import { syncReturnToHoloo } from "@/holoo";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * POST /api/holoo/sync-return — manually (re)post a canceled/refunded site
 * invoice to Holoo as a return-from-sale invoice (Type=2), reversing the
 * original sale on the same طرف‌حساب.
 *
 * Always 200: the body carries { ok, skipped, detail } so the UI can show a
 * precise reason instead of a bare error.
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

    const result = await syncReturnToHoloo(invoiceId);
    return NextResponse.json(result);
}
