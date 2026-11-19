import { NextRequest, NextResponse } from "next/server";

import { createHolooHavaleh, createHolooReceive } from "@/holoo";
import { holooErrorResponse } from "@/holoo/http";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

/**
 * POST /api/holoo/payments — record a financial document.
 *   { kind: "receive", customersarfasl, cash?, cashsarfasl?, bank?, banksarfasl?, discount?, comment?, date?, time? }
 *   { kind: "havaleh", customersarfasl, banksarfasl, bank, discount?, comment?, date?, time? }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }

    const kind = body?.kind;
    if (kind !== "receive" && kind !== "havaleh") {
        return jsonError(400, "kind باید receive یا havaleh باشد");
    }
    if (!body?.customersarfasl) {
        return jsonError(400, "سرفصل طرف‌حساب (customersarfasl) الزامی است");
    }

    // Default date/time to now (Gregorian YYYY-MM-DD / HH:MM, per Holoo spec).
    const now = new Date();
    const date = String(body?.date || now.toISOString().slice(0, 10));
    const time = String(body?.time || now.toTimeString().slice(0, 5));
    const id = String(body?.id || Date.now());

    try {
        if (kind === "havaleh") {
            if (!body?.banksarfasl || !(Number(body?.bank) > 0)) {
                return jsonError(400, "برای حواله، سرفصل بانک و مبلغ لازم است");
            }
            const result = await createHolooHavaleh({
                id, date, time,
                customersarfasl: String(body.customersarfasl),
                banksarfasl: String(body.banksarfasl),
                bank: Number(body.bank),
                discount: Number(body.discount) || undefined,
                comment: body.comment ? String(body.comment) : undefined,
            });
            return NextResponse.json({ success: true, ...result });
        }

        // receive
        const cash = Number(body?.cash) || 0;
        const bank = Number(body?.bank) || 0;
        if (cash <= 0 && bank <= 0) {
            return jsonError(400, "حداقل یکی از مبلغ نقد یا بانک باید بزرگتر از صفر باشد");
        }
        const result = await createHolooReceive({
            id, date, time,
            customersarfasl: String(body.customersarfasl),
            cash: cash || undefined,
            cashsarfasl: body.cashsarfasl ? String(body.cashsarfasl) : undefined,
            bank: bank || undefined,
            banksarfasl: body.banksarfasl ? String(body.banksarfasl) : undefined,
            discount: Number(body.discount) || undefined,
            comment: body.comment ? String(body.comment) : undefined,
        });
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}
