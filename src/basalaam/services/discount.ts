import { POST, DELETE } from "@/utils/fetch";
import { bslApiRoutes } from "../constants/route";
import { bslBearerHeader } from "./auth";

/**
 * Basalam product discounts (SDK docs section 5): create_discount / delete_discount.
 * A discount is applied to a set of products by percentage (and an optional active
 * window). Endpoint path follows the v1 gateway convention; confirm against the
 * gateway reference if Basalam changes it.
 */

export type BslCreateDiscount = {
    product_ids: number[];
    /** Discount percent, 1..99. */
    discount_percent: number;
    active_from?: string;
    active_to?: string;
};

export async function bslCreateDiscount(vendorId: string, request: BslCreateDiscount) {
    const { headers, vendor_id } = await bslBearerHeader(vendorId);
    const body = {
        product_ids: request.product_ids,
        discount_percent: Math.max(1, Math.min(99, Math.floor(request.discount_percent))),
        ...(request.active_from ? { active_from: request.active_from } : {}),
        ...(request.active_to ? { active_to: request.active_to } : {}),
    };
    return POST<Record<string, unknown>>(bslApiRoutes.create_discount(vendor_id), body, headers);
}

export async function bslDeleteDiscount(vendorId: string, product_ids: number[]) {
    const { headers, vendor_id } = await bslBearerHeader(vendorId);
    return DELETE<Record<string, unknown>>(bslApiRoutes.delete_discount(vendor_id), headers, { product_ids });
}
