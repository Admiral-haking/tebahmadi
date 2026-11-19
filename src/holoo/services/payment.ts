import { holooRequest } from "./client";
import { holooRoutes } from "../constants/routes";
import type { HolooHavalehInput, HolooReceiveInput, HolooSuccess } from "../types";

/** POST /Payment/Havaleh — record an account transfer (حواله طرف حساب). */
export async function createHolooHavaleh(
    input: HolooHavalehInput,
): Promise<HolooSuccess["Success"]> {
    const res = await holooRequest<HolooSuccess>({
        method: "POST",
        path: holooRoutes.havaleh,
        body: { payinfo: input },
    });
    return res.Success;
}

/** POST /Payment/ReceiveFromCustomer — record a receipt from an account. */
export async function createHolooReceive(
    input: HolooReceiveInput,
): Promise<HolooSuccess["Success"]> {
    const res = await holooRequest<HolooSuccess>({
        method: "POST",
        path: holooRoutes.receiveFromCustomer,
        body: { payinfo: input },
    });
    return res.Success;
}
