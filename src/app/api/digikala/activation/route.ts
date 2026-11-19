import { dgkOpenApiRequest } from "@/digikala/services/open-api";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * PATCH /api/digikala/activation — toggle one variant's activation on Digikala.
 *
 * Body: { vendorId, dgkVariantId, activation: boolean }
 * Proxies Digikala's `PUT variants/{variant_id}/activation`. Digikala's own HTTP
 * status (404 not-found, 403 scope, 429 rate-limit, 500 internal) is passed
 * through so the client can handle each case per the UX spec. Bulk activation is
 * driven client-side (concurrency-limited parallel PATCHes), so there is no
 * batch handler here.
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    let payload: { vendorId?: string; dgkVariantId?: number; activation?: boolean };
    try {
        payload = await req.json();
    } catch {
        return jsonError(400, "Invalid JSON body");
    }

    const vendorId = typeof payload.vendorId === "string" ? payload.vendorId.trim() : "";
    const dgkVariantId = Number(payload.dgkVariantId);
    const activation = Boolean(payload.activation);

    if (!vendorId) return jsonError(400, "vendorId is needed");
    if (!Number.isFinite(dgkVariantId) || dgkVariantId <= 0) {
        return jsonError(400, "dgkVariantId is needed");
    }

    try {
        const result = await dgkOpenApiRequest({
            vendorId,
            method: "PUT",
            path: ["variants", String(Math.floor(dgkVariantId)), "activation"],
            body: { activation },
        });
        return NextResponse.json({ ok: true, data: result.data });
    } catch (err: any) {
        const status = err?.status ?? 502;
        const message =
            status === 404 ? "واریانت در دیجی‌کالا یافت نشد"
            : status === 403 ? "دسترسی کافی برای تغییر وضعیت وجود ندارد"
            : status === 429 ? "محدودیت نرخ دیجی‌کالا — کمی بعد دوباره تلاش کنید"
            : status >= 500 ? "خطای داخلی دیجی‌کالا — بعداً دوباره تلاش کنید"
            : "تغییر وضعیت واریانت ناموفق بود";
        logErrorLater({
            category: "marketplace",
            source: "digikala.activation.update",
            error: err,
            statusCode: status,
            route: req.nextUrl.pathname,
            method: req.method,
            metadata: { vendorId, dgkVariantId, activation, status, data: err?.data },
        });
        return NextResponse.json({ error: message, status }, { status });
    }
}
