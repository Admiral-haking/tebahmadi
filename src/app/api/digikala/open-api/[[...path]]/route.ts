import { dgkOpenApiRequest, type DgkOpenApiMethod } from "@/digikala/services/open-api";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{ path?: string[] }>;
};

const SUPPORTED_METHODS = new Set<DgkOpenApiMethod>(["GET", "POST", "PUT", "PATCH", "DELETE"]);

async function parseBody(req: NextRequest) {
    if (req.method === "GET") return undefined;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
        return {
            body: await req.formData(),
            bodyType: "formData" as const,
        };
    }

    const text = await req.text();
    if (!text.trim()) return undefined;

    try {
        return {
            body: JSON.parse(text),
            bodyType: "json" as const,
        };
    } catch {
        throw Object.assign(new Error("Invalid JSON body"), { status: 400 });
    }
}

async function handle(req: NextRequest, context: RouteContext) {
    const method = req.method as DgkOpenApiMethod;
    if (!SUPPORTED_METHODS.has(method)) return jsonError(405, "Method not allowed");

    await connectMongoose();

    const { path = [] } = await context.params;
    const searchParams = req.nextUrl.searchParams;
    const vendorId = (searchParams.get("vendorId") ?? "").trim();
    const raw = searchParams.get("raw") === "1";

    if (!vendorId) return jsonError(400, "vendorId is needed");

    try {
        const parsedBody = await parseBody(req);
        const result = await dgkOpenApiRequest({
            vendorId,
            method,
            path,
            searchParams,
            body: parsedBody?.body,
            bodyType: parsedBody?.bodyType,
            raw,
        });

        if (raw && result.response) {
            return new NextResponse(result.response.body, {
                status: result.status,
                headers: {
                    "content-type": result.contentType || "application/octet-stream",
                    "content-disposition": result.response.headers.get("content-disposition") || "attachment",
                },
            });
        }

        return NextResponse.json({
            status: result.status,
            contentType: result.contentType,
            data: result.data,
        });
    } catch (error: any) {
        if (error?.status === 400 && error?.message === "Invalid JSON body") {
            return jsonError(400, error.message);
        }

        // Extract the human-readable message from DGK's error body so the UI
        // can surface the real reason instead of a generic English string.
        const dgkData = error?.data as Record<string, unknown> | string | undefined;
        let dgkMessage: string | undefined;
        if (typeof dgkData === "string") {
            dgkMessage = dgkData.trim() || undefined;
        } else if (dgkData && typeof dgkData === "object") {
            const m =
                (dgkData.message as string | undefined) ??
                ((dgkData.error as Record<string, unknown> | undefined)?.message as string | undefined) ??
                (dgkData.detail as string | undefined) ??
                (() => {
                    const errs = dgkData.errors;
                    if (Array.isArray(errs) && errs.length) {
                        return errs.map((e) => (typeof e === "string" ? e : (e as any)?.message)).filter(Boolean).join(" — ");
                    }
                    if (errs && typeof errs === "object") {
                        return Object.values(errs as Record<string, unknown>).flat().filter(Boolean).join(" — ");
                    }
                    return undefined;
                })();
            dgkMessage = typeof m === "string" && m.trim() ? m.trim() : undefined;
        }

        const status = error?.status ?? 500;
        const friendly =
            dgkMessage ||
            (status === 401
                ? "احراز هویت دیجی‌کالا منقضی شده — دوباره متصل شوید"
                : status === 429
                    ? "محدودیت تعداد درخواست دیجی‌کالا — کمی بعد تلاش کنید"
                    : `درخواست دیجی‌کالا ناموفق بود (خطای ${status})`);

        logErrorLater({
            category: "api",
            source: "digikala.open-api.proxy",
            error,
            route: req.nextUrl.pathname,
            method: req.method,
            metadata: {
                vendorId,
                path: path.join("/"),
                status,
                data: error?.data,
                message: dgkMessage,
            },
        });

        return NextResponse.json(
            {
                error: friendly,
                status,
                data: error?.data,
            },
            { status },
        );
    }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
