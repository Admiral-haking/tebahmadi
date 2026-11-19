import { Get } from "@/utils/fetch";
import { bslApiRoutes } from "../constants/route";
import { bslBearerHeader } from "./auth";

export async function bslOrderDetails(vendorId: string, order_id: number) {
    const { headers } = await bslBearerHeader(vendorId);

    const res = await Get<BslOrderDetailsResponse>(bslApiRoutes.order_detail(order_id), headers);

    return res;
}
export interface BslOrderDetailsResponse {
    id: number;
    total_items_price: number;
    estimate_send_at: string;
    created_at: string;
    updated_at: string;
    confirmed_at: string;
    send_at: string;
    delivery_at: string;
    is_confirmed: boolean;
    is_send_date: boolean;
    is_delivered: boolean;
    has_delay: boolean;
    delay_days: number;
    shipping_cost: number;
    shipping_method: {
        current: {
            id: number;
            title: string;
        };
        default: {
            id: number;
            title: string;
        };
    };
    status: {
        id: number;
        title: string;
    };
    vendor: {
        id: number;
        identifier: string;
        title: string;
        city: {
            id: number;
            title: string;
            parent: Record<string, unknown>; // or a more specific type if known
        };
        owner: {
            id: number;
            hash_id: string;
            name: string;
            avatar: {
                id: number;
                original: string;
                format: string;
                resized: Record<string, string>;
            };
        };
        logo: {
            id: number;
            original: string;
            format: string;
            resized: Record<string, string>;
        };
    };
    items: Array<{
        id: number;
        title: string;
        quantity: number;
        weight: number;
        price: number;
        last_item_status: {
            id: number;
            status: {
                id: number;
                title: string;
            };
            operator: {
                id: number;
                title: string;
            };
            description: string;
            created_at: string;
            details: Record<string, unknown>;
        };
        max_refund_amount: number;
        product: {
            id: number;
            name: string;
            category_id: number;
            photos: Array<{
                id: number;
                original: string;
                format: string;
                resized: Record<string, string>;
            }>;
        };
        variation: {
            id: number;
            properties: Array<{
                property: {
                    id: number;
                    title: string;
                    type: string;
                };
                value: {
                    id: number;
                    title: string;
                    value: string;
                };
            }>;
        };
    }>;
    order: {
        id: number;
        paid_at: string;
        created_at: string;
        customer: {
            recipient: {
                name: string;
                mobile: string;
                postal_code: string;
                postal_address: string;
                latitude: number;
                longitude: number;
                house_number: string;
                house_unit: string;
            };
            city: {
                id: number;
                title: string;
                parent: Record<string, unknown>;
            };
            user: {
                id: number;
                hash_id: string;
                name: string;
                avatar: {
                    id: number;
                    original: string;
                    format: string;
                    resized: Record<string, string>;
                };
            };
        };
    };
    post_receipt: {
        id: number;
        tracking_code: string;
        final_post_cost: number;
        created_at: string;
        updated_at: string;
        tracking_link: string;
        phone_number: string;
        attachment: {
            id: number;
            original: string;
            format: string;
            resized: Record<string, string>;
        };
        editable: boolean;
        edited: boolean;
    };
}