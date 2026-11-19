import { bslSearchProducts, type BslSearchFilters } from "@/basalaam/services/search";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** GET /api/basalaam/search?q=...&minPrice=&maxPrice=&freeShipping=&minRating= */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    if (!q.trim()) return NextResponse.json({ error: "q لازم است" }, { status: 400 });

    const num = (k: string) => {
        const v = url.searchParams.get(k);
        return v != null && v !== "" ? Number(v) : undefined;
    };
    const filters: BslSearchFilters = {
        minPrice: num("minPrice"),
        maxPrice: num("maxPrice"),
        minRating: num("minRating"),
        freeShipping: num("freeShipping") === 1 ? 1 : undefined,
        vendorScore: num("vendorScore") === 1 ? 1 : undefined,
        sameCity: num("sameCity") === 1 ? 1 : undefined,
        slug: url.searchParams.get("slug") ?? undefined,
        vendorIdentifier: url.searchParams.get("vendorIdentifier") ?? undefined,
    };

    try {
        const res = await bslSearchProducts(q, filters);
        return NextResponse.json(res);
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || "خطا در جستجوی باسلام" }, { status: err?.status || 400 });
    }
}
