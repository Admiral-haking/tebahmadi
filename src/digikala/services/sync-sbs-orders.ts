import { dgkOpenApiRequest } from "./open-api";
import { forceDgkRefreshToken } from "../utils/token";
import DgkOrder from "../models/orders";
import { TrackerModel } from "@/tracking";

/**
 * Sync "Ship-by-Seller" (SBS) orders from Digikala back onto the local order /
 * tracking records.
 *
 * The active-orders sync only ingests *new* orders and never revisits them, so a
 * tracker created there has no postal tracking code and its status is frozen at
 * the initial "pending". Once the seller hands the parcel to the carrier,
 * Digikala exposes the postal tracking code and the shipment status on the
 * ship-by-seller-orders endpoint — this sync brings those back so the site order
 * leaves "ready to ship" and shows its tracking code.
 */

type SbsStatus = { text?: string; text_fa?: string; level?: string };
type SbsVariant = { variantId?: number; orderItemId?: number; title?: string; count?: number };
type SbsOrder = {
    orderId?: number;
    shipmentId?: number;
    trackingCode?: string | null;
    status?: SbsStatus;
    variants?: SbsVariant[];
    address?: { state?: string; city?: string };
    customer_name?: string;
    customer_address?: string;
    customer_postal_code?: string;
    customer_phone_number?: string;
};

const SBS_MAX_PAGES = 30;

function mapSbsStatus(status: SbsStatus | undefined, trackingCode: string): "pending" | "processed" | "returned" | "canceled" {
    const level = (status?.level ?? status?.text ?? "").toLowerCase();
    switch (level) {
        case "processed":
        case "processing":
        case "edited":
        case "shipped":
        case "delivered":
            return "processed";
        case "returned":
        case "failed":
        case "failed_delivery":
            return "returned";
        case "canceled":
        case "cancelled":
        case "rejected":
            return "canceled";
    }

    // Shipped orders often have a null level but a Persian status text and a
    // postal tracking code — treat those as processed/shipped.
    const fa = status?.text_fa ?? "";
    if (/مرجوع|عودت/.test(fa)) return "returned";
    if (/لغو|رد شد/.test(fa)) return "canceled";
    if (trackingCode || /ارسال|تحویل|پست|حمل/.test(fa)) return "processed";
    return "pending";
}

export async function dgkSyncShipBySellerOrders(vendorId: string) {
    let page = 1;
    let pages = 1;

    try {
        while (page <= pages && page <= SBS_MAX_PAGES) {
            const res = await dgkOpenApiRequest<{ data?: { items?: SbsOrder[]; pager?: { total_pages?: number } } }>({
                vendorId,
                method: "GET",
                path: ["ship-by-seller-orders"],
                searchParams: new URLSearchParams({ page: String(page), size: "50", sort: "order_date", order: "desc" }),
            });

            const payload = res.data as { data?: { items?: SbsOrder[]; pager?: { total_pages?: number } }; items?: SbsOrder[]; pager?: { total_pages?: number } };
            const root = payload?.data ?? payload;
            const items: SbsOrder[] = root?.items ?? [];
            pages = Number(root?.pager?.total_pages ?? 1);

            for (const order of items) {
                const orderId = Number(order?.orderId);
                if (!Number.isFinite(orderId)) continue;

                const trackingCode = String(order?.trackingCode ?? "").trim();
                const statusFa = String(order?.status?.text_fa ?? "").trim();
                const mappedStatus = mapSbsStatus(order?.status, trackingCode);

                // 1) Reflect the real shipment status on the local order rows.
                await DgkOrder.updateMany({ dgkOrderId: orderId }, { $set: { status: mappedStatus } });

                // 2) Push tracking code, status text and customer details onto the tracker.
                const tracker = await TrackerModel.findOne({ serviceId: "dgk", orderId: `dgk-${orderId}` });
                if (!tracker) continue;

                let dirty = false;

                if (trackingCode) {
                    for (const item of tracker.items) {
                        if (item.trackingCode !== trackingCode) {
                            item.trackingCode = trackingCode;
                            dirty = true;
                        }
                    }
                }

                if (statusFa && tracker.orderStatus !== statusFa) {
                    tracker.orderStatus = statusFa;
                    dirty = true;
                }

                const customer: Record<string, string | undefined> = {
                    customerName: order?.customer_name,
                    customerPhone: order?.customer_phone_number,
                    customerPostalCode: order?.customer_postal_code,
                    customerAddress: order?.customer_address,
                    customerCity: order?.address?.city,
                    customerState: order?.address?.state,
                };
                for (const [key, value] of Object.entries(customer)) {
                    const v = String(value ?? "").trim();
                    if (v && !(tracker as unknown as Record<string, unknown>)[key]) {
                        (tracker as unknown as Record<string, unknown>)[key] = v;
                        dirty = true;
                    }
                }

                if (dirty) await tracker.save();
            }

            page += 1;
            await new Promise((r) => setTimeout(r, 600));
        }
    } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        // SBS needs the "sbs_orders" scope — a vendor without it returns 401/403.
        if (status === 401) forceDgkRefreshToken(vendorId).catch(() => undefined);
        throw err;
    }
}
