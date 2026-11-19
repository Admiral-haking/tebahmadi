import { PATCH } from "@/utils/fetch";
import { dgkApiRoutes } from "../constants/routes";
import { getDgkToken } from "../utils/token";
import DgkVariantModel from "../models/variants";

export async function getDgkPriceUpdate(vendorId: string, barcode: string, seller_price: number) {
    const items = await DgkVariantModel.find({ vendorId, barcode });

    for (let index = 0; index < items.length; index++) {
        const { dgkVariantId } = items[index];
        const { data: { rate_limit: { current = 1, max = 1, resetTime } = {} } } = await PATCH<{ data: PatchResponse }>(dgkApiRoutes.variant_price_update,
            {
                "variant_id": dgkVariantId,
                "selling_price": seller_price * 10,
                "credit_increase_percentage": 25
            }, {
                'Authorization': `Bearer ${await getDgkToken(vendorId)}`
            })

        await DgkVariantModel.updateOne(
            { _id: items[index]._id },
            { $set: { price: seller_price } }
        );


        const rTime = new Date(resetTime?.date || Date.now() + 6e4).getTime();
        const diffMs = Number.isFinite(rTime) ? Math.max(0, rTime - Date.now()) : 0;
        const waitMs = max - current > 2
            ? Math.min(1200, Math.max(250, Math.ceil(diffMs / Math.max(items.length, 1))))
            : Math.min(15000, diffMs + 1000);

        await new Promise(res => setTimeout(res, waitMs))
    }
}

interface PatchResponse {
    selling_price?: number;
    credit_increase_percentage?: number;
    rate_limit?: {
        max?: number;
        current?: number;
        resetTime?: {
            date?: string;
            timezone_type?: number;
            timezone?: string;
        };
    };
}
