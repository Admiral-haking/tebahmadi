import { bslOrderDetails } from "@/basalaam/services/order-details";
import { connectMongoose } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ order_id: string }> };

export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    await connectMongoose();

    const { order_id } = await context.params;
    const url = new URL(req.url);
    const vendorId = url.searchParams.get('vendorId');

    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });

    try {
        const res = await bslOrderDetails(vendorId, Number(order_id));
        return NextResponse.json(res);
    } catch (err: any) {
        const status = err?.code === "BSL_TOKEN_NOT_FOUND" ? 401 : 500;
        return NextResponse.json(
            { error: err?.message || "خطا در بارگیری جزئیات سفارش" },
            { status }
        );
    }
}
