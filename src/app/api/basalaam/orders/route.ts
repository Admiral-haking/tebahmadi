import { bslOrders } from "@/basalaam/services/orders";
import { connectMongoose } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    const url = new URL(req.url);
    const vendorId = url.searchParams.get('vendorId');
    const next_cursor = url.searchParams.get('next_cursor') ?? undefined;

    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });

    try {
        const data = await bslOrders(vendorId, next_cursor);
        return NextResponse.json(data);
    } catch (err: any) {
        const status = err?.status || err?.code === "BSL_TOKEN_NOT_FOUND" ? 401 : 500;
        return NextResponse.json(
            { error: err?.message || "خطا در بارگیری سفارشات باسلام" },
            { status }
        );
    }
}
