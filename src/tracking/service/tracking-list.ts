import { FilterQuery } from "mongoose"
import { TrackerModel } from "../model"
import { enrichTrackingRecords } from "./enrich-tracking";

type Props = {
    serviceId: string
    orderStatus: string
    progressState: string
    shippingServiceName: string
    location: string
    hasTrackingCode: string
    enrich: boolean
    search: string
    from: Date
    to: Date
    page: number
    perPage: number
}

const TRACKING_LIST_PROJECTION = {
    orderId: 1,
    amount: 1,
    vendorId: 1,
    items: 1,
    serviceId: 1,
    orderStatus: 1,
    progressState: 1,
    discount: 1,
    shippingServiceName: 1,
    shippingServiceId: 1,
    customerName: 1,
    customerPhone: 1,
    customerPostalCode: 1,
    customerAddress: 1,
    customerCity: 1,
    customerState: 1,
    customerHouseNumber: 1,
    customerHouseUnit: 1,
    createdAt: 1,
    updatedAt: 1,
};

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildTrackingListMatch({
    search,
    serviceId,
    orderStatus,
    progressState,
    shippingServiceName,
    location,
    hasTrackingCode,
    from,
    to,
}: Partial<Props>): FilterQuery<any> {
    const match: FilterQuery<any> = {};

    if (search) {
        const regex = new RegExp(escapeRegExp(search), 'i');
        match.$or = [
            { 'items.trackingCode': regex },
            { shippingServiceName: regex },
            { shippingServiceId: regex },
            { 'items.title': regex },
            { 'items.serviceVariantId': regex },
            { orderId: regex },
            { orderStatus: regex },
            { progressState: regex },
            { customerName: regex },
            { customerPhone: regex },
            { customerPostalCode: regex },
            { customerAddress: regex },
            { customerCity: regex },
            { customerState: regex },
            { customerHouseNumber: regex },
            { customerHouseUnit: regex },
        ];
    }

    if (serviceId) match.serviceId = serviceId;
    if (orderStatus) match.orderStatus = orderStatus;
    if (progressState) match.progressState = progressState;
    if (shippingServiceName) match.shippingServiceName = new RegExp(escapeRegExp(shippingServiceName), 'i');
    if (location) {
        const regex = new RegExp(escapeRegExp(location), 'i');
        match.$and = [
            ...(Array.isArray(match.$and) ? match.$and : []),
            {
                $or: [
                    { customerCity: regex },
                    { customerState: regex },
                    { customerAddress: regex },
                    { customerPostalCode: regex },
                ],
            },
        ];
    }
    if (hasTrackingCode === 'yes') {
        match['items.trackingCode'] = { $exists: true, $nin: [null, ''] };
    } else if (hasTrackingCode === 'no') {
        match.$and = [
            ...(Array.isArray(match.$and) ? match.$and : []),
            {
                $or: [
                    { items: { $not: { $elemMatch: { trackingCode: { $exists: true, $nin: [null, ''] } } } } },
                    { items: { $size: 0 } },
                ],
            },
        ];
    }
    if (from || to) {
        match.createdAt = {};
        if (from) match.createdAt.$gte = from;
        if (to) match.createdAt.$lte = to;
    }

    return match;
}

export async function getTrackingList({
    page = 1,
    perPage = 50,
    search,
    serviceId,
    orderStatus,
    progressState,
    shippingServiceName,
    location,
    hasTrackingCode,
    from,
    to,
    enrich = false,
}: Partial<Props>) {
    const match = buildTrackingListMatch({
        search,
        serviceId,
        orderStatus,
        progressState,
        shippingServiceName,
        location,
        hasTrackingCode,
        from,
        to,
    });

    const sort = { createdAt: -1 }

    const skip = (page - 1) * perPage;

    const limit = Math.min(Math.max(perPage, 1), 100);

    const options = {
        sort, skip, limit
    }

    const dataQuery = enrich
        ? TrackerModel.find(match, null, options)
        : TrackerModel.find(match, TRACKING_LIST_PROJECTION, options).lean();

    const countQuery = TrackerModel.countDocuments(match);

    const [rawItems, count] = await Promise.all([dataQuery, countQuery]);

    let items: unknown[] = rawItems;
    if (enrich && items.length <= 100) {
        items = await enrichTrackingRecords(rawItems);
    }

    return {
        items,
        pagination: {
            page,
            perPage,
            total_rows: count,
            pages: Math.ceil(count / perPage)
        }
    }
}
