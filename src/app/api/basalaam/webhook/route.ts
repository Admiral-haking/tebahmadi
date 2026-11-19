import { NextRequest, NextResponse } from "next/server";

import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { syncBslVendorsOrders } from "@/basalaam";

export const runtime = "nodejs";

/**
 * Public receiver for Basalam webhook events (SDK docs section 12). Basalam POSTs
 * here when a registered event fires. We ack fast (Basalam retries on non-2xx)
 * and process known events best-effort. Registered via the webhook service with
 * url = <site>/api/basalaam/webhook.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let payload: any;
    try {
        payload = await req.json();
    } catch {
        return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const eventName: string =
        payload?.event ?? payload?.event_name ?? payload?.type ?? payload?.data?.event ?? "unknown";

    // Process known events without blocking the ack: order/parcel changes trigger
    // a best-effort orders re-sync so the panel/tracking stay fresh.
    try {
        const lower = String(eventName).toLowerCase();
        if (lower.includes("order") || lower.includes("parcel")) {
            await connectMongoose();
            void syncBslVendorsOrders().catch((error) =>
                logErrorLater({ category: "sync", source: "basalaam.webhook.order-sync", error }),
            );
        }
    } catch (error) {
        logErrorLater({ category: "api", source: "basalaam.webhook.receive", error });
    }

    // Always ack so Basalam doesn't retry a successfully-received event.
    return NextResponse.json({ ok: true, event: eventName });
}
