import { NextRequest, NextResponse } from "next/server";

import {
    createHolooProduct,
    listHolooProducts,
    updateHolooProduct,
} from "@/holoo";
import { holooErrorResponse } from "@/holoo/http";
import { jsonError } from "@/lib/http";
import type { HolooProductListParams } from "@/holoo";

export const runtime = "nodejs";

const LIST_KEYS: (keyof HolooProductListParams)[] = [
    "code",
    "date.from",
    "date.to",
    "maingrouperpcode",
    "sidegrouperpcode",
    "getimage",
];

/**
 * GET /api/holoo/products — list goods (کالا), paginated.
 *
 * Holoo's /Product returns the whole (optionally group-filtered) list with no
 * paging, so we page in-memory: accept `page` (1-based) and `limit` (default 20)
 * and return `{ products, total, page, limit }` so the table can paginate.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const sp = req.nextUrl.searchParams;
    const params: Record<string, string> = {};
    for (const key of LIST_KEYS) {
        const value = sp.get(key);
        if (value !== null && value !== "") params[key] = value;
    }

    const page = Math.max(1, Number(sp.get("page")) || 1);
    const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 20));

    try {
        const all = await listHolooProducts(params as HolooProductListParams);
        const total = all.length;
        const start = (page - 1) * limit;
        const products = all.slice(start, start + limit);
        return NextResponse.json({ products, total, page, limit });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}

/** POST /api/holoo/products — create a product under a side group. */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }
    if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
        return jsonError(400, "نام کالا الزامی است");
    }
    if (!body?.sidegrouperpcode || typeof body.sidegrouperpcode !== "string") {
        return jsonError(400, "sidegrouperpcode (گروه فرعی) الزامی است");
    }
    try {
        const result = await createHolooProduct(body);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}

/** PUT /api/holoo/products — update an existing product by ErpCode. */
export async function PUT(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }
    if (!body?.erpcode || typeof body.erpcode !== "string") {
        return jsonError(400, "erpcode کالا الزامی است");
    }
    try {
        const result = await updateHolooProduct(body);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}
