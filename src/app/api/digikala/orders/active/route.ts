import { dgkApiRoutes } from "@/digikala/constants/routes";
import { getDgkToken } from "@/digikala/utils/token";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { Get } from "@/utils/fetch";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {

    await connectMongoose();

    const url = new URL(req.url);
    const vendorId = url.searchParams.get('vendorId');
    const pageParam = url.searchParams.get('page');

    const page = pageParam ? Number(pageParam) : 1
    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });

    try {
        const res = await Get(dgkApiRoutes.active_orders.concat(`?page=${page}&size=50&sort=order_created_at&order=desc`), {
            'Authorization': `Bearer ${await getDgkToken(vendorId)}`
        })

        const response = NextResponse.json(res);
        response.headers.set("Cache-Control", "private, max-age=20, stale-while-revalidate=40");
        return response;
    } catch (error) {
        logErrorLater({
            category: "marketplace",
            source: "digikala.orders.active",
            error,
            statusCode: 502,
            route: req.nextUrl.pathname,
            method: req.method,
            metadata: { vendorId, page },
        });
        return jsonError(502, "Digikala active orders could not be loaded");
    }
}
