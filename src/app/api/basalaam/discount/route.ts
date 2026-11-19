import { bslCreateDiscount, bslDeleteDiscount } from "@/basalaam/services/discount";
import { connectMongoose } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** POST /api/basalaam/discount  { vendorId, product_ids, discount_percent, active_from?, active_to? } */
export async function POST(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    const body = await req.json().catch(() => ({}));
    const { vendorId, product_ids, discount_percent, active_from, active_to } = body ?? {};
    if (!vendorId || !Array.isArray(product_ids) || !product_ids.length || !discount_percent) {
        return NextResponse.json({ error: "vendorId, product_ids, discount_percent لازم است" }, { status: 400 });
    }
    try {
        const res = await bslCreateDiscount(vendorId, { product_ids, discount_percent, active_from, active_to });
        return NextResponse.json(res);
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || "خطا در ایجاد تخفیف باسلام" }, { status: err?.status || 400 });
    }
}

/** DELETE /api/basalaam/discount  { vendorId, product_ids } */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    const body = await req.json().catch(() => ({}));
    const { vendorId, product_ids } = body ?? {};
    if (!vendorId || !Array.isArray(product_ids) || !product_ids.length) {
        return NextResponse.json({ error: "vendorId, product_ids لازم است" }, { status: 400 });
    }
    try {
        const res = await bslDeleteDiscount(vendorId, product_ids);
        return NextResponse.json(res);
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || "خطا در حذف تخفیف باسلام" }, { status: err?.status || 400 });
    }
}
