import { NextRequest, NextResponse } from "next/server";

import {
    getVendorCustomerMap,
    listHolooCustomers,
    setVendorCustomerMap,
    vendorCustomerKey,
    type SalesChannel,
} from "@/holoo";
import { holooErrorResponse } from "@/holoo/http";
import { jsonError } from "@/lib/http";
import { connectMongoose } from "@/lib/mongoose";
import { getVendors } from "@/settings/services/vendorService";
import type { IServiceType } from "@/settings/models/serviceInfo";
import { TrackerModel } from "@/tracking";

export const runtime = "nodejs";

/** serviceId (tracker) → SalesChannel. Mirrors SERVICE_TO_CHANNEL in sync-invoice. */
const SERVICE_TO_CHANNEL: Record<string, SalesChannel> = {
    dgk: "digikala",
    basalaam: "basalaam",
    snapp: "snapp",
    website: "site",
};

/** Marketplace services whose registered panels live in the `vendors` collection. */
const MARKETPLACE_SERVICES: Array<{ service: IServiceType; channel: SalesChannel }> = [
    { service: "dgk", channel: "digikala" },
    { service: "basalaam", channel: "basalaam" },
    { service: "snapp", channel: "snapp" },
];

type Panel = { channel: SalesChannel; vendorId: string; key: string; count: number };

/**
 * Every marketplace panel that should appear in the linking table:
 *   1) all **registered** panels from the `vendors` collection (even with zero orders), and
 *   2) any panel seen in `trackers` — carrying its order count.
 * Keyed by (channel, vendorId); the tracker count wins when both sources overlap.
 */
async function collectVendorPanels(): Promise<Panel[]> {
    const byKey = new Map<string, Panel>();

    // 0) The site channel is a single fixed panel (no vendor). It must appear so
    //    the admin can link "سایت" to a طرف‌حساب and route site orders there.
    {
        const key = vendorCustomerKey("site", "");
        byKey.set(key, { channel: "site", vendorId: "", key, count: 0 });
    }

    // 1) Registered panels — start everyone at count 0 so order-less panels show up.
    const registered = await Promise.all(
        MARKETPLACE_SERVICES.map(async ({ service, channel }) => ({
            channel,
            vendors: await getVendors(service),
        })),
    );
    for (const { channel, vendors } of registered) {
        for (const raw of vendors || []) {
            const vendorId = String(raw || "").trim();
            const key = vendorCustomerKey(channel, vendorId);
            byKey.set(key, { channel, vendorId, key, count: 0 });
        }
    }

    // 2) Panels seen in trackers — overlay real order counts (and surface any
    //    panel that has orders but is somehow missing from the registry).
    const rows = await TrackerModel.aggregate<{
        _id: { serviceId: string; vendorId: string };
        count: number;
    }>([
        { $group: { _id: { serviceId: "$serviceId", vendorId: "$vendorId" }, count: { $sum: 1 } } },
    ]);
    for (const r of rows) {
        const channel = SERVICE_TO_CHANNEL[String(r._id?.serviceId || "")];
        if (!channel) continue;
        const rawVendorId = String(r._id?.vendorId || "").trim();
        // Skip legacy marketplace trackers that have no vendorId (a historical
        // bug left ~1009 Digikala orders without a panel). They don't belong to
        // any registered panel, so collapsing them onto a blank "—" row is
        // meaningless — hide it from the linking table. The data is untouched.
        if (channel !== "site" && !rawVendorId) continue;
        // Site has no per-vendor panels: collapse all site trackers onto the
        // single "سایت" row (vendor = "") so its count reflects site orders.
        const vendorId = channel === "site" ? "" : rawVendorId;
        const key = vendorCustomerKey(channel, vendorId);
        // Site collapses many tracker groups onto one row → accumulate;
        // marketplace rows are unique per (channel, vendor) → assign.
        const prev = byKey.get(key)?.count ?? 0;
        byKey.set(key, {
            channel,
            vendorId,
            key,
            count: channel === "site" ? prev + r.count : r.count,
        });
    }

    // Linked/ready panels first, then by order count desc.
    return [...byKey.values()].sort((a, b) => b.count - a.count);
}

/**
 * GET /api/holoo/vendor-map — everything to link a marketplace panel to a Holoo
 * customer: the panels found in trackers, the Holoo customer list, and the
 * current channel/vendor → customer ErpCode map.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        await connectMongoose();
        const [panels, customers, map] = await Promise.all([
            collectVendorPanels(),
            listHolooCustomers({}),
            getVendorCustomerMap(),
        ]);
        return NextResponse.json({
            panels,
            customers: customers.map((c) => ({ Name: c.Name, ErpCode: c.ErpCode, Code: c.Code })),
            map,
        });
    } catch (error) {
        return holooErrorResponse(error, req.nextUrl.pathname, req.method);
    }
}

/**
 * POST — link a panel to a customer. Accepts:
 *   { key, erpcode }  — set/clear one link (key from GET)
 *   { map }           — replace the whole map
 * Idempotent: re-linking the same key→erpcode leaves the map unchanged.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    let body: any;
    try {
        body = await req.json();
    } catch {
        return jsonError(400, "بدنه درخواست نامعتبر است");
    }

    const current = await getVendorCustomerMap();
    let next: Record<string, string> = { ...current };

    if (body?.map && typeof body.map === "object") {
        next = {};
        for (const [k, v] of Object.entries(body.map as Record<string, unknown>)) {
            const erp = String(v ?? "").trim();
            if (k && erp) next[String(k).trim()] = erp;
        }
    } else if (body?.key) {
        const key = String(body.key).trim();
        const erp = String(body?.erpcode ?? "").trim();
        if (erp) next[key] = erp;
        else delete next[key];
    } else {
        return jsonError(400, "key یا map لازم است");
    }

    await setVendorCustomerMap(next);
    return NextResponse.json({ ok: true, map: next });
}
