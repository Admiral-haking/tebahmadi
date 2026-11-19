import { NextRequest, NextResponse } from "next/server";

import { syncTrackerToHoloo } from "@/holoo";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * POST /api/holoo/sync-tracker — manually (re)post a marketplace order (tracker)
 * to Holoo as a sales invoice, routed to that platform+panel's طرف‌حساب.
 *
 * Always 200: the body carries { ok, skipped, detail } so the UI can show a
 * precise reason (e.g. unmapped products) instead of a bare error.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }
    const trackerId = typeof body?.trackerId === "string" ? body.trackerId.trim() : "";
    if (!trackerId) return jsonError(400, "trackerId الزامی است");

    const result = await syncTrackerToHoloo(trackerId);
    return NextResponse.json(result);
}
