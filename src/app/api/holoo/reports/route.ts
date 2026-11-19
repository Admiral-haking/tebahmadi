import { NextRequest, NextResponse } from "next/server";

import { getHolooReport, holooRoutes } from "@/holoo";
import { holooErrorResponse } from "@/holoo/http";
import { jsonError } from "@/lib/http";
import type { HolooReportKey } from "@/holoo/constants/routes";

export const runtime = "nodejs";

const REPORT_KEYS = Object.keys(holooRoutes.report) as HolooReportKey[];

/**
 * GET /api/holoo/reports?type=<key> — pass-through to the Holoo Report/* methods.
 * Accepts the documented params: code, count, date.from, date.to.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") as HolooReportKey | null;

    if (!type || !REPORT_KEYS.includes(type)) {
        return jsonError(400, `پارامتر type باید یکی از این مقادیر باشد: ${REPORT_KEYS.join(", ")}`);
    }

    const params: Record<string, string | number> = {};
    const code = sp.get("code");
    const count = sp.get("count");
    const from = sp.get("date.from");
    const to = sp.get("date.to");
    if (code) params.code = code;
    if (count) params.count = Number(count);
    if (from) params["date.from"] = from;
    if (to) params["date.to"] = to;

    try {
        const data = await getHolooReport(type, params);
        return NextResponse.json({ type, data });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}
