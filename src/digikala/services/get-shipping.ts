import { Get } from "@/utils/fetch";
import { dgkApiRoutes } from "../constants/routes";
import { forceDgkRefreshToken, getDgkToken } from "../utils/token";
import { TrackerModel } from "@/tracking";

export async function dgkSyncShippings(vendorId: string) {
    try {
        const trackings = await TrackerModel.find({ 'items.trackingCode': { $exists: false }, serviceId: 'dgk' }, null, {
            sort: { _id: -1 },
            limit: 1e3,
        })

        for (let index = 0; index < trackings.length; index++) {
            const tracking = trackings[index];

            try {
                const {
                    data: {
                        shipment_type,
                        city_name,
                        state_name,
                        shipping_service_order_detail: {
                            parcel_info
                        },
                        rate_limit: { current = 1, max = 2, resetTime } = {}
                    }
                } =
                    await Get<OrderShipmentResponse>(
                        dgkApiRoutes.shipping(Number(tracking.orderId.replace("dgk-", ""))),
                        {
                            'Authorization': `Bearer ${await getDgkToken(vendorId)}`
                        })


                tracking.shippingServiceId = shipment_type;
                tracking.shippingServiceName = shipment_type;

                for (let i = 0; i < parcel_info.length; i++) {
                    const { tracking_code, variants } = parcel_info[i];
                    for (let x = 0; x < variants.length; x++) {
                        const { product_variant_id, quantity, title, image } = variants[x];
                        const vIndex =
                            tracking.items.findIndex(x => x.serviceVariantId === `${product_variant_id}`)

                        if (vIndex < 0) continue;

                        tracking.items[vIndex].quantity = quantity;
                        tracking.items[vIndex].title = title;
                        tracking.items[vIndex].src = image;
                        tracking.items[vIndex].trackingCode = tracking_code;
                        tracking.items[vIndex].city = city_name;
                        tracking.items[vIndex].state = state_name;

                    }
                }

                await TrackerModel.updateOne({ _id: tracking._id }, {
                    $set: {
                        shippingServiceId: shipment_type,
                        shippingServiceName: shipment_type,
                        items: tracking.items
                    }
                })



                const rTime = new Date(resetTime?.date || Date.now() + 16e3).getTime();

                const diffMs = rTime - Date.now();

                await new Promise(res => setTimeout(res, max - current > 2 ? Math.ceil(diffMs / trackings.length) : diffMs + 5e3))
            } catch (err: any) {

                console.error("sync trackings failed", err?.message ?? err, err?.data);
                if (err?.status === 401) forceDgkRefreshToken(vendorId).catch(console.error)

                await new Promise(res => setTimeout(res, 6e4))
            }


        }
    }
    catch (err: any) {
        console.error("sync trackings failed", err?.message ?? err);
        if (err?.status === 401) forceDgkRefreshToken(vendorId).catch(console.error)
    }
}

// Optional version with partial fields
interface Variant {
    product_variant_id: number;
    title: string;
    image?: string; // Optional if image might be missing
    quantity: number;
}

interface ParcelInfo {
    box_size_name: string;
    shipping_service_order_id: number;
    shipping_service_shipment_id: number;
    weight: number;
    is_fragile: boolean;
    is_liquid: boolean;
    parcel_number: string;
    tracking_code: string;
    price: number;
    variants: Variant[];
    is_printable: boolean;
}

interface ShippingServiceOrderDetail {
    service: string;
    status: string;
    shipping_service_status: string;
    parcel_info: ParcelInfo[];
    pickup_start_date?: string; // Optional
    pickup_end_date?: string; // Optional
    total_price: number;
}

interface ShippingNature {
    title: string;
    text: string;
}

interface OrderShipmentData {
    order_id: number;
    order_shipment_id: number;
    created_at: string;
    promise_date: string;
    city_name: string;
    state_name: string;
    shipment_type: string;
    count_variants_in_shipment: number;
    order_shipment_price: number;
    shipment_status: string;
    shipping_nature: ShippingNature;
    shipping_service_order_detail: ShippingServiceOrderDetail;

    rate_limit: {
        max: number;
        current: number;
        resetTime: {
            date: string;
            timezone_type: number;
            timezone: string;
        };
    };
}

interface OrderShipmentResponse {
    status: string;
    data: OrderShipmentData;
}