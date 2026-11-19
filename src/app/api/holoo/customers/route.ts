import { NextRequest, NextResponse } from "next/server";

import {
    createHolooCustomer,
    listHolooCustomers,
    updateHolooCustomer,
} from "@/holoo";
import { holooErrorResponse } from "@/holoo/http";
import { jsonError } from "@/lib/http";
import type { HolooCustomerListParams } from "@/holoo";

export const runtime = "nodejs";

const LIST_KEYS: (keyof HolooCustomerListParams)[] = [
    "code",
    "code.from",
    "code.to",
    "purchaser",
    "seller",
    "vaseteh",
    "date.from",
    "date.to",
];

/** GET /api/holoo/customers — list accounts (طرف حساب). */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const sp = req.nextUrl.searchParams;
    const params: Record<string, string> = {};
    for (const key of LIST_KEYS) {
        const value = sp.get(key);
        if (value !== null && value !== "") params[key] = value;
    }
    try {
        const customers = await listHolooCustomers(params as HolooCustomerListParams);
        return NextResponse.json({ customers });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}

/** POST /api/holoo/customers — create an account. */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }
    if (!body?.name || typeof body.name !== "string" || !body.name.trim()) {
        return jsonError(400, "نام طرف حساب الزامی است");
    }
    try {
        const result = await createHolooCustomer({
            ...body,
            ispurchaser: body.ispurchaser ?? true,
            isseller: body.isseller ?? false,
            custtype: body.custtype === 1 ? 1 : 0,
        });
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}

/** PUT /api/holoo/customers — update an existing account by ErpCode. */
export async function PUT(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }
    if (!body?.erpcode || typeof body.erpcode !== "string") {
        return jsonError(400, "erpcode طرف حساب الزامی است");
    }
    try {
        const result = await updateHolooCustomer(body);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}
