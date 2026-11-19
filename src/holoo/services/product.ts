import { holooRequest } from "./client";
import { holooRoutes } from "../constants/routes";
import { resolveSidegroupForBarcode } from "./subgroup";
import { logErrorLater } from "@/observability/error-log";
import type {
    HolooProduct,
    HolooProductInput,
    HolooProductListParams,
    HolooProductUpdateInput,
    HolooSuccess,
} from "../types";

/** GET /Product — list goods, optionally filtered by code/group/date. */
export async function listHolooProducts(
    params: HolooProductListParams = {},
): Promise<HolooProduct[]> {
    const res = await holooRequest<{ product?: HolooProduct[] }>({
        method: "GET",
        path: holooRoutes.product,
        query: params as Record<string, string | boolean | undefined>,
    });
    return res?.product ?? [];
}

/** POST /Product — create a product under a side group. */
export async function createHolooProduct(
    input: HolooProductInput,
): Promise<HolooSuccess["Success"]> {
    const res = await holooRequest<HolooSuccess>({
        method: "POST",
        path: holooRoutes.product,
        body: { productinfo: [input] },
    });
    return res.Success;
}

/** PUT /Product — update an existing product by ErpCode. */
export async function updateHolooProduct(
    input: HolooProductUpdateInput,
): Promise<HolooSuccess["Success"]> {
    const res = await holooRequest<HolooSuccess>({
        method: "PUT",
        path: holooRoutes.product,
        body: { productinfo: [input] },
    });
    return res.Success;
}

// ─────────────────────────────────────────────────────────────
// Batch sync: site products → Holoo (per-item error isolation + retry)
// ─────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Log a product update + read the product back so the logs show whether Holoo
 * actually applied the new stock/price. Holoo's PUT /Product is known to accept
 * `sellprice` but often ignore `few` (stock is driven by inventory documents),
 * so this read-back is the only reliable way to confirm what changed.
 */
function logProductUpdate(
    barcode: string,
    erpcode: string,
    sentFew: number | undefined,
    sentSellprice: number | undefined,
    response: unknown,
): void {
    // Fire-and-forget read-back; never block or throw on the diagnostic path.
    void (async () => {
        let afterFew: string | undefined;
        let afterPrice: string | undefined;
        try {
            const rows = await listHolooProducts({ code: barcode });
            const p = rows.find((x) => x.ErpCode === erpcode) ?? rows[0];
            afterFew = p?.Few;
            afterPrice = p?.SellPrice;
        } catch {
            /* read-back failed — still log what we sent */
        }
        logErrorLater({
            level: "info",
            category: "system",
            source: "holoo.product-update",
            message: "holoo_product_update_result",
            metadata: {
                barcode, erpcode, sentFew, sentSellprice,
                holooFewAfter: afterFew, holooPriceAfter: afterPrice,
                response,
            },
        });
    })();
}

/** Transient (worth retrying): rate-limit and server errors. */
function isTransientHolooError(error: unknown): boolean {
    const status = Number(
        (error as { status?: unknown; holooCode?: unknown })?.status ??
            (error as { holooCode?: unknown })?.holooCode ??
            0,
    );
    return status === 429 || (status >= 500 && status < 600);
}

/**
 * Run a Holoo call with retry on transient errors (429 / 5xx). Backoff grows
 * 400ms → 800ms → 1600ms. Non-transient errors (e.g. duplicate code) throw
 * immediately so the caller can record them per-item without wasting retries.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (!isTransientHolooError(error) || i === attempts - 1) throw error;
            await sleep(400 * 2 ** i);
        }
    }
    throw lastError;
}

/** One product to push to Holoo, resolved from a site variant. */
export interface HolooBatchProductItem {
    /** Local identifier echoed back in the result (e.g. sku). */
    ref: string;
    /** Accounting code = the variant's barcode ("<prefix>-<seq>"). */
    barcode: string;
    name: string;
    /** Sell price in ریال (caller converts from toman if needed). */
    sellprice?: number;
    /** Current stock (موجودی) to set on the Holoo product. */
    few?: number;
    /**
     * When the caller already knows the Holoo ErpCode (e.g. reconcile found a
     * mismatch), pass it so we update directly — skipping the existence-check
     * GET. This halves the Holoo round-trips per item, which is what keeps a
     * chunk from hitting a 504 gateway timeout.
     */
    erpcode?: string;
}

export type HolooBatchItemResult =
    | { ref: string; ok: true; erpcode: string; action: "created" | "updated" }
    | { ref: string; ok: false; reason: string; detail?: string };

export interface HolooBatchReport {
    total: number;
    succeeded: number;
    failed: number;
    results: HolooBatchItemResult[];
}

/**
 * Push many products to Holoo, one by one, isolating failures so one bad item
 * never aborts the run. For each item we:
 *   1) resolve the SideGroup from the barcode prefix (skip if unmapped),
 *   2) reuse an existing Holoo product matched by code (idempotent — avoids the
 *      "duplicate code" / "duplicate name" errors), else
 *   3) create it, with retry on transient (429/5xx) errors.
 * Returns a per-item report of successes and failures.
 */
export async function batchSyncProductsToHoloo(
    items: HolooBatchProductItem[],
): Promise<HolooBatchReport> {
    const results: HolooBatchItemResult[] = [];

    for (const item of items) {
        const ref = item.ref;
        const barcode = String(item.barcode || "").trim();
        const name = String(item.name || "").trim();

        if (!barcode) {
            results.push({ ref, ok: false, reason: "no_barcode" });
            continue;
        }
        if (!name) {
            results.push({ ref, ok: false, reason: "no_name" });
            continue;
        }

        const few = Number.isFinite(item.few) ? Math.max(0, Math.round(item.few as number)) : undefined;
        const sellprice = item.sellprice && item.sellprice > 0 ? Math.round(item.sellprice) : undefined;
        const knownErp = String(item.erpcode || "").trim();

        try {
            // Fast path: ErpCode known (caller already located it) → update in a
            // single Holoo call, no existence-check GET.
            if (knownErp) {
                if (few !== undefined || sellprice !== undefined) {
                    const resp = await withRetry(() => updateHolooProduct({ erpcode: knownErp, few, sellprice }));
                    logProductUpdate(barcode, knownErp, few, sellprice, resp);
                }
                results.push({ ref, ok: true, erpcode: knownErp, action: "updated" });
                continue;
            }

            // Reuse an existing product by accounting code (idempotent on create).
            const existing = await withRetry(() => listHolooProducts({ code: barcode }));
            const match = existing.find((p) => p.ErpCode);
            if (match?.ErpCode) {
                // Already in Holoo — refresh its stock/price so موجودی stays correct.
                if (few !== undefined || sellprice !== undefined) {
                    const resp = await withRetry(() =>
                        updateHolooProduct({ erpcode: match.ErpCode, few, sellprice }),
                    );
                    logProductUpdate(barcode, match.ErpCode, few, sellprice, resp);
                }
                results.push({ ref, ok: true, erpcode: match.ErpCode, action: "updated" });
                continue;
            }

            // The SideGroup is whatever the admin linked this prefix to.
            const sg = await resolveSidegroupForBarcode(barcode);
            if (!sg) {
                results.push({ ref, ok: false, reason: "unmapped_prefix" });
                continue;
            }

            const created = await withRetry(() =>
                createHolooProduct({
                    name: name.slice(0, 150),
                    code: barcode,
                    sidegrouperpcode: sg.erpcode,
                    sellprice,
                    few,
                }),
            );
            results.push({ ref, ok: true, erpcode: created.ErpCode, action: "created" });
        } catch (error) {
            results.push({
                ref,
                ok: false,
                reason: isTransientHolooError(error) ? "transient_after_retries" : "error",
                detail:
                    (error as { message?: string })?.message ||
                    String((error as { holooCode?: unknown })?.holooCode ?? "unknown"),
            });
        }
    }

    const succeeded = results.filter((r) => r.ok).length;
    return { total: items.length, succeeded, failed: results.length - succeeded, results };
}
