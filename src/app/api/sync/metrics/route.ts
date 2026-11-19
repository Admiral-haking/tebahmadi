import { NextRequest, NextResponse } from "next/server";

import { getSyncQueueStatus } from "@/sync/queue";

export const runtime = "nodejs";

/**
 * Prometheus-format sync metrics for server monitoring.
 *
 * Public route (whitelisted in middleware) so a scraper can reach it; if
 * METRICS_TOKEN is set it must be supplied as ?token= or Authorization: Bearer.
 * Only aggregate counts/durations are exposed — no order or customer data.
 */
function authorized(req: NextRequest): boolean {
    const expected = process.env.METRICS_TOKEN;
    if (!expected) return true; // no token configured → open (aggregate-only data)
    const url = new URL(req.url);
    const fromQuery = url.searchParams.get("token");
    const fromHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    return fromQuery === expected || fromHeader === expected;
}

function line(name: string, value: number, labels?: Record<string, string>): string {
    const label = labels && Object.keys(labels).length
        ? `{${Object.entries(labels).map(([k, v]) => `${k}="${String(v).replace(/"/g, "")}"`).join(",")}}`
        : "";
    return `${name}${label} ${Number.isFinite(value) ? value : 0}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (!authorized(req)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const status = await getSyncQueueStatus();
    const lines: string[] = [];

    // Queue depth by status.
    lines.push("# HELP sync_jobs Sync jobs by status");
    lines.push("# TYPE sync_jobs gauge");
    for (const s of ["queued", "running", "succeeded", "failed"]) {
        lines.push(line("sync_jobs", Number(status.counts[s] ?? 0), { status: s }));
    }
    lines.push(line("sync_queue_waiting", Number(status.counts.queued ?? 0) + Number(status.counts.running ?? 0)));

    // Latest finished run per type → duration + push/reconcile outcome.
    const types = ["orders-from-services", "stock-from-services", "stock-to-services"] as const;
    lines.push("# HELP sync_last_duration_seconds Duration of the most recent run per type");
    lines.push("# TYPE sync_last_duration_seconds gauge");
    lines.push("# HELP sync_last_push Most recent back-sync push counts per type");
    lines.push("# TYPE sync_last_push gauge");

    for (const type of types) {
        const job = status.jobs.find((j) => j.type === type && typeof j.durationMs === "number");
        if (!job) continue;
        lines.push(line("sync_last_duration_seconds", (job.durationMs ?? 0) / 1000, { type }));

        const result = job.result as
            | { pushed?: { attempted?: number; succeeded?: number; failed?: number }; reconciled?: { attempted?: number; succeeded?: number; failed?: number } }
            | null
            | undefined;
        if (result?.pushed) {
            lines.push(line("sync_last_push", Number(result.pushed.succeeded ?? 0), { type, result: "succeeded" }));
            lines.push(line("sync_last_push", Number(result.pushed.failed ?? 0), { type, result: "failed" }));
        }
        if (result?.reconciled) {
            lines.push(line("sync_last_reconcile", Number(result.reconciled.succeeded ?? 0), { type, result: "succeeded" }));
            lines.push(line("sync_last_reconcile", Number(result.reconciled.failed ?? 0), { type, result: "failed" }));
        }
    }

    return new NextResponse(lines.join("\n") + "\n", {
        status: 200,
        headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
    });
}
