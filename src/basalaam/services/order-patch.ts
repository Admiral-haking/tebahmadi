import { POST } from "@/utils/fetch";
import { BSL_TRANSPORTS, bslApiRoutes } from "../constants/route";
import { bslBearerHeader } from "./auth";

export async function bslOrderAccept(vendorId: string, parcel_id: number) {
    const { headers } = await bslBearerHeader(vendorId);

    const res = await POST<{ result: true }>(bslApiRoutes.order_accept(parcel_id), {}, headers);

    return res;
}

export async function bslOrderSend(vendorId: string, parcel_id: number, shipping_method: BSL_TRANSPORTS, tracking_code: string) {
    const { headers } = await bslBearerHeader(vendorId);

    const res = await POST<{ result: true }>(bslApiRoutes.order_send(parcel_id), { shipping_method, tracking_code }, headers);

    return res;
}
