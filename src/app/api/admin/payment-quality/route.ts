import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth";
import { hasDeveloperAccess } from "@/lib/developer-access";
import { checkSnappPayEligibility, getPaymentQuality } from "@/payments/paymentQuality";

export const runtime = "nodejs";

const eligibilitySchema = z.object({
  gateway: z.literal("snapppay"),
  amountRial: z.coerce.number().int().positive().max(2_000_000_000).default(10_000_000),
});

export async function GET(req: NextRequest) {
  if (!hasDeveloperAccess(req)) {
    return NextResponse.json({ error: "developer_access_required" }, { status: 401 });
  }
  await requirePermission(req, "orders:read");
  return NextResponse.json({ data: getPaymentQuality() });
}

export async function POST(req: NextRequest) {
  if (!hasDeveloperAccess(req)) {
    return NextResponse.json({ error: "developer_access_required" }, { status: 401 });
  }
  await requirePermission(req, "orders:read");

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = eligibilitySchema.parse(body);
    const data = await checkSnappPayEligibility(parsed.amountRial);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}
