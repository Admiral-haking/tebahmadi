import { bslGetCategories, bslGetCategory, bslGetCategoryAttributes } from "@/basalaam/services/core";
import { connectMongoose } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/basalaam/categories?vendorId=...            → all categories
 * GET /api/basalaam/categories?vendorId=...&id=123     → one category
 * GET /api/basalaam/categories?vendorId=...&id=123&attributes=1 → its attributes
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    const url = new URL(req.url);
    const vendorId = url.searchParams.get("vendorId");
    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });

    const idParam = url.searchParams.get("id");
    const wantAttributes = url.searchParams.get("attributes");

    try {
        if (idParam && wantAttributes) {
            const res = await bslGetCategoryAttributes(vendorId, Number(idParam));
            return NextResponse.json(res);
        }
        if (idParam) {
            const res = await bslGetCategory(vendorId, Number(idParam));
            return NextResponse.json(res);
        }
        const res = await bslGetCategories(vendorId);
        return NextResponse.json(res);
    } catch (err: any) {
        return NextResponse.json(
            { error: err?.message || "خطا در دریافت دسته‌بندی‌های باسلام" },
            { status: err?.status || 400 },
        );
    }
}
