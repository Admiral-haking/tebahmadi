import { connectMongoose } from "@/lib/mongoose";
import { HttpError, requirePermission } from "@/lib/auth";
import { logAuditLater, requestContext } from "@/observability/audit-log";
import { logErrorLater } from "@/observability/error-log";
import { snpSetToken } from "@/snapp/services/token";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        await requirePermission(req, 'products:write');
    } catch (error) {
        if (error instanceof HttpError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        throw error;
    }

    await connectMongoose();

    let args: {
        vendorId?: unknown;
        token?: unknown;
        clientCode?: unknown;
        client_code?: unknown;
        /** Legacy field accepted during the migration from client_secret. */
        client_secret?: unknown;
    };
    try {
        args = await req.json();
    } catch {
        return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 });
    }

    const vendorId = typeof args.vendorId === 'string' ? args.vendorId.trim() : '';
    const token = typeof args.token === 'string' ? args.token.trim() : '';
    const clientCodeValue = args.clientCode ?? args.client_code ?? args.client_secret;
    const clientCode = typeof clientCodeValue === 'string' ? clientCodeValue.trim() : '';

    if (!vendorId || !token || !clientCode) {
        return NextResponse.json(
            { error: 'شناسه فروشنده، توکن و کد یکتای اسنپ‌شاپ الزامی است' },
            { status: 400 },
        );
    }

    let res: Awaited<ReturnType<typeof snpSetToken>>;
    try {
        res = await snpSetToken(vendorId, token, clientCode);
    } catch (error) {
        logErrorLater({
            level: 'error',
            category: 'marketplace',
            source: 'snapp.auth.persistence',
            message: 'Snapp credentials validated but could not be registered',
            error,
            route: '/api/snapp/auth',
            method: 'POST',
            metadata: { vendorId, phase: 'persistence' },
        });
        return NextResponse.json(
            {
                ok: false,
                code: 'SNAPP_CREDENTIAL_SAVE_FAILED',
                message: 'اعتبارسنجی موفق بود، اما ثبت اتصال در پنل داخلی انجام نشد؛ دوباره تلاش کنید',
            },
            { status: 500 },
        );
    }

    if (typeof res === 'string') {
        return NextResponse.json({ ok: false, code: 'SNAPP_AUTH_FAILED', message: res }, { status: 401 });
    }

    logAuditLater({
        action: 'update',
        entity: 'snappAuth',
        entityId: vendorId,
        entityLabel: vendorId,
        summary: 'ذخیره توکن اتصال اسنپ',
        actor: {
            id: req.headers.get('x-user-id') ?? undefined,
            phone: req.headers.get('x-user-phone') ?? undefined,
            roles: req.headers.get('x-user-roles')?.split(',').filter(Boolean) ?? [],
        },
        severity: 'high',
        metadata: { vendorId, hasToken: true },
        ...requestContext(req),
    });

    return NextResponse.json(res);
}
