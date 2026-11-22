import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth";
import { connectMongoose } from "@/lib/mongoose";
import { getMarketplaceHealth, syncFrozenMarketplaceListings } from "@/marketplace/health";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await requirePermission(req, "orders:read");
  await connectMongoose();

  const data = await getMarketplaceHealth();
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  await requirePermission(req, "products:write");
  await connectMongoose();

  const body = (await req.json().catch(() => ({}))) as { action?: unknown; limit?: unknown };
  if (body.action !== "sync-frozen-listings") {
    return NextResponse.json({ error: "unsupported_action" }, { status: 400 });
  }

  const limit = Number(body.limit);
  const result = await syncFrozenMarketplaceListings(Number.isFinite(limit) ? limit : 100);
  const data = await getMarketplaceHealth();
  return NextResponse.json({ ok: true, result, data });
}
