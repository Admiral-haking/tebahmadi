import { NextResponse } from "next/server";

import { getHolooStatus } from "@/holoo";

export const runtime = "nodejs";

/** GET /api/holoo/status — config + live connection probe for the admin UI. */
export async function GET(): Promise<NextResponse> {
    const status = await getHolooStatus();
    return NextResponse.json(status, { status: status.connected ? 200 : 503 });
}
