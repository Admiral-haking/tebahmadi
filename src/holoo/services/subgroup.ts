/**
 * Accounting-code subgroup mapping.
 *
 * Each product's barcode IS its accounting code, formatted "<prefix>-<seq>"
 * (e.g. "001-2842115"). The prefix (the part before the first "-") identifies
 * the accounting bucket, and the admin links each prefix to a Holoo SideGroup
 * that they have created by hand. We never create SideGroups via the API — we
 * only read the saved `prefix → SideGroup ErpCode` map.
 */
import { getServiceInfo, setServiceInfo } from "@/settings/services/servicesService";

import { HOLOO_CONNECTION_ID } from "../constants/config";

/** servicesService key holding `{ [prefix]: sideGroupErpCode }`. */
export const PREFIX_MAP_KEY = "config:prefix_sidegroup_map";

export type PrefixSidegroupMap = Record<string, string>;

/**
 * Extract the accounting prefix from a barcode / accounting code.
 * "001-2842115" → "001". Returns null when there is no prefix segment.
 */
export function accountingPrefix(barcode: string | undefined | null): string | null {
    const code = String(barcode ?? "").trim();
    if (!code) return null;
    const dash = code.indexOf("-");
    if (dash <= 0) return null; // no prefix, or leading "-"
    return code.slice(0, dash).trim() || null;
}

/** Read the full prefix → SideGroup ErpCode map. */
export async function getPrefixSidegroupMap(): Promise<PrefixSidegroupMap> {
    const cfg = await getServiceInfo<PrefixSidegroupMap>(
        "holoo", PREFIX_MAP_KEY, HOLOO_CONNECTION_ID,
    );
    return cfg && typeof cfg === "object" ? cfg : {};
}

/** Persist the full map. */
export async function setPrefixSidegroupMap(map: PrefixSidegroupMap): Promise<void> {
    await setServiceInfo("holoo", PREFIX_MAP_KEY, HOLOO_CONNECTION_ID, map);
}

/**
 * Resolve the SideGroup ErpCode a barcode's accounting prefix maps to.
 * Returns null when the barcode has no prefix or the prefix is not yet linked
 * to a SideGroup — the caller must then skip (never guess/create).
 */
export async function resolveSidegroupForBarcode(
    barcode: string | undefined | null,
    map?: PrefixSidegroupMap,
): Promise<{ prefix: string; erpcode: string } | null> {
    const prefix = accountingPrefix(barcode);
    if (!prefix) return null;
    const table = map ?? (await getPrefixSidegroupMap());
    const erpcode = table[prefix];
    return erpcode ? { prefix, erpcode } : null;
}
