import { holooRequest } from "./client";
import { holooRoutes } from "../constants/routes";
import type {
    HolooCustomer,
    HolooCustomerInput,
    HolooCustomerListParams,
    HolooCustomerUpdateInput,
    HolooSuccess,
} from "../types";

/** GET /Customer — list accounts (طرف حساب), optionally filtered. */
export async function listHolooCustomers(
    params: HolooCustomerListParams = {},
): Promise<HolooCustomer[]> {
    const res = await holooRequest<{ customer?: HolooCustomer[]; Customer?: HolooCustomer[] }>({
        method: "GET",
        path: holooRoutes.customer,
        query: params as Record<string, string | boolean | undefined>,
    });
    // This Holoo build returns the list under "Customer" (capitalised), unlike
    // the docs' lowercase "customer" — accept both.
    return res?.customer ?? res?.Customer ?? [];
}

/** POST /Customer — create an account. Returns its new ErpCode + codes. */
export async function createHolooCustomer(
    input: HolooCustomerInput,
): Promise<HolooSuccess["Success"]> {
    const res = await holooRequest<HolooSuccess>({
        method: "POST",
        path: holooRoutes.customer,
        body: { custinfo: [input] },
    });
    return res.Success;
}

/** PUT /Customer — update editable fields on an existing account. */
export async function updateHolooCustomer(
    input: HolooCustomerUpdateInput,
): Promise<HolooSuccess["Success"]> {
    const res = await holooRequest<HolooSuccess>({
        method: "PUT",
        path: holooRoutes.customer,
        body: { custinfo: input },
    });
    return res.Success;
}
