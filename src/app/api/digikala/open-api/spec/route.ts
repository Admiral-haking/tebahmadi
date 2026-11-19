import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getDgkOpenApiSpecSummary } from "@/digikala/services/open-api-spec";
import type { DgkOpenApiMethod } from "@/digikala/services/open-api";
import { requirePermission } from "@/lib/auth";

export const runtime = "nodejs";

const querySchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().trim().min(1),
});

export async function GET(req: NextRequest) {
  await requirePermission(req, "products:read");

  try {
    const input = querySchema.parse({
      method: req.nextUrl.searchParams.get("method"),
      path: req.nextUrl.searchParams.get("path"),
    });
    const data = await getDgkOpenApiSpecSummary(input.method as DgkOpenApiMethod, input.path);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "digikala_spec_failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
