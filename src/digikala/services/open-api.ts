import { getDgkToken } from "../utils/token";

const DGK_OPEN_API_BASE = "https://seller.digikala.com/open-api/v1";

export type DgkOpenApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const METHOD_WITH_BODY = new Set<DgkOpenApiMethod>(["POST", "PUT", "PATCH", "DELETE"]);

function normalizePath(path: string | string[]) {
    const joined = Array.isArray(path) ? path.join("/") : path;
    const clean = joined
        .replace(/^\/+/, "")
        .replace(/^open-api\/v1\/?/, "")
        .replace(/\.\./g, "")
        .trim();

    return clean;
}

export function buildDgkOpenApiUrl(path: string | string[], searchParams?: URLSearchParams) {
    const cleanPath = normalizePath(path);
    const url = new URL(`${DGK_OPEN_API_BASE}/${cleanPath}`);

    searchParams?.forEach((value, key) => {
        if (key !== "vendorId") url.searchParams.append(key, value);
    });

    return url;
}

export async function dgkOpenApiRequest<T = unknown>({
    vendorId,
    method,
    path,
    searchParams,
    body,
    bodyType = "json",
    raw = false,
}: {
    vendorId: string;
    method: DgkOpenApiMethod;
    path: string | string[];
    searchParams?: URLSearchParams;
    body?: unknown;
    bodyType?: "json" | "formData";
    raw?: boolean;
}): Promise<{ data: T; status: number; contentType: string; response?: Response }> {
    const url = buildDgkOpenApiUrl(path, searchParams);
    const headers: HeadersInit = {
        Accept: "application/json",
        Authorization: `Bearer ${await getDgkToken(vendorId)}`,
    };

    const init: RequestInit = {
        method,
        headers,
    };

    if (METHOD_WITH_BODY.has(method) && body !== undefined && bodyType === "json") {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
    }

    if (METHOD_WITH_BODY.has(method) && body !== undefined && bodyType === "formData") {
        init.body = body as BodyInit;
    }

    // Retry on 429 (rate limit) for reads, honouring Retry-After when present and
    // backing off between attempts. The admin panel and the background variant
    // sync share Digikala's rate limit, so a single short wait is often not
    // enough on busy panels — try up to 3 times before surfacing the error.
    let response = await fetch(url, init);
    for (let attempt = 1; attempt <= 3 && response.status === 429 && method === "GET"; attempt += 1) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const base = (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : attempt) * 1000;
        const waitMs = Math.min(10_000, Math.max(800, base * attempt)); // grows with each attempt
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        response = await fetch(url, init);
    }
    const contentType = response.headers.get("content-type") || "";

    if (raw && response.ok) {
        return {
            data: undefined as T,
            status: response.status,
            contentType,
            response,
        };
    }

    const data = contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : await response.text();

    if (!response.ok) {
        const error = new Error(`Digikala OpenAPI request failed with status ${response.status}`) as Error & {
            status?: number;
            data?: unknown;
        };
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return {
        data: data as T,
        status: response.status,
        contentType,
    };
}
