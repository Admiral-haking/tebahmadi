import { logErrorLater } from "@/observability/error-log";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
    return NextResponse.json({
        ok: true,
        service: "digikala-webhook",
        callbackPath: "/api/digikala/webhook",
    });
}

export async function POST(req: NextRequest) {
    const contentType = req.headers.get("content-type") || "";
    let payload: unknown;

    if (contentType.includes("application/json")) {
        payload = await req.json().catch(() => null);
    } else {
        payload = await req.text().catch(() => "");
    }

    // A received webhook is informational, not an error — log at info level so it
    // doesn't pollute the error view.
    logErrorLater({
        level: "info",
        category: "api",
        source: "digikala.webhook",
        message: "digikala_webhook_received",
        route: req.nextUrl.pathname,
        method: req.method,
        metadata: {
            contentType,
            payload,
            headers: {
                userAgent: req.headers.get("user-agent"),
                signature: req.headers.get("x-signature") ?? req.headers.get("x-digikala-signature"),
            },
        },
    });

    return NextResponse.json({ ok: true });
}
