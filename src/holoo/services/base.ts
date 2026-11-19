import { holooRequest } from "./client";
import { holooRoutes } from "../constants/routes";
import type { HolooMainGroup, HolooSideGroup, HolooUnit } from "../types";

/** GET /MainGroup — top-level product groups. */
export async function listHolooMainGroups(): Promise<HolooMainGroup[]> {
    const res = await holooRequest<{ mainGroup?: HolooMainGroup[] }>({
        method: "GET",
        path: holooRoutes.mainGroup,
    });
    return res?.mainGroup ?? [];
}

/** GET /SideGroup — sub groups (each links to a main group). */
export async function listHolooSideGroups(): Promise<HolooSideGroup[]> {
    const res = await holooRequest<{ sideGroup?: HolooSideGroup[] }>({
        method: "GET",
        path: holooRoutes.sideGroup,
    });
    return res?.sideGroup ?? [];
}

/** GET /Unit — measurement units. */
export async function listHolooUnits(): Promise<HolooUnit[]> {
    const res = await holooRequest<{ unit?: HolooUnit[] }>({
        method: "GET",
        path: holooRoutes.unit,
    });
    return res?.unit ?? [];
}
