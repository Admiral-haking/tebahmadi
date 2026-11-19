import {
    bslGetWebhooks,
    bslGetWebhookServices,
    bslGetWebhookEvents,
    bslCreateWebhookService,
    bslCreateWebhook,
    bslRegisterWebhook,
    bslDeleteWebhook,
} from "@/basalaam/services/webhook";
import { resolveSiteBaseUrl, toAbsoluteUrl } from "@/seo/utils/url";
import { connectMongoose } from "@/lib/mongoose";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** GET /api/basalaam/webhooks?vendorId=...&kind=services|events|list */
export async function GET(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    const url = new URL(req.url);
    const vendorId = url.searchParams.get("vendorId");
    const kind = url.searchParams.get("kind") ?? "list";
    if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });
    try {
        const res =
            kind === "services" ? await bslGetWebhookServices(vendorId)
                : kind === "events" ? await bslGetWebhookEvents(vendorId)
                    : await bslGetWebhooks(vendorId);
        return NextResponse.json(res);
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || "خطا در دریافت وب‌هوک‌های باسلام" }, { status: err?.status || 400 });
    }
}

/**
 * POST /api/basalaam/webhooks  { vendorId, event_ids, service_id?, service_title? }
 * Creates (or uses) a webhook service, registers a webhook pointing at our own
 * receiver, and subscribes to it — a one-call setup.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    const body = await req.json().catch(() => ({}));
    const { vendorId, event_ids, service_id, service_title } = body ?? {};
    if (!vendorId || !Array.isArray(event_ids) || !event_ids.length) {
        return NextResponse.json({ error: "vendorId و event_ids لازم است" }, { status: 400 });
    }
    try {
        let serviceId = service_id as number | undefined;
        if (!serviceId) {
            const created = await bslCreateWebhookService(vendorId, {
                title: service_title || "store-webhook",
                description: "Auto-created by the store panel",
            });
            serviceId = Number((created as { id?: number; data?: { id?: number } })?.id ?? (created as any)?.data?.id);
        }
        const receiverUrl = toAbsoluteUrl("/api/basalaam/webhook", resolveSiteBaseUrl());
        const webhook = await bslCreateWebhook(vendorId, { service_id: serviceId!, event_ids, url: receiverUrl });
        const webhookId = Number((webhook as { id?: number; data?: { id?: number } })?.id ?? (webhook as any)?.data?.id);
        let registered: unknown = null;
        if (Number.isFinite(webhookId)) {
            registered = await bslRegisterWebhook(vendorId, webhookId).catch(() => null);
        }
        return NextResponse.json({ ok: true, service_id: serviceId, webhook, registered, receiverUrl });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || "خطا در ساخت وب‌هوک باسلام" }, { status: err?.status || 400 });
    }
}

/** DELETE /api/basalaam/webhooks  { vendorId, webhook_id } */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();
    const body = await req.json().catch(() => ({}));
    const { vendorId, webhook_id } = body ?? {};
    if (!vendorId || !webhook_id) return NextResponse.json({ error: "vendorId و webhook_id لازم است" }, { status: 400 });
    try {
        const res = await bslDeleteWebhook(vendorId, Number(webhook_id));
        return NextResponse.json(res);
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || "خطا در حذف وب‌هوک باسلام" }, { status: err?.status || 400 });
    }
}
