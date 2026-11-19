import { DELETE } from "@/utils/fetch";
import { dgkApiRoutes } from "../constants/routes";
import { getDgkToken } from "../utils/token";
import { dgkSyncHistoryOrders } from "./sync-history-orders";

export async function dgkCancelOrder(
    vendorId: string,
    order_item_id: number,
    count: number,
    cancellation_reason_id: number,
) {
    // cancellation_reason_id comes from the order's meta_data.cancellation_reasons
    // (the map key). Sending an id the seller account doesn't expose is rejected,
    // so the caller must pass a real one chosen by the operator.
    await DELETE(dgkApiRoutes.cancel_order(order_item_id), {
        'Authorization': `Bearer ${await getDgkToken(vendorId)}`
    },
        {
            cancellation_reason_id,
            count
        });

    await dgkSyncHistoryOrders(vendorId)
}