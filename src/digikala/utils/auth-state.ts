/**
 * Circuit breaker for dead Digikala vendor auth. Once a vendor's refresh token
 * is dead (needs a manual re-auth from the panel), short-circuit further token
 * attempts for a cooldown instead of hammering Digikala and flooding the logs
 * with 401s page after page. Kept in its own module so token.ts and auth.ts can
 * both use it without an import cycle.
 */
const DGK_AUTH_DEAD_COOLDOWN_MS = 10 * 60_000;
const dgkAuthDeadUntil = new Map<string, number>();

export function markDgkAuthDead(vendorId: string) {
    dgkAuthDeadUntil.set(vendorId, Date.now() + DGK_AUTH_DEAD_COOLDOWN_MS);
}

export function clearDgkAuthDead(vendorId: string) {
    dgkAuthDeadUntil.delete(vendorId);
}

export function assertDgkAuthNotDead(vendorId: string) {
    const until = dgkAuthDeadUntil.get(vendorId);
    if (until && until > Date.now()) {
        const err = new Error("digikala_vendor_reauth_required") as Error & { status?: number; cooldown?: boolean };
        err.status = 401;
        err.cooldown = true;
        throw err;
    }
}
