import { NextResponse } from "next/server";

import { logErrorLater } from "@/observability/error-log";

import { isHolooError } from "./constants/errors";

/**
 * Convert any error thrown by the Holoo services into a JSON NextResponse,
 * preserving Holoo's status/code and logging it for the error dashboard.
 */
export function holooErrorResponse(error: unknown, route: string, method: string): NextResponse {
    const status = isHolooError(error) ? error.status : (error as any)?.status ?? 500;
    const message = isHolooError(error)
        ? error.message
        : (error as any)?.message || "خطای ارتباط با هلو";
    const holooCode = isHolooError(error) ? error.holooCode : undefined;

    logErrorLater({
        category: "system",
        source: "holoo",
        error,
        route,
        method,
        metadata: { status, holooCode, data: (error as any)?.data },
    });

    return NextResponse.json({ error: message, code: holooCode, status }, { status });
}
