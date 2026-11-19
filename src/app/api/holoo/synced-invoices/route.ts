import { NextRequest, NextResponse } from "next/server";

import { HOLOO_CONNECTION_ID } from "@/holoo/constants/config";
import { connectMongoose } from "@/lib/mongoose";
import { InvoiceModel } from "@/orders/models/Invoice";
import ServiceInfoModel from "@/settings/models/serviceInfo";
import { TrackerModel } from "@/tracking";

export const runtime = "nodejs";

type RowType = "sale" | "return" | "marketplace";

type Row = {
    id: string;
    type: RowType;
    /** Persian platform label: سایت / دیجی‌کالا / باسلام / اسنپ‌شاپ. */
    channel: string;
    number: string;
    customer: string;
    phone: string;
    amount: number; // تومان
    shippingTotal: number; // تومان
    discountTotal: number; // تومان
    lines: { title: string; qty: number; unitPrice: number; lineTotal: number }[];
    createdAt: Date | null;
    paymentMethod: string;
    synced: boolean;
    erpcode: string;
    holooNumber: string;
    syncedAt: number | null;
    skipped: boolean;
    skipReason: string;
};

type Marker = { erpcode?: string; number?: string; syncedAt?: number; skipped?: boolean; reason?: string };

/** serviceId → Persian platform label (marketplace only). */
const SERVICE_LABEL: Record<string, string> = {
    dgk: "دیجی‌کالا",
    basalaam: "باسلام",
    snapp: "اسنپ‌شاپ",
};

const toToman = (rial: number) => Math.round((Number(rial) || 0) / 10);

/**
 * GET /api/holoo/synced-invoices — unified list of everything that can be sent
 * to Holoo, with sync status: site sales, site returns (canceled/refunded), and
 * marketplace orders (Digikala/Basalaam/Snapp trackers). All money is normalised
 * to تومان so the UI formats one way.
 *
 * query: page, size, filter=all|synced|pending, type=all|sale|return|marketplace,
 *        q (number / customer / phone / orderId)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    await connectMongoose();

    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const size = Math.min(100, Math.max(1, Number(sp.get("size")) || 30));
    const filter = (sp.get("filter") || "all") as "all" | "synced" | "pending";
    const typeFilter = (sp.get("type") || "all") as "all" | RowType;
    const q = (sp.get("q") || "").trim().toLowerCase();

    // ── Markers: invoice: (sale), return: (return), tracker: (marketplace) ──────
    const markers = await ServiceInfoModel.find(
        { service: "holoo", id: { $regex: "^(invoice|return|tracker):" }, vendorId: HOLOO_CONNECTION_ID },
        { id: 1, data: 1 },
    ).lean();
    const saleMarker = new Map<string, Marker>();
    const returnMarker = new Map<string, Marker>();
    const trackerMarker = new Map<string, Marker>();
    for (const m of markers) {
        const id = String((m as { id?: string }).id ?? "");
        const data = ((m as { data?: unknown }).data ?? {}) as Marker;
        if (id.startsWith("invoice:")) saleMarker.set(id.slice("invoice:".length), data);
        else if (id.startsWith("return:")) returnMarker.set(id.slice("return:".length), data);
        else if (id.startsWith("tracker:")) trackerMarker.set(id.slice("tracker:".length), data);
    }

    const rows: Row[] = [];

    // ── Site invoices: sales (paid) + returns (canceled/refunded) ───────────────
    const invoices = await InvoiceModel.find(
        { status: { $in: ["paid", "canceled", "refunded"] } },
        { number: 1, status: 1, grandTotal: 1, discountTotal: 1, shippingTotal: 1, createdAt: 1, paymentMethod: 1, addressSnapshot: 1, lines: 1 },
    )
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean();

    for (const inv of invoices as any[]) {
        const isReturn = inv.status === "canceled" || inv.status === "refunded";
        const marker = isReturn ? returnMarker.get(inv.number) : saleMarker.get(inv.number);
        const lines = (inv.lines ?? []).map((l: any) => ({
            title: l.title ?? "—",
            qty: Number(l.qty ?? l.requestedQty ?? 1),
            unitPrice: Number(l.unitPriceEffective ?? 0),
            lineTotal: Number(l.lineTotal ?? 0),
        }));
        rows.push({
            id: String(inv._id),
            type: isReturn ? "return" : "sale",
            channel: "سایت",
            number: inv.number,
            customer: [inv.addressSnapshot?.fname, inv.addressSnapshot?.lname].filter(Boolean).join(" ") || "—",
            phone: inv.addressSnapshot?.phone || "",
            amount: Number(inv.grandTotal ?? 0), // تومان
            shippingTotal: Number(inv.shippingTotal ?? 0),
            discountTotal: Number(inv.discountTotal ?? 0),
            lines,
            createdAt: inv.createdAt ?? null,
            paymentMethod: inv.paymentMethod || "",
            synced: Boolean(marker?.erpcode),
            erpcode: marker?.erpcode || "",
            holooNumber: marker?.number || "",
            syncedAt: marker?.syncedAt || null,
            skipped: Boolean(marker?.skipped),
            skipReason: marker?.reason || "",
        });
    }

    // ── Marketplace orders (trackers): dgk / basalaam / snapp, with vendorId ─────
    const trackers = await TrackerModel.find(
        { serviceId: { $in: ["dgk", "basalaam", "snapp"] }, vendorId: { $nin: [null, ""] } },
        { serviceId: 1, vendorId: 1, orderId: 1, amount: 1, discount: 1, items: 1, customerName: 1, customerPhone: 1, createdAt: 1 },
    )
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean();

    for (const t of trackers as any[]) {
        const serviceId = String(t.serviceId || "");
        const orderId = String(t.orderId || t._id || "");
        const marker = trackerMarker.get(`${serviceId}:${orderId}`);
        const label = SERVICE_LABEL[serviceId] || serviceId;
        const channel = t.vendorId ? `${label} ${t.vendorId}` : label;
        // Marketplace items carry title + quantity but no per-item price; show
        // titles/qty and the accurate order total (amount), not fake unit prices.
        const lines = (Array.isArray(t.items) ? t.items : []).map((it: any) => ({
            title: String(it?.title || "—"),
            qty: Number(it?.quantity || 1),
            unitPrice: 0,
            lineTotal: 0,
        }));
        rows.push({
            id: String(t._id),
            type: "marketplace",
            channel,
            number: orderId,
            customer: t.customerName || "—",
            phone: t.customerPhone || "",
            amount: toToman(t.amount), // tracker.amount is ریال → تومان
            shippingTotal: 0,
            discountTotal: toToman(t.discount),
            lines,
            createdAt: t.createdAt ?? null,
            paymentMethod: "",
            synced: Boolean(marker?.erpcode),
            erpcode: marker?.erpcode || "",
            holooNumber: marker?.number || "",
            syncedAt: marker?.syncedAt || null,
            skipped: Boolean(marker?.skipped),
            skipReason: marker?.reason || "",
        });
    }

    // ── Filter ──────────────────────────────────────────────────────────────────
    let filtered = rows;
    if (typeFilter !== "all") filtered = filtered.filter((r) => r.type === typeFilter);
    if (filter === "synced") filtered = filtered.filter((r) => r.synced);
    else if (filter === "pending") filtered = filtered.filter((r) => !r.synced);
    if (q) {
        filtered = filtered.filter(
            (r) =>
                r.number.toLowerCase().includes(q) ||
                r.customer.toLowerCase().includes(q) ||
                r.phone.toLowerCase().includes(q) ||
                r.channel.toLowerCase().includes(q),
        );
    }

    // ── Sort (newest first) + paginate in-memory ────────────────────────────────
    filtered.sort((a, b) => {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
    });

    const total = filtered.length;
    const items = filtered.slice((page - 1) * size, (page - 1) * size + size);
    const syncedTotal = rows.filter((r) => r.synced).length;

    return NextResponse.json({
        items,
        syncedTotal,
        pager: { page, size, total, totalPages: Math.max(1, Math.ceil(total / size)) },
    });
}
