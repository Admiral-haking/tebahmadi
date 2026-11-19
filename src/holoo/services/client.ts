import Fetch from "@/utils/fetch";

import { getHolooConfig } from "../constants/config";
import { holooError, isHolooError, HolooError } from "../constants/errors";
import { latinizeHolooPayload } from "../utils/digits";
import { getHolooToken, holooLogin } from "./auth";

type QueryValue = string | number | boolean | undefined | null;

type HolooRequestOptions = {
    method: "GET" | "POST" | "PUT" | "DELETE";
    path: string;
    query?: Record<string, QueryValue>;
    body?: unknown;
    /** Internal — set to false to prevent a second re-login retry loop. */
    retryAuth?: boolean;
};

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
    let url = `${baseUrl}${path}`;
    if (query) {
        const search = Object.entries(query)
            .filter(([, v]) => v !== undefined && v !== null && v !== "")
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            .join("&");
        if (search) url += `?${search}`;
    }
    return url;
}

/** Holoo returns the token already prefixed with "Bearer "; normalise either way. */
function authHeader(token: string): string {
    return /^bearer\s/i.test(token) ? token : `Bearer ${token}`;
}

/**
 * Inspect a Holoo response body for an embedded logical error. Holoo replies
 * with HTTP 200 even on validation failures, encoding the problem in the body,
 * so every response is screened here. Returns `null` when the body looks fine.
 */
function extractBodyError(data: unknown): { code?: string; message?: string } | null {
    if (!data || typeof data !== "object") return null;
    const record = data as Record<string, any>;

    // Login envelope.
    if (record.Login && record.Login.State !== "True") {
        return { code: record.Login.ErrorCode, message: record.Login.Error };
    }

    // Some endpoints nest the failure under an `Error` object.
    const errObj = record.Error;
    if (errObj && typeof errObj === "object") {
        return { code: errObj.ErrorCode ?? errObj.Code, message: errObj.Error ?? errObj.Message };
    }

    // Flat error code at the top level (no Success payload).
    if ((record.ErrorCode || record.errorcode) && record.Success === undefined) {
        return {
            code: record.ErrorCode ?? record.errorcode,
            message: record.Error ?? record.error ?? record.Message,
        };
    }

    return null;
}

/** Turn a thrown value (FetchError, etc.) into a HolooError. */
function normalizeError(err: any): HolooError {
    if (isHolooError(err)) return err;
    const status = err?.status ?? 500;
    const data = err?.data;
    const embedded = extractBodyError(data);
    if (embedded) {
        return holooError(embedded.code, embedded.message, { status, data });
    }
    const message =
        (data && typeof data === "object" && (data.Error || data.message)) ||
        err?.message ||
        "ارتباط با وب سرویس هلو ناموفق بود";
    return holooError(null, String(message), { status, data });
}

/**
 * Core authenticated request to the Holoo web service. Acquires a cached token,
 * screens the response body for Holoo's in-band errors, and transparently
 * re-logs-in once on an HTTP 401 (expired/invalid token).
 */
export async function holooRequest<T = any>(opts: HolooRequestOptions): Promise<T> {
    const { baseUrl } = getHolooConfig();
    const token = await getHolooToken();
    const url = buildUrl(baseUrl, opts.path, opts.query);

    try {
        const data = await Fetch<any>(url, {
            method: opts.method,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                Accept: "application/json",
                Authorization: authHeader(token),
            },
            // Latinize digits so Holoo (which renders Persian digits as "؟") shows
            // numbers correctly; Persian letters and the Shamsi calendar are kept.
            body: opts.body !== undefined ? JSON.stringify(latinizeHolooPayload(opts.body)) : undefined,
        });

        const embedded = extractBodyError(data);
        if (embedded) {
            throw holooError(embedded.code, embedded.message, { data });
        }

        return data as T;
    } catch (err: any) {
        if (err?.status === 401 && opts.retryAuth !== false) {
            // Token expired — force a fresh login and retry exactly once.
            await holooLogin();
            return holooRequest<T>({ ...opts, retryAuth: false });
        }
        throw normalizeError(err);
    }
}
