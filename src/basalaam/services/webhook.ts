import { Get, POST, PATCH, DELETE } from "@/utils/fetch";
import { bslApiRoutes } from "../constants/route";
import { bslBearerHeader } from "./auth";

/**
 * Basalam webhook service (SDK docs section 12). Lets the panel register to
 * receive Basalam events (e.g. CHAT_RECEIVED_MESSAGE) on our own receiver
 * (POST /api/basalaam/webhook). Hosted on the webhook service.
 */

export type BslCreateWebhook = {
    service_id: number;
    event_ids: number[];
    url: string;
    request_headers?: string;
    request_method?: "POST" | "PUT" | "PATCH";
    is_active?: boolean;
};

export async function bslGetWebhookServices(vendorId: string) {
    const { headers } = await bslBearerHeader(vendorId);
    return Get<Record<string, unknown>>(bslApiRoutes.webhook_services, headers);
}

export async function bslCreateWebhookService(vendorId: string, request: { title: string; description?: string }) {
    const { headers } = await bslBearerHeader(vendorId);
    return POST<Record<string, unknown>>(bslApiRoutes.webhook_services, request, headers);
}

export async function bslGetWebhookEvents(vendorId: string) {
    const { headers } = await bslBearerHeader(vendorId);
    return Get<Record<string, unknown>>(bslApiRoutes.webhook_events, headers);
}

export async function bslGetWebhooks(vendorId: string, params?: { service_id?: number; event_ids?: string }) {
    const { headers } = await bslBearerHeader(vendorId);
    const qs = new URLSearchParams();
    if (params?.service_id) qs.set("service_id", String(params.service_id));
    if (params?.event_ids) qs.set("event_ids", params.event_ids);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return Get<Record<string, unknown>>(bslApiRoutes.webhooks.concat(suffix), headers);
}

export async function bslCreateWebhook(vendorId: string, request: BslCreateWebhook) {
    const { headers } = await bslBearerHeader(vendorId);
    return POST<Record<string, unknown>>(bslApiRoutes.webhooks, {
        request_method: "POST",
        is_active: true,
        ...request,
    }, headers);
}

export async function bslUpdateWebhook(vendorId: string, webhookId: number, request: Partial<BslCreateWebhook>) {
    const { headers } = await bslBearerHeader(vendorId);
    return PATCH<Record<string, unknown>>(bslApiRoutes.webhook(webhookId), request, headers);
}

export async function bslDeleteWebhook(vendorId: string, webhookId: number) {
    const { headers } = await bslBearerHeader(vendorId);
    return DELETE<Record<string, unknown>>(bslApiRoutes.webhook(webhookId), headers);
}

export async function bslRegisterWebhook(vendorId: string, webhook_id: number) {
    const { headers } = await bslBearerHeader(vendorId);
    return POST<Record<string, unknown>>(bslApiRoutes.webhook_register, { webhook_id }, headers);
}

export async function bslUnregisterWebhook(vendorId: string, webhook_id: number) {
    const { headers } = await bslBearerHeader(vendorId);
    return POST<Record<string, unknown>>(bslApiRoutes.webhook_unregister, { webhook_id }, headers);
}
