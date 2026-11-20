/**
 * Next.js instrumentation hook. Installs a process-level safety net so a stray
 * unhandled promise rejection — e.g. from a background sync running fire-and-
 * forget in the worker — is logged instead of crashing the whole process (Node's
 * default on unhandledRejection is to exit, which orphaned the running sync job
 * and made it loop forever as "interrupted").
 */
export async function register() {
    // Access the Node process through globalThis so the instrumentation module
    // remains valid when Next analyzes it for the Edge runtime as well.
    type NodeProcessLike = {
        env?: Record<string, string | undefined>;
        on?: (event: string, listener: (reason: unknown) => void) => void;
    };
    const nodeProcess = (globalThis as typeof globalThis & { process?: NodeProcessLike }).process;
    if (!nodeProcess || nodeProcess.env?.NEXT_RUNTIME === "edge" || typeof nodeProcess.on !== "function") return;

    const g = globalThis as typeof globalThis & { __syncRejectionGuard?: boolean };
    if (g.__syncRejectionGuard) return;
    g.__syncRejectionGuard = true;

    nodeProcess.on("unhandledRejection", (reason) => {
        console.error("[unhandledRejection]", reason instanceof Error ? reason.stack || reason.message : reason);
    });
}
