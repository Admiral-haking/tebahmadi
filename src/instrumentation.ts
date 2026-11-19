/**
 * Next.js instrumentation hook. Installs a process-level safety net so a stray
 * unhandled promise rejection — e.g. from a background sync running fire-and-
 * forget in the worker — is logged instead of crashing the whole process (Node's
 * default on unhandledRejection is to exit, which orphaned the running sync job
 * and made it loop forever as "interrupted").
 */
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    const g = globalThis as typeof globalThis & { __syncRejectionGuard?: boolean };
    if (g.__syncRejectionGuard) return;
    g.__syncRejectionGuard = true;

    process.on("unhandledRejection", (reason) => {
        console.error("[unhandledRejection]", reason instanceof Error ? reason.stack || reason.message : reason);
    });
}
