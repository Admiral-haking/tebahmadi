import { getServiceInfo, setServiceInfo } from "@/settings/services/servicesService"
import { Get } from "@/utils/fetch";
import { SnappVendorsResponse } from "../api/type";
import { snappApiRoutes } from "../constants/routes";

type StoredSnappCredentials = {
    token?: unknown;
    client_code?: unknown;
    /** Legacy field retained for credentials saved before the rename. */
    client_secret?: unknown;
};

function stripOuterQuotes(value: string): string {
    return value.trim().replace(/^(?:['"])([\s\S]*)(?:['"])$/, "$1").trim();
}

export function normalizeSnappToken(value: string): string {
    return stripOuterQuotes(value)
        .replace(/^authorization\s*:\s*/i, '')
        .replace(/^bearer\s+/i, '')
        .trim();
}

export function normalizeSnappClientCode(value: string): string {
    return stripOuterQuotes(value)
        .replace(/^(?:user-agent|client(?:[_ -]?code)?)\s*:\s*/i, '')
        .trim();
}

function providerAuthFailure(error: any): string {
    const status = Number(error?.status ?? error?.statusCode ?? error?.data?.code);
    if (status === 401 || status === 403 || error?.data?.status === false) {
        return "اطلاعات توکن یا کد یکتای اسنپ‌شاپ صحیح نیست؛ توکن را بدون Bearer و کد یکتا را دقیقاً از پنل کپی کنید";
    }
    if (status === 429) {
        return "اسنپ‌شاپ موقتاً درخواست‌ها را محدود کرده است؛ چند دقیقه بعد دوباره تلاش کنید";
    }
    if (status >= 500) {
        return "سرویس اسنپ‌شاپ موقتاً در دسترس نیست؛ ثبت اتصال انجام نشد";
    }
    return "اعتبارسنجی اسنپ‌شاپ انجام نشد؛ وضعیت اتصال و دسترسی سرور را بررسی کنید";
}

export async function snpSetToken(vendorId: string, token: string, clientCode: string) {
    const normalizedVendorId = vendorId.trim();
    const normalizedToken = normalizeSnappToken(token);
    const normalizedClientCode = normalizeSnappClientCode(clientCode);

    if (!normalizedVendorId || !normalizedToken || !normalizedClientCode) {
        return "اطلاعات اتصال اسنپ کامل نیست";
    }

    let res: SnappVendorsResponse;
    try {
        res = await Get<SnappVendorsResponse>(snappApiRoutes.vendors, {
            'User-Agent': normalizedClientCode,
            'Authorization': `Bearer ${normalizedToken}`
        });

        if (!res?.status || !Array.isArray(res.data)) {
            throw Object.assign(new Error('Snapp returned an invalid vendor response'), {
                status: 401,
                data: res,
            });
        }
    } catch (err: any) {
        return providerAuthFailure(err);
    }

    // Persist only after the provider accepts the exact normalized headers.
    // Storage failures deliberately escape so the route can return a distinct
    // registration error instead of claiming that authentication failed.
    await setServiceInfo("snapp", "token", normalizedVendorId, {
        token: normalizedToken,
        client_code: normalizedClientCode,
        client_secret: normalizedClientCode,
    });

    return res;
}


export async function snpGetToken(vendorId: string) {
    const data = await getServiceInfo<StoredSnappCredentials>("snapp", "token", vendorId);

    const token = typeof data?.token === 'string' ? normalizeSnappToken(data.token) : '';
    const clientCodeSource = data?.client_code ?? data?.client_secret;
    const clientCode = typeof clientCodeSource === 'string'
        ? normalizeSnappClientCode(clientCodeSource)
        : '';

    if (!token || !clientCode) throw new Error("اطلاعات احراز هویت اسنپ یافت نشد.");

    return {
        'User-Agent': clientCode,
        'Authorization': `Bearer ${token}`
    }
}
