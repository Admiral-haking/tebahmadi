import { NextRequest, NextResponse } from "next/server";

import {
    createHolooInvoice,
    createHolooOrder,
    createHolooPreInvoice,
    getHolooOrderInfo,
    getHolooPreInvoiceInfo,
} from "@/holoo";
import { holooErrorResponse } from "@/holoo/http";
import { jsonError } from "@/lib/http";
import type { HolooInvoiceType } from "@/holoo";

export const runtime = "nodejs";

type Line = { id?: string; ProductErpCode: string; few: number; price: number; levy?: number; scot?: number; uniterpcode?: string };

function normalizeLines(raw: unknown): Line[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((l) => {
            const o = (l ?? {}) as Record<string, unknown>;
            return {
                id: o.id ? String(o.id) : undefined,
                ProductErpCode: String(o.ProductErpCode ?? o.productErpCode ?? "").trim(),
                few: Number(o.few) || 0,
                price: Number(o.price) || 0,
                levy: Number(o.levy) || undefined,
                scot: Number(o.scot) || undefined,
                uniterpcode: o.uniterpcode ? String(o.uniterpcode) : undefined,
            } as Line;
        })
        .filter((l) => l.ProductErpCode && l.few > 0);
}

/**
 * POST /api/holoo/documents — create a sales document.
 *   { kind:"preinvoice"|"order"|"invoice", customererpcode, lines:[...],
 *     comment?, levy?, scot?,                              // preinvoice/order
 *     type?, Cash?, CashSarfasl?, Bank?, BankSarfasl?, Nesiyeh?, Discount?, Kind? } // invoice
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }

    const kind = body?.kind;
    if (!["preinvoice", "order", "invoice"].includes(kind)) {
        return jsonError(400, "kind باید preinvoice، order یا invoice باشد");
    }
    const customererpcode = String(body?.customererpcode ?? "").trim();
    if (!customererpcode) return jsonError(400, "شناسه طرف‌حساب (customererpcode) الزامی است");

    const lines = normalizeLines(body?.lines);
    if (!lines.length) return jsonError(400, "حداقل یک قلم با شناسه کالا و تعداد لازم است");

    const now = new Date();
    const date = String(body?.date || now.toISOString().slice(0, 10));
    const time = String(body?.time || now.toTimeString().slice(0, 5));
    const id = String(body?.id || Date.now());

    try {
        if (kind === "invoice") {
            const type = Number(body?.type);
            if (![1, 2, 3, 4].includes(type)) return jsonError(400, "نوع فاکتور (type) باید 1،2،3 یا 4 باشد");
            const result = await createHolooInvoice({
                id,
                Type: type as HolooInvoiceType,
                customererpcode,
                date,
                time,
                Cash: Number(body?.Cash) || undefined,
                CashSarfasl: body?.CashSarfasl ? String(body.CashSarfasl) : undefined,
                Bank: Number(body?.Bank) || undefined,
                BankSarfasl: body?.BankSarfasl ? String(body.BankSarfasl) : undefined,
                Nesiyeh: Number(body?.Nesiyeh) || undefined,
                Discount: Number(body?.Discount) || undefined,
                Kind: Number(body?.Kind) || undefined,
                detailinfo: lines,
            } as never);
            return NextResponse.json({ success: true, ...result });
        }

        // preinvoice / order share the same shape (order needs uniterpcode per line)
        const payload = {
            id,
            customerpcode: customererpcode,
            date,
            time,
            comment: body?.comment ? String(body.comment) : undefined,
            levy: Number(body?.levy) || undefined,
            scot: Number(body?.scot) || undefined,
            detailinfo: lines,
        } as never;
        const result = kind === "order" ? await createHolooOrder(payload) : await createHolooPreInvoice(payload);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}

/** GET /api/holoo/documents?kind=preinvoice|order&erpcode=... — resolve doc number. */
export async function GET(req: NextRequest): Promise<NextResponse> {
    const sp = req.nextUrl.searchParams;
    const kind = sp.get("kind");
    const erpcode = (sp.get("erpcode") || "").trim();
    if (!erpcode) return jsonError(400, "erpcode الزامی است");
    try {
        const info = kind === "order" ? await getHolooOrderInfo(erpcode) : await getHolooPreInvoiceInfo(erpcode);
        return NextResponse.json({ success: true, ...info });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}
