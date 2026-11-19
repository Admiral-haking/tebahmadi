import { connectMongoose } from "@/lib/mongoose";
import { logErrorLater } from "@/observability/error-log";
import { syncInventoryBackToServices, syncServicesOrders, syncServicesVariants } from "@/sync";
import { SyncJobModel, type SyncJobDocument } from "./model/job";

export type SyncJobType = "orders-from-services" | "stock-from-services" | "stock-to-services";
// A running job heartbeats its lock (see HEARTBEAT_MS) while it works, so a
// healthy-but-long sync is never seen as stale. Only a job whose process died
// (no more heartbeats) crosses this threshold and is requeued. Keep it a
// comfortable multiple of the heartbeat so a transient DB blip can't requeue a
// live job.
const STALE_RUNNING_JOB_MS = 12 * 60_000;
// How often a running job refreshes its lock. Must be well under the stale
// threshold above.
const HEARTBEAT_MS = 2 * 60_000;

// Process-wide guard: only one runDueSyncJobs pass executes at a time per
// process. Cron fires three job types every few minutes; without this they ran
// concurrently in the single worker, starved each other on marketplace rate
// limits, and tipped past the stale threshold into duplicate executions.
const runtimeState = globalThis as typeof globalThis & { __syncJobsInFlight?: boolean };

/**
 * Whether this process should execute background jobs in-process. The public web
 * instance sets DISABLE_BACKGROUND_JOBS=1 so heavy sync work runs only in the
 * dedicated worker instance; jobs are still enqueued everywhere and the worker
 * picks them up on its next tick.
 */
export function backgroundJobsEnabled(): boolean {
  return process.env.DISABLE_BACKGROUND_JOBS !== "1";
}

type EnqueueResult = {
  jobId: string;
  status: SyncJobDocument["status"];
  existing: boolean;
};

function getBackoffMs(attempts: number) {
  return Math.min(30 * 60_000, Math.max(1, attempts) * attempts * 60_000);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "sync_job_failed";
}

// A job whose worker died is reclaimed up to this many times before we give up,
// so a host that keeps getting killed mid-run can't loop a job forever.
const MAX_INTERRUPTIONS = 8;

async function releaseStaleRunningJobs() {
  const staleBefore = new Date(Date.now() - STALE_RUNNING_JOB_MS);

  // Abandon jobs interrupted too many times (worker repeatedly killed mid-run).
  await SyncJobModel.updateMany(
    { status: "running", lockedAt: { $lte: staleBefore }, interruptions: { $gte: MAX_INTERRUPTIONS } },
    {
      $set: {
        status: "failed",
        finishedAt: new Date(),
        lastError: "sync_job_abandoned_after_repeated_interruptions",
      },
      $unset: { lockedAt: "", startedAt: "" },
    },
  );

  // Requeue the rest, counting the interruption (NOT a failed attempt).
  await SyncJobModel.updateMany(
    { status: "running", lockedAt: { $lte: staleBefore } },
    {
      $set: {
        status: "queued",
        runAfter: new Date(),
        lastError: "sync_job_requeued_after_stale_lock",
      },
      $inc: { interruptions: 1 },
      $unset: { lockedAt: "", startedAt: "" },
    },
  );
}

/**
 * Run a job while keeping its lock fresh. The heartbeat updates lockedAt every
 * HEARTBEAT_MS so releaseStaleRunningJobs never requeues a live long job; if the
 * worker dies the heartbeat stops and the job is reclaimed after the stale
 * threshold.
 */
async function executeJobWithHeartbeat(job: SyncJobDocument) {
  const heartbeat = setInterval(() => {
    SyncJobModel.updateOne(
      { _id: job._id, status: "running" },
      { $set: { lockedAt: new Date() } },
    ).catch(() => { /* transient; the stale threshold tolerates a missed beat */ });
  }, HEARTBEAT_MS);
  // Don't keep the process alive just for the heartbeat.
  (heartbeat as unknown as { unref?: () => void }).unref?.();
  try {
    return await executeJob(job);
  } finally {
    clearInterval(heartbeat);
  }
}

async function executeJob(job: SyncJobDocument): Promise<Record<string, unknown> | undefined> {
  if (job.type === "orders-from-services") {
    const updatedAtFrom = new Date();
    await syncServicesOrders();
    const back = await syncInventoryBackToServices(updatedAtFrom);
    return { ...back };
  }

  if (job.type === "stock-from-services") {
    await syncServicesVariants();
    return undefined;
  }

  if (job.type === "stock-to-services") {
    const payload = job.payload as { updatedAtFrom?: string } | undefined;
    const updatedAtFrom = payload?.updatedAtFrom ? new Date(payload.updatedAtFrom) : undefined;
    const back = await syncInventoryBackToServices(updatedAtFrom);
    return { ...back };
  }
  return undefined;
}

export async function enqueueSyncJob(type: SyncJobType, payload?: Record<string, unknown>): Promise<EnqueueResult> {
  await connectMongoose();
  await releaseStaleRunningJobs();

  const existing = await SyncJobModel.findOne({ type, status: { $in: ["queued", "running"] } }).lean();
  if (existing) {
    return {
      jobId: String(existing._id),
      status: existing.status,
      existing: true,
    };
  }

  const job = await SyncJobModel.create({
    type,
    payload,
    status: "queued",
    attempts: 0,
    maxAttempts: 3,
    runAfter: new Date(),
  });

  return {
    jobId: String(job._id),
    status: job.status,
    existing: false,
  };
}

export async function runDueSyncJobs(limit = 3) {
  // Skip if a pass is already executing in this process — the queued jobs will
  // be picked up by the active pass or the next tick. Prevents concurrent,
  // mutually-starving syncs in the single worker.
  if (runtimeState.__syncJobsInFlight) {
    return [];
  }
  runtimeState.__syncJobsInFlight = true;
  try {
    return await runDueSyncJobsInner(limit);
  } catch (error) {
    // NEVER let this reject. It's invoked fire-and-forget (`void runDueSyncJobs()`),
    // so an escaping rejection becomes an unhandledRejection and crashes the whole
    // worker process mid-sync — orphaning the running job and looping it forever.
    logErrorLater({ category: "sync", source: "sync.queue.run", error });
    return [];
  } finally {
    runtimeState.__syncJobsInFlight = false;
  }
}

async function runDueSyncJobsInner(limit: number) {
  await connectMongoose();
  await releaseStaleRunningJobs();

  const results: Array<{ jobId: string; type: SyncJobType; status: SyncJobDocument["status"]; error?: string }> = [];

  for (let index = 0; index < limit; index += 1) {
    const now = new Date();
    const job = await SyncJobModel.findOneAndUpdate(
      {
        status: "queued",
        runAfter: { $lte: now },
      },
      {
        // Don't increment attempts here — a pickup may be a resume after an
        // interruption, which must not count as a failed retry. attempts is
        // bumped only when the job actually errors (below).
        $set: {
          status: "running",
          lockedAt: now,
          startedAt: now,
        },
      },
      { sort: { runAfter: 1, createdAt: 1 }, new: true },
    );

    if (!job) break;

    try {
      const metrics = await executeJobWithHeartbeat(job);
      const finishedAt = new Date();
      job.status = "succeeded";
      job.finishedAt = finishedAt;
      job.durationMs = job.startedAt ? finishedAt.getTime() - new Date(job.startedAt).getTime() : undefined;
      job.result = metrics ?? undefined;
      job.lockedAt = undefined;
      job.lastError = undefined;
      await job.save();
      results.push({ jobId: String(job._id), type: job.type as SyncJobType, status: "succeeded" });
    } catch (error) {
      const message = getErrorMessage(error);
      const attempts = Number(job.attempts ?? 0) + 1;
      job.attempts = attempts;
      const shouldRetry = attempts < Number(job.maxAttempts ?? 3);
      job.status = shouldRetry ? "queued" : "failed";
      job.lastError = message;
      job.lockedAt = undefined;
      job.finishedAt = shouldRetry ? undefined : new Date();
      job.runAfter = shouldRetry ? new Date(Date.now() + getBackoffMs(attempts)) : job.runAfter;
      await job.save();
      logErrorLater({
        category: "sync",
        source: `sync.queue.${job.type}`,
        error,
        metadata: {
          jobId: String(job._id),
          attempts,
          shouldRetry,
        },
      });
      results.push({ jobId: String(job._id), type: job.type as SyncJobType, status: job.status, error: message });
    }
  }

  return results;
}

export async function getSyncQueueStatus() {
  await connectMongoose();
  const [recentJobs, counts] = await Promise.all([
    SyncJobModel.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    SyncJobModel.aggregate<{ _id: SyncJobDocument["status"]; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  return {
    jobs: recentJobs.map((job) => ({
      id: String(job._id),
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      interruptions: job.interruptions ?? 0,
      runAfter: job.runAfter?.toISOString?.() ?? null,
      startedAt: job.startedAt?.toISOString?.() ?? null,
      finishedAt: job.finishedAt?.toISOString?.() ?? null,
      durationMs: typeof job.durationMs === "number" ? job.durationMs : null,
      result: (job.result as Record<string, unknown> | undefined) ?? null,
      lastError: job.lastError,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    })),
    counts: counts.reduce<Record<string, number>>((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
  };
}
