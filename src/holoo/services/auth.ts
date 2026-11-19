import { POST } from "@/utils/fetch";
import { getServiceInfo, setServiceInfo } from "@/settings/services/servicesService";

import {
    encodeHolooPassword,
    getHolooConfig,
    HOLOO_CONNECTION_ID,
    isHolooConfigured,
} from "../constants/config";
import { holooError } from "../constants/errors";
import { holooRoutes } from "../constants/routes";
import type { HolooLoginResponse } from "../types";

type CachedToken = {
    token: string;
    savedAt: number;
};

/**
 * Log in to the Holoo web service and cache the returned bearer token.
 * Holoo tokens have no documented TTL, so we cache and lazily refresh on a 401
 * (handled by the request client), rather than tracking an expiry.
 */
export async function holooLogin(): Promise<string> {
    const { baseUrl, username, password, dbname } = getHolooConfig();

    const res = await POST<HolooLoginResponse>(`${baseUrl}${holooRoutes.login}`, {
        userinfo: {
            username,
            userpass: encodeHolooPassword(password),
            dbname,
        },
    });

    const login = res?.Login;
    // Holoo returns State as boolean true (despite the docs showing the string
    // "True"), so normalise before comparing.
    const stateOk = String(login?.State).toLowerCase() === "true";
    if (!login || !stateOk || !login.Token) {
        throw holooError(login?.ErrorCode, login?.Error || "ورود به وب سرویس هلو ناموفق بود", {
            status: 401,
        });
    }

    await setServiceInfo<CachedToken>("holoo", "auth_token", HOLOO_CONNECTION_ID, {
        token: login.Token,
        savedAt: Date.now(),
    });

    return login.Token;
}

/** Return a cached token, logging in on first use / cache miss. */
export async function getHolooToken(): Promise<string> {
    const cached = await getServiceInfo<CachedToken>("holoo", "auth_token", HOLOO_CONNECTION_ID);
    if (cached?.token) return cached.token;
    return holooLogin();
}

/** Drop the cached token (e.g. after credentials change). */
export async function clearHolooToken(): Promise<void> {
    await setServiceInfo<CachedToken | null>("holoo", "auth_token", HOLOO_CONNECTION_ID, null);
}

export type HolooStatus = {
    configured: boolean;
    connected: boolean;
    message: string;
    dbname?: string;
    baseUrl?: string;
};

/**
 * Probe the connection for the admin UI: confirms env config is present and that
 * a fresh login succeeds. Never throws — returns a descriptive status instead.
 */
export async function getHolooStatus(): Promise<HolooStatus> {
    if (!isHolooConfigured()) {
        return {
            configured: false,
            connected: false,
            message: "تنظیمات اتصال به هلو کامل نیست. متغیرهای HOLOO_* را در محیط تنظیم کنید.",
        };
    }

    const { baseUrl, dbname } = getHolooConfig();
    try {
        // Force a fresh login so the probe reflects current credentials/service state.
        await holooLogin();
        return {
            configured: true,
            connected: true,
            message: "اتصال به وب سرویس هلو برقرار است.",
            dbname,
            baseUrl,
        };
    } catch (err: any) {
        return {
            configured: true,
            connected: false,
            message: err?.message || "اتصال به وب سرویس هلو ناموفق بود.",
            dbname,
            baseUrl,
        };
    }
}
