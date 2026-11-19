import BslOrder from "@/basalaam/models/orders";
import BslVariantModel from "@/basalaam/models/variants";
import { bslOrderDetails } from "@/basalaam/services/order-details";
import DgkOrder from "@/digikala/models/orders";
import DgkVariantModel from "@/digikala/models/variants";
import { InvoiceModel } from "@/orders/models/Invoice";
import { getVendors } from "@/settings/services/vendorService";
import { snpGetOrderDetail, snpGetOrders, snpGetVendors } from "@/snapp/api";
import type { SnappOrder } from "@/snapp/api/type";
import SnpOrder from "@/snapp/models/orders";
import SnapVariantModel from "@/snapp/models/variants";
import { normalizeTrackerItems } from "./tracker-items";
import type { Document } from "mongoose";

type TrackingItem = {
    serviceVariantId: string
    variantId?: unknown
    title?: string
    quantity?: number
    src?: string
    url?: string
    trackingCode?: string
}

type TrackingDoc = Document & {
    orderId: string
    vendorId?: string
    amount: number
    discount: number
    serviceId: string
    items: TrackingItem[]
    orderStatus?: string
    progressState?: string
    shippingServiceName?: string
    shippingServiceId?: string
    customerName?: string
    customerPhone?: string
    customerPostalCode?: string
    customerAddress?: string
    customerCity?: string
    customerState?: string
    customerHouseNumber?: string
    customerHouseUnit?: string
    set(path: string, value: unknown): TrackingDoc
    save(): Promise<TrackingDoc>
}

function hasValue(value: unknown): boolean {
    return value !== undefined && value !== null && `${value}`.trim().length > 0;
}

function setMissing(tracking: TrackingDoc, patch: Record<string, unknown>) {
    let changed = false;

    for (const [key, value] of Object.entries(patch)) {
        if (!hasValue(value)) continue;
        if (hasValue((tracking as unknown as Record<string, unknown>)[key])) continue;
        tracking.set(key, value);
        changed = true;
    }

    return changed;
}

function mergeItems(existing: TrackingItem[], incoming: TrackingItem[]) {
    const before = existing
        .map((item) => normalizeTrackerItems([item as never])[0])
        .filter(Boolean);
    const items = normalizeTrackerItems(existing as never);

    for (const row of normalizeTrackerItems(incoming as never)) {
        const serviceVariantId = `${row.serviceVariantId || ""}`;
        if (!serviceVariantId) continue;

        const variantId = row.variantId ? `${row.variantId}` : undefined;
        const index = items.findIndex((item) => {
            if (variantId && item.variantId && `${item.variantId}` === variantId) return true;
            return `${item.serviceVariantId}` === serviceVariantId;
        });
        if (index < 0) {
            items.push(row);
            continue;
        }

        for (const key of ["title", "quantity", "src", "url", "trackingCode", "variantId"] as const) {
            if (!hasValue(row[key])) continue;
            if (key === "title" && hasValue(items[index][key]) && `${items[index][key]}`.length < `${row[key]}`.length) {
                items[index][key] = row[key] as never;
                continue;
            }
            if (key !== "quantity" && hasValue(items[index][key])) continue;
            items[index][key] = row[key] as never;
        }
    }

    const changed = JSON.stringify(before) !== JSON.stringify(items);

    return { items, changed };
}

function parentTitle(parent: unknown): string | undefined {
    if (!parent || typeof parent !== "object") return undefined;
    const title = (parent as { title?: unknown }).title;
    return typeof title === "string" ? title : undefined;
}

async function enrichWebsiteTracking(tracking: TrackingDoc) {
    const invoice = await InvoiceModel.findOne({ number: tracking.orderId }).lean();
    if (!invoice) return false;

    const customerName = [invoice.addressSnapshot?.fname, invoice.addressSnapshot?.lname].filter(Boolean).join(" ");
    let changed = setMissing(tracking, {
        amount: invoice.grandTotal,
        discount: invoice.discountTotal,
        orderStatus: invoice.status,
        progressState: invoice.progress?.current,
        shippingServiceName: invoice.transportName,
        customerName,
        customerPhone: invoice.addressSnapshot?.phone,
        customerPostalCode: invoice.addressSnapshot?.postalCode,
        customerAddress: invoice.addressSnapshot?.address,
        customerCity: invoice.addressSnapshot?.city,
        customerState: invoice.addressSnapshot?.state,
    });

    const trackingCode = invoice.progress?.packagedPostedTrackingNumber ?? undefined;
    const { items, changed: itemsChanged } = mergeItems(tracking.items || [], (invoice.lines || []).map((line) => ({
        serviceVariantId: line.variantId?.toString() || line.sku || line.title,
        variantId: line.variantId,
        title: [line.title, line.variantSummary].filter(Boolean).join(" "),
        quantity: line.qty ?? line.requestedQty ?? 0,
        trackingCode,
    })));

    if (itemsChanged) {
        tracking.set("items", items);
        changed = true;
    }

    return changed;
}

async function enrichBasalaamTracking(tracking: TrackingDoc) {
    const orderId = Number(tracking.orderId.replace("bsl-", ""));
    if (!Number.isFinite(orderId)) return false;

    let changed = false;
    let vendorId = tracking.vendorId;

    if (!vendorId) {
        const variantIds = (tracking.items || []).map((item) => item.variantId).filter(Boolean);
        const serviceIds = (tracking.items || []).map((item) => Number(item.serviceVariantId)).filter(Number.isFinite);
        const variant = await BslVariantModel.findOne({
            $or: [
                { variantId: { $in: variantIds } },
                { bslVariantId: { $in: serviceIds } },
                { bslProductId: { $in: serviceIds } },
            ],
        }, { vendorId: 1 }).lean();
        vendorId = variant?.vendorId;
        if (vendorId) changed = setMissing(tracking, { vendorId }) || changed;
    }

    const localRows = await BslOrder.find({ bslOrderId: orderId }).lean();
    if (localRows.length) {
        const variants = await BslVariantModel.find({
            $or: [
                { bslVariantId: { $in: localRows.map((row) => row.bslVariantId) } },
                { bslProductId: { $in: localRows.map((row) => row.bslProductId) } },
            ],
        }).lean();
        const { items, changed: itemsChanged } = mergeItems(tracking.items || [], localRows.map((row) => {
            const variant = variants.find((item) => item.bslProductId === row.bslProductId && item.bslVariantId === row.bslVariantId);
            return {
                serviceVariantId: `${row.bslVariantId || row.bslProductId}`,
                variantId: variant?.variantId,
                title: row.title || variant?.displayName,
                quantity: row.quantity,
                src: row.bslImageUrl,
            };
        }));
        if (itemsChanged) {
            tracking.set("items", items);
            changed = true;
        }
    }

    if (!vendorId) return changed;

    try {
        const details = await bslOrderDetails(vendorId, orderId);
        const recipient = details.order?.customer?.recipient;
        changed = setMissing(tracking, {
            amount: details.total_items_price,
            orderStatus: details.status?.title,
            shippingServiceName: details.shipping_method?.current?.title,
            shippingServiceId: details.shipping_method?.current?.id,
            customerName: recipient?.name,
            customerPhone: recipient?.mobile,
            customerPostalCode: recipient?.postal_code,
            customerAddress: recipient?.postal_address,
            customerCity: details.order?.customer?.city?.title,
            customerState: parentTitle(details.order?.customer?.city?.parent),
            customerHouseNumber: recipient?.house_number,
            customerHouseUnit: recipient?.house_unit,
        }) || changed;

        const trackingCode = details.post_receipt?.tracking_code;
        const { items, changed: itemsChanged } = mergeItems(tracking.items || [], (details.items || []).map((row) => ({
            serviceVariantId: `${row.variation ? row.variation.id : row.product.id}`,
            title: row.title || row.product?.name,
            quantity: row.quantity,
            src: row.product?.photos?.[0]?.original,
            trackingCode,
        })));
        if (itemsChanged) {
            tracking.set("items", items);
            changed = true;
        }
    } catch (error) {
        console.error("Failed to enrich Basalaam tracking", tracking.orderId, error);
    }

    return changed;
}

async function findSnappLiveOrder(vendorId: string, orderNumber: number): Promise<SnappOrder | undefined> {
    const vendors = await snpGetVendors(vendorId);

    for (const vendor of vendors.data || []) {

        const response = await snpGetOrderDetail(vendorId, vendor.id, orderNumber.toString());

        const found = response.data;
        if (found) return found;
    }

    return undefined;
}

async function enrichSnappTracking(tracking: TrackingDoc) {
    const orderId = Number(tracking.orderId.replace("snp-", ""));
    if (!Number.isFinite(orderId)) return false;

    let changed = false;

    const localRows = await SnpOrder.find({ snpOrderId: orderId }).lean();
    if (localRows.length) {
        const serviceIds = localRows.map((row) => row.snpVariantId);
        const variants = await SnapVariantModel.find({
            $or: [
                { snpProductId: { $in: serviceIds } },
                { barcode: { $in: localRows.map((row) => row.barcode).filter(Boolean) } },
            ],
        }).lean();
        const { items, changed: itemsChanged } = mergeItems(tracking.items || [], localRows.map((row) => {
            const variant = variants.find((item) => item.snpProductId === row.snpVariantId || item.barcode === row.barcode);
            return {
                serviceVariantId: row.snpVariantId,
                variantId: variant?.variantId,
                title: row.title || variant?.displayName,
                quantity: row.quantity,
            };
        }));
        if (itemsChanged) {
            tracking.set("items", items);
            changed = true;
        }
    }

    const configuredVendors = await getVendors("snapp");
    const vendors = [
        tracking.vendorId,
        ...configuredVendors,
    ].filter((vendorId, index, list): vendorId is string => Boolean(vendorId) && list.indexOf(vendorId) === index);

    for (const vendorId of vendors) {
        try {
            const liveOrder = await findSnappLiveOrder(vendorId, orderId);
            if (!liveOrder) continue;
            if (tracking.vendorId !== vendorId) {
                tracking.set("vendorId", vendorId);
                changed = true;
            }

            const serviceIds = liveOrder.items.map((item) => item.vendor_product_info_id);
            const variants = await SnapVariantModel.find({
                vendorId,
                $or: [
                    { snpProductId: { $in: serviceIds } },
                    { barcode: { $in: liveOrder.items.map((item) => item.sku).filter(Boolean) } },
                ],
            }).lean();

            changed = setMissing(tracking, {
                orderStatus: liveOrder.order_status,
                customerName: [liveOrder.customer?.first_name, liveOrder.customer?.last_name].filter(Boolean).join(" "),
                customerPhone: liveOrder.customer?.phone || liveOrder.customer?.address?.phone,
                customerPostalCode: liveOrder.customer?.address?.postal_code,
                customerAddress: liveOrder.customer?.address?.address,
                customerCity: liveOrder.customer?.address?.city,
                customerState: liveOrder.customer?.address?.province,
                customerHouseNumber: liveOrder.customer?.address?.house_number,
                customerHouseUnit: liveOrder.customer?.address?.house_unit,
            }) || changed;

            const { items, changed: itemsChanged } = mergeItems(tracking.items || [], liveOrder.items.map((row) => {
                const variant = variants.find((item) => item.snpProductId === row.vendor_product_info_id || item.barcode === row.sku);
                return {
                    serviceVariantId: row.vendor_product_info_id,
                    variantId: variant?.variantId,
                    title: variant?.displayName || row.sku || row.vendor_product_info_id,
                    quantity: Math.max(row.quantity - (row.canceled_quantity || 0), 0),
                };
            }));
            if (itemsChanged) {
                tracking.set("items", items);
                changed = true;
            }
            return changed;
        } catch (error) {
            console.error("Failed to enrich Snapp tracking", tracking.orderId, error);
        }
    }

    return changed;
}

async function enrichDigikalaTracking(tracking: TrackingDoc) {
    const orderId = Number(tracking.orderId.replace("dgk-", ""));
    if (!Number.isFinite(orderId)) return false;

    const localRows = await DgkOrder.find({ dgkOrderId: orderId }).lean();
    if (!localRows.length) return false;

    const variants = await DgkVariantModel.find({
        dgkVariantId: { $in: localRows.map((row) => row.dgkVariantId) },
    }).lean();

    let changed = setMissing(tracking, {
        orderStatus: localRows[0]?.status,
    });

    const { items, changed: itemsChanged } = mergeItems(tracking.items || [], localRows.map((row) => {
        const variant = variants.find((item) => item.dgkVariantId === row.dgkVariantId);
        return {
            serviceVariantId: `${row.dgkVariantId}`,
            variantId: variant?.variantId,
            title: row.title || variant?.displayName,
            quantity: row.quantity,
            src: row.dgkImageUrl,
        };
    }));

    if (itemsChanged) {
        tracking.set("items", items);
        changed = true;
    }

    return changed;
}

export async function enrichTrackingRecord(tracking: TrackingDoc) {
    const changed =
        tracking.serviceId === "website" ? await enrichWebsiteTracking(tracking) :
            tracking.serviceId === "basalaam" ? await enrichBasalaamTracking(tracking) :
                tracking.serviceId === "snapp" ? await enrichSnappTracking(tracking) :
                    tracking.serviceId === "dgk" ? await enrichDigikalaTracking(tracking) :
                        false;

    if (changed) await tracking.save();
    return tracking;
}

export async function enrichTrackingRecords(items: TrackingDoc[]) {
    return Promise.all(items.map((item) => enrichTrackingRecord(item)));
}
