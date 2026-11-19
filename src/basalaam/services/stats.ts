import { Get } from "@/utils/fetch";
import { bslApiRoutes } from "../constants/route";
import { bslBearerHeader } from "./auth";
import { bslOrders } from "./orders";

/**
 * Order stats (SDK docs section 7). Tries the dedicated stats endpoint; if it is
 * unavailable, derives the counts from the vendor-parcels list so the panel
 * always gets a usable summary (per-status counts) rather than an error.
 */
export type BslOrderStats = {
    total: number;
    byStatus: Record<string, number>;
    derived: boolean;
};

export async function bslGetOrdersStats(vendorId: string): Promise<BslOrderStats> {
    const { headers } = await bslBearerHeader(vendorId);
    try {
        const res = await Get<{ total?: number; data?: { status?: { id: number; title: string }; count?: number }[] }>(
            bslApiRoutes.orders_stats,
            headers,
        );
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (rows.length) {
            const byStatus: Record<string, number> = {};
            let total = 0;
            for (const r of rows) {
                const key = r.status?.title || String(r.status?.id ?? "?");
                const count = Number(r.count ?? 0);
                byStatus[key] = (byStatus[key] ?? 0) + count;
                total += count;
            }
            return { total: Number(res?.total ?? total), byStatus, derived: false };
        }
    } catch {
        // fall through to derived stats
    }

    // Derive from the first page(s) of parcels.
    const byStatus: Record<string, number> = {};
    let total = 0;
    let cursor: string | undefined;
    for (let page = 0; page < 10; page += 1) {
        const list = await bslOrders(vendorId, cursor).catch(() => undefined);
        const items = (list as { data?: { status?: { title?: string; id?: number } }[] } | undefined)?.data ?? [];
        for (const item of items) {
            const key = item.status?.title || String(item.status?.id ?? "?");
            byStatus[key] = (byStatus[key] ?? 0) + 1;
            total += 1;
        }
        const next = (list as { next_cursor?: string; meta?: { next_cursor?: string } } | undefined);
        cursor = next?.next_cursor ?? next?.meta?.next_cursor;
        if (!cursor || !items.length) break;
    }
    return { total, byStatus, derived: true };
}
