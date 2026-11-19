import { bslGetOrdersStats } from "@/basalaam/services/stats";
import { connectMongoose } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** GET /api/basalaam/stats?vendorId=...  → order counts per status. */
export async function GET(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    const vendorId = new URL(req.url).searchParams.get("vendorId");
    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });
    try {
        const res = await bslGetOrdersStats(vendorId);
        return NextResponse.json(res);
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || "خطا در دریافت آمار سفارش‌های باسلام" }, { status: err?.status || 400 });
    }
}
