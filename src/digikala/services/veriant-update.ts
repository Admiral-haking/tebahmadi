import { PATCH, PUT } from "@/utils/fetch";
import { dgkApiRoutes } from "../constants/routes";
import { forceDgkRefreshToken, getDgkToken } from "../utils/token";
import DgkVariantModel from "../models/variants";
import { dgkGetProductVariants } from "./products";
import { logErrorLater } from "@/observability/error-log";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/** Wait suggested by a 429 body (rate_limit.resetTime), capped to 30s. */
function retryAfterMs(err: any): number {
    const reset = err?.data?.data?.rate_limit?.resetTime?.date ?? err?.data?.rate_limit?.resetTime?.date;
    const t = reset ? new Date(reset).getTime() : NaN;
    const diff = Number.isFinite(t) ? t - Date.now() : 0;
    return Math.min(30_000, Math.max(1_000, diff + 1_000));
}

export async function getDgkVariantUpdate(vendorId: string, barcode: string, seller_stock: number) {
    const items = await DgkVariantModel.find({ vendorId, barcode });

    for (let index = 0; index < items.length; index++) {
        const { dgkVariantId } = items[index];
        // One retry budget per item, used only for 429 (rate limit).
        for (let attempt = 1; attempt <= 2; attempt += 1) {
            try {
                const auth = { 'Authorization': `Bearer ${await getDgkToken(vendorId)}` };

                // Set the stock (including 0) via the dedicated seller-stock
                // endpoint, which accepts 0. The full variant PUT must NOT be used
                // just to change stock — it validates the whole variant and 400s
                // demanding unrelated fields (e.g. seller_lead_time), which is what
                // made setting stock to 0 silently fail.
                const next_stock = Math.max(0, Math.floor(seller_stock) || 0);
                const { data: { rate_limit: { current = 1, max = 1, resetTime } = {} } } = await PATCH<{ data: PatchResponse }>(dgkApiRoutes.variant_stock_update(dgkVariantId), { seller_stock: next_stock }, auth)
                if (next_stock > 0) {
                    // Best-effort re-activation only for positive stock; failure here
                    // (it needs the full variant payload) must not block the stock set.
                    await PUT(dgkApiRoutes.variant_update(dgkVariantId), { activation: true }, auth).catch(() => { });
                }

                await DgkVariantModel.updateMany(
                    { _id: items[index]._id },
                    { $set: { quantity: next_stock } }
                );

                const rTime = new Date(resetTime?.date || Date.now() + 6e4).getTime();
                const diffMs = Number.isFinite(rTime) ? Math.max(0, rTime - Date.now()) : 0;
                const waitMs = max - current > 2
                    ? Math.min(1200, Math.max(250, Math.ceil(diffMs / Math.max(items.length, 1))))
                    : Math.min(15000, diffMs + 1000);

                await sleep(waitMs);
                break; // success
            } catch (err: any) {
                const status = err?.status;
                if (status === 401) {
                    forceDgkRefreshToken(vendorId).catch(console.error);
                    break; // token refreshed; next back-sync run will retry this item
                }
                if (status === 429 && attempt < 2) {
                    await sleep(retryAfterMs(err)); // respect rate limit, then retry once
                    continue;
                }
                // Previously swallowed silently — surface it so the failure isn't lost.
                // Include Digikala's response body so the exact 400 reason is visible.
                logErrorLater({
                    category: "sync",
                    source: "digikala.stock-update",
                    error: err,
                    metadata: { vendorId, barcode, dgkVariantId, seller_stock, status, response: err?.data },
                });
                break;
            }
        }
    }
}

/**
 * Activate / deactivate every Digikala variant for a barcode (PUT
 * /variants/{id} { activation }). Used by the per-marketplace control panel.
 *
 * The variant PUT validates the whole variant and 400s without seller_lead_time,
 * so the current lead_time is fetched (once per product) and sent along.
 */
export async function getDgkActivation(vendorId: string, barcode: string, active: boolean) {
    const items = await DgkVariantModel.find({ vendorId, barcode });
    const auth = { 'Authorization': `Bearer ${await getDgkToken(vendorId)}` };

    const leadTimeByVariant = new Map<number, number>();
    const fetchedProducts = new Set<string>();

    for (let index = 0; index < items.length; index++) {
        const { dgkVariantId, dgkProductId } = items[index];
        try {
            const productKey = String(dgkProductId);
            if (dgkProductId && !fetchedProducts.has(productKey)) {
                fetchedProducts.add(productKey);
                try {
                    const res = await dgkGetProductVariants(vendorId, productKey);
                    for (const v of res.data.items) {
                        leadTimeByVariant.set(v.product_variant_id, v.lead_time);
                    }
                } catch { /* lead_time best-effort; PUT may still pass without it */ }
            }
            const leadTime = leadTimeByVariant.get(dgkVariantId);
            const body: Record<string, unknown> = {
                activation: active,
                ...(typeof leadTime === "number" && leadTime > 0 ? { seller_lead_time: leadTime } : {}),
            };
            await PUT(dgkApiRoutes.variant_update(dgkVariantId), body, auth);
            await sleep(400);
        } catch (err: any) {
            if (err?.status === 401) { forceDgkRefreshToken(vendorId).catch(() => {}); }
            logErrorLater({
                category: "sync",
                source: "digikala.activation",
                error: err,
                metadata: { vendorId, barcode, dgkVariantId, active, status: err?.status, response: err?.data },
            });
        }
    }
}

export async function updateDgkVariantStockById(vendorId: string, dgkVariantId: number, seller_stock: number) {
    const { data: { rate_limit: { current = 1, max = 1, resetTime } = {} } } = await PATCH<{ data: PatchResponse }>(
        dgkApiRoutes.variant_stock_update(dgkVariantId),
        { seller_stock },
        {
            'Authorization': `Bearer ${await getDgkToken(vendorId)}`
        }
    );

    await DgkVariantModel.updateMany(
        { vendorId, dgkVariantId },
        { $set: { quantity: seller_stock } }
    );

    return { ok: true, rate_limit: { current, max, resetTime } };
}

interface PatchResponse {
    selling_stock?: number;
    marketplace_seller_stock?: number;
    dk_warehouse_stock?: number;
    digikala_reservation?: number;
    seller_reservation?: number;
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
