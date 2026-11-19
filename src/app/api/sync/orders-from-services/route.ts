import { backgroundJobsEnabled, enqueueSyncJob, runDueSyncJobs } from "@/sync/queue";
import { NextResponse } from "next/server";

export async function GET() {
    const job = await enqueueSyncJob("orders-from-services");
    if (backgroundJobsEnabled()) void runDueSyncJobs().catch(() => { /* never crash the worker */ });

    return NextResponse.json({
        status: job.existing ? "already_queued" : "queued",
        jobId: job.jobId,
        jobStatus: job.status,
    });
}
