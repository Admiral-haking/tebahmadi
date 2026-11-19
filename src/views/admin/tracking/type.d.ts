export interface TrackingListResponse {
    items: ITracker[];
    pagination: {
        page: number;
        perPage: number;
        total_rows: number;
        pages: number;
    };
}

interface ITracker {
    _id: string
    orderId: string
    amount: number
    vendorId?: string
    items: {
        serviceVariantId: string
        variantId?: string
        title: string
        quantity: number
        src?: string
        url?: string
        trackingCode?: string
        city?: string
        state?: string
    }[]
    serviceId: string
    orderStatus?: string
    progressState?: string
    discount: number
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
    createdAt: string
    updatedAt: string
}


export type ITRackServiceIdType = "dgk" | "basalaam" | "snapp" | 'website';
