/**
 * Run `fn` over `items` with bounded concurrency, never rejecting (one item's
 * failure doesn't abort the rest — like Promise.allSettled). Used to process
 * independent marketplace vendors in parallel: each vendor is a separate account
 * with its own rate limit, so they don't contend, and the (powerful) host can
 * sync them all at once instead of one-after-another.
 */
export async function mapConcurrent<T>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<unknown>,
): Promise<PromiseSettledResult<unknown>[]> {
    const results: PromiseSettledResult<unknown>[] = new Array(items.length);
    let cursor = 0;
    const workerCount = Math.max(1, Math.min(limit, items.length));

    const worker = async () => {
        while (cursor < items.length) {
            const index = cursor++;
            try {
                results[index] = { status: "fulfilled", value: await fn(items[index], index) };
            } catch (reason) {
                results[index] = { status: "rejected", reason };
            }
        }
    };

    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
}

/** Concurrency for parallel vendor processing — plenty for a powerful host. */
export const VENDOR_CONCURRENCY = 6;

/**
 * Concurrency for per-variant marketplace pushes WITHIN a single vendor. Each
 * vendor shares one rate limit, so this is kept modest while different vendors
 * still run fully in parallel — fast without tripping 429s.
 */
export const PUSH_CONCURRENCY = 4;
