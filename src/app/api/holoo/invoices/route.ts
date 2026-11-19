import { NextRequest, NextResponse } from "next/server";

import { createHolooInvoice, listHolooInvoices } from "@/holoo";
import { holooErrorResponse } from "@/holoo/http";
import { jsonError } from "@/lib/http";
import type { HolooInvoiceListParams, HolooInvoiceType } from "@/holoo";

export const runtime = "nodejs";

const LIST_KEYS: (keyof HolooInvoiceListParams)[] = [
    "Code",
    "code.from",
    "code.to",
    "Type",
    "Sanadcode",
    "date.from",
    "date.to",
];

/** GET /api/holoo/invoices — list invoices (گزارش فاکتورها). */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const sp = req.nextUrl.searchParams;
    const params: Record<string, string> = {};
    for (const key of LIST_KEYS) {
        const value = sp.get(key);
        if (value !== null && value !== "") params[key] = value;
    }
    try {
        const invoices = await listHolooInvoices(params as HolooInvoiceListParams);
        return NextResponse.json({ invoices });
    } catch (error) {
        // Some Holoo builds don't expose the invoice-list GET endpoint (404).
        // Degrade gracefully instead of surfacing a hard error.
        if ((error as { status?: number })?.status === 404) {
            return NextResponse.json({
                invoices: [],
                unavailable: true,
                note: "این نسخه‌ی وب‌سرویس هلو، گزارش لیست فاکتورها را ارائه نمی‌دهد. برای وضعیت ثبت، از تب «فاکتورهای فروشگاه» استفاده کنید.",
            });
        }
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}

/** POST /api/holoo/invoices — create an invoice (فروش/خرید/برگشتی). */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }
    if (!body?.id) return jsonError(400, "شناسه (id) فاکتور الزامی است");
    if (![1, 2, 3, 4].includes(Number(body?.Type))) {
        return jsonError(400, "نوع فاکتور (Type) باید 1، 2، 3 یا 4 باشد");
    }
    if (!body?.customererpcode) return jsonError(400, "customererpcode (طرف حساب) الزامی است");
    if (!body?.date || !body?.time) return jsonError(400, "تاریخ و ساعت فاکتور الزامی است");
    if (!Array.isArray(body?.detailinfo) || body.detailinfo.length === 0) {
        return jsonError(400, "حداقل یک قلم کالا (detailinfo) لازم است");
    }
    try {
        const result = await createHolooInvoice({
            ...body,
            Type: Number(body.Type) as HolooInvoiceType,
        });
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}
