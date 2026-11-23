import { connectMongoose } from "@/lib/mongoose";
import { getVendors } from "@/settings/services/vendorService";
import { snpGetVendors } from "@/snapp/api";
import { SNAPP_CONNECTION_RESPONSE_HEADERS } from "@/snapp/connection-cache";
import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

function safeFailure(error: unknown) {
    const status = Number((error as { status?: unknown })?.status);
    const message = String(error instanceof Error ? error.message : error || 'خطای نامشخص')
        .replace(/token|secret|password|authorization|api[-_]?key/gi, '[REDACTED]')
        .replace(/\s+/g, ' ')
        .slice(0, 240);

    return {
        code: status === 401 || status === 403 ? 'SNAPP_AUTH_FAILED' : 'SNAPP_CONNECTION_FAILED',
        message: status === 401 || status === 403
            ? 'اعتبارنامه اسنپ‌شاپ معتبر نیست؛ توکن و کد یکتا را دوباره ثبت کنید'
            : message,
    };
}

export async function GET(req: NextRequest): Promise<NextResponse> {

    await connectMongoose();

    const vendors = await getVendors("snapp");

    const response: Record<string, any> = {}
    const errors: Record<string, { code: string; message: string }> = {}

    for (let index = 0; index < vendors.length; index++) {
        const vendorId = vendors[index];
        try {
            const result = await snpGetVendors(vendorId);
            response[vendorId] = Array.isArray(result?.data) ? result.data : [];
            if (!Array.isArray(result?.data)) {
                errors[vendorId] = {
                    code: 'SNAPP_INVALID_VENDOR_RESPONSE',
                    message: 'اسنپ‌شاپ پاسخ معتبری برای فهرست فروشگاه‌ها برنگرداند',
                };
            }
        } catch (error) {
            response[vendorId] = []
            errors[vendorId] = safeFailure(error);
        }
    }

    return NextResponse.json({ vendors: response, errors }, { headers: SNAPP_CONNECTION_RESPONSE_HEADERS });
}
