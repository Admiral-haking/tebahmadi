import { NextRequest, NextResponse } from "next/server";

import { HttpError, requirePermission } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getSyncQueueStatus, runDueSyncJobs } from "@/sync/queue";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requirePermission(req, "orders:read");
    const data = await getSyncQueueStatus();
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    return jsonError(500, "Failed to load sync jobs");
  }
}

export async function POST(req: NextRequest) {
  try {
    await requirePermission(req, "orders:write");
    const results = await runDueSyncJobs(5);
    const data = await getSyncQueueStatus();
    return NextResponse.json({ ok: true, results, data });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, error.message);
    return jsonError(500, "Failed to run sync jobs");
  }
}
