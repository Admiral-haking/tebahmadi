import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth";
import { getServiceInfo, setServiceInfo } from "@/settings/services/servicesService";

export const runtime = "nodejs";

const preferenceSchema = z.object({
  vendorId: z.string().trim().min(1),
  callbackUrl: z.string().trim().optional().default(""),
  defaultWarehouseId: z.string().trim().optional().default(""),
  defaultBoxSizeId: z.string().trim().optional().default(""),
  defaultCityIds: z.string().trim().optional().default(""),
  defaultTimeScopeIds: z.string().trim().optional().default(""),
  defaultCancellationReasonId: z.string().trim().optional().default(""),
  defaultLeadTime: z.string().trim().optional().default(""),
  questionAnswerTemplate: z.string().trim().optional().default(""),
});

export type DigikalaOpenApiPreferences = z.infer<typeof preferenceSchema>;

export async function GET(req: NextRequest) {
  await requirePermission(req, "products:read");

  const vendorId = req.nextUrl.searchParams.get("vendorId")?.trim();
  if (!vendorId) return NextResponse.json({ error: "vendorId is needed" }, { status: 400 });

  const data = await getServiceInfo<Partial<DigikalaOpenApiPreferences>>("dgk", "open-api-preferences", vendorId);
  return NextResponse.json({ data: data ?? {} });
}

export async function POST(req: NextRequest) {
  await requirePermission(req, "products:write");

  const data = preferenceSchema.parse(await req.json());
  await setServiceInfo("dgk", "open-api-preferences", data.vendorId, data);
  return NextResponse.json({ data });
}
