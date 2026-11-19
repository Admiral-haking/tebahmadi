import { connectMongoose } from "@/lib/mongoose";
import { getTrackingList, TrackerModel } from "@/tracking";
import { bslOrderAccept, bslOrderSend } from "@/basalaam/services/order-patch";
import BslVariantModel from "@/basalaam/models/variants";
import { InvoiceModel, type InvoiceDocument } from "@/orders/models/Invoice";
import { syncInvoiceTracker, updateInvoiceProgress, updateInvoiceStatus } from "@/orders/services/invoiceService";
import { INVOICE_PROGRESS_STATES, type InvoiceProgressState } from "@/orders/constants/progress";
import { NextRequest, NextResponse } from "next/server";

const INVOICE_STATUSES: InvoiceDocument['status'][] = ['draft', 'pending', 'paid', 'refunded', 'canceled'];

function isInvoiceStatus(value: string): value is InvoiceDocument['status'] {
    return INVOICE_STATUSES.includes(value as InvoiceDocument['status']);
}

function isInvoiceProgress(value: string): value is InvoiceProgressState {
    return (INVOICE_PROGRESS_STATES as readonly string[]).includes(value);
}

export async function GET(req: NextRequest) {

    await connectMongoose();

    const url = new URL(req.url);
    const search = url.searchParams.get('q') ?? undefined;
    const serviceId = url.searchParams.get('serviceId') ?? undefined;
    const orderStatus = url.searchParams.get('orderStatus') ?? undefined;
    const progressState = url.searchParams.get('progressState') ?? undefined;
    const shippingServiceName = url.searchParams.get('shippingServiceName') ?? undefined;
    const location = url.searchParams.get('location') ?? undefined;
    const hasTrackingCode = url.searchParams.get('hasTrackingCode') ?? undefined;
    const enrich = url.searchParams.get('enrich') === '1';
    const pageParam = url.searchParams.get('page');
    const limitParam = url.searchParams.get('limit');
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    const page = pageParam ? Number(pageParam) : 1
    const limit = limitParam ? Number(limitParam) : 50;
    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;
    if (to && !Number.isNaN(to.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(toParam || "")) {
        to.setHours(23, 59, 59, 999);
    }

    const response = await getTrackingList({
        page,
        perPage: limit,
        search,
        serviceId,
        orderStatus,
        progressState,
        shippingServiceName,
        location,
        hasTrackingCode,
        enrich,
        from: from && !Number.isNaN(from.getTime()) ? from : undefined,
        to: to && !Number.isNaN(to.getTime()) ? to : undefined,
    })

    const responseJson = NextResponse.json(response);
    responseJson.headers.set("Cache-Control", enrich ? "no-store" : "private, max-age=20, stale-while-revalidate=40");
    return responseJson;
}

export async function PATCH(req: NextRequest) {
    await connectMongoose();

    const payload = await req.json();
    const id = typeof payload.id === 'string' ? payload.id : '';
    const action = typeof payload.action === 'string' ? payload.action : '';

    const tracking = await TrackerModel.findById(id);
    if (!tracking) return NextResponse.json({ error: "Tracking record not found" }, { status: 404 });
    const trackingDoc = tracking;

    async function resolveBasalaamVendorId() {
        if (trackingDoc.vendorId) return trackingDoc.vendorId;

        const variantIds = trackingDoc.items.map((item) => item.variantId).filter(Boolean);
        const variant = await BslVariantModel.findOne({ variantId: { $in: variantIds } }, { vendorId: 1 }).lean();
        return variant?.vendorId;
    }

    if (action === 'basalaam-accept') {
        const vendorId = await resolveBasalaamVendorId();
        if (tracking.serviceId !== 'basalaam' || !vendorId) {
            return NextResponse.json({ error: "Basalaam vendorId is missing" }, { status: 400 });
        }

        await bslOrderAccept(vendorId, Number(tracking.orderId.replace("bsl-", "")));
        return NextResponse.json({ ok: true });
    }

    if (action === 'basalaam-send') {
        const vendorId = await resolveBasalaamVendorId();
        if (tracking.serviceId !== 'basalaam' || !vendorId) {
            return NextResponse.json({ error: "Basalaam vendorId is missing" }, { status: 400 });
        }

        const trackingCode = typeof payload.trackingCode === 'string' ? payload.trackingCode.trim() : '';
        const shippingServiceId = Number(payload.shippingServiceId || tracking.shippingServiceId);

        if (!trackingCode) return NextResponse.json({ error: "trackingCode is needed" }, { status: 400 });
        if (!shippingServiceId) return NextResponse.json({ error: "shippingServiceId is needed" }, { status: 400 });

        await bslOrderSend(vendorId, Number(tracking.orderId.replace("bsl-", "")), shippingServiceId, trackingCode);

        await TrackerModel.updateOne(
            { _id: tracking._id },
            {
                $set: {
                    vendorId,
                    shippingServiceId: `${shippingServiceId}`,
                    "items.$[].trackingCode": trackingCode
                }
            }
        );

        return NextResponse.json({ ok: true });
    }

    if (action === 'website-update') {
        if (tracking.serviceId !== 'website') {
            return NextResponse.json({ error: "Tracking record is not a website order" }, { status: 400 });
        }

        const invoice = await InvoiceModel.findOne({ number: tracking.orderId });
        if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

        const status = typeof payload.status === 'string' && isInvoiceStatus(payload.status) ? payload.status : undefined;
        const progress = typeof payload.progress === 'string' && isInvoiceProgress(payload.progress) ? payload.progress : undefined;
        const trackingCode = typeof payload.trackingCode === 'string' ? payload.trackingCode.trim() : undefined;
        const addressPatch: Record<string, string> = {};

        const addressFields = [
            ['fname', payload.customerFirstName],
            ['lname', payload.customerLastName],
            ['phone', payload.customerPhone],
            ['postalCode', payload.customerPostalCode],
            ['address', payload.customerAddress],
            ['city', payload.customerCity],
            ['state', payload.customerState],
        ] as const;

        for (const [key, value] of addressFields) {
            if (typeof value === 'string') addressPatch[`addressSnapshot.${key}`] = value.trim();
        }

        if (Object.keys(addressPatch).length) {
            await InvoiceModel.updateOne({ _id: invoice._id }, { $set: addressPatch });
        }

        if (status) {
            const result = await updateInvoiceStatus(invoice._id.toString(), status);
            if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
        }

        if (progress) {
            const result = await updateInvoiceProgress(invoice._id.toString(), progress, { trackingCode });
            if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
        }

        const updated = await InvoiceModel.findById(invoice._id);
        if (updated) await syncInvoiceTracker(updated);

        return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
