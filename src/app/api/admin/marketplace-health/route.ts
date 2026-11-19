import { NextRequest, NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth";
import { connectMongoose } from "@/lib/mongoose";
import { getMarketplaceHealth } from "@/marketplace/health";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  await requirePermission(req, "orders:read");
  await connectMongoose();

  const data = await getMarketplaceHealth();
  return NextResponse.json({ data });
}
