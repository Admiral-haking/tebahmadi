import { NextRequest, NextResponse } from "next/server";

import { HttpError, requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { getMarkerIdempotencyReport } from "@/holoo/services/marker-idempotency";

export const runtime = "nodejs";

function toLimit(value: string | null): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 500) : 50;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        await requirePermission(req, "holoo:read");
        await connectMongoose();
        const report = await getMarkerIdempotencyReport(toLimit(req.nextUrl.searchParams.get("limit")));
        return NextResponse.json(report);
    } catch (error) {
        if (error instanceof HttpError) return jsonError(error.status, error.message);
        logErrorLater({
            category: "system",
            source: "holoo.marker-idempotency",
            error,
            route: req.nextUrl.pathname,
            method: req.method,
        });
        return jsonError(500, "دریافت گزارش یکتایی نشان‌های هلو ناموفق بود.");
    }
}
