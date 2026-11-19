import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { connectMongoose } from "@/lib/mongoose";
import { jsonError } from "@/lib/http";
import { requirePermission, HttpError } from "@/lib/auth";
import DgkVariantModel from "@/digikala/models/variants";
import SnapVariantModel from "@/snapp/models/variants";
import BslVariantModel from "@/basalaam/models/variants";

export const runtime = "nodejs";

/**
 * POST /api/admin/panel-data/reset — DESTRUCTIVE. Wipe the marketplace ↔ site
 * variant link tables (Digikala / Snapp / Basalam) so the admin can re-import
 * everything from scratch. Requires an explicit confirm string and products:write.
 *
 * It removes ONLY the local panel variant records (the mappings) — it does NOT
 * touch site products, orders, or anything on the marketplaces themselves.
 *
 * Body: { confirm: "DELETE", services?: ("dgk"|"snp"|"bsl")[] }
 */
const bodySchema = z.object({
  confirm: z.string(),
  services: z.array(z.enum(["dgk", "snp", "bsl"])).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requirePermission(req, "products:write");
  } catch (err) {
    if (err instanceof HttpError) return jsonError(err.status, err.message);
    throw err;
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonError(400, "بدنه نامعتبر است"); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(400, "درخواست نامعتبر است");
  if (parsed.data.confirm !== "DELETE") {
    return jsonError(400, "برای حذف باید عبارت تأیید را وارد کنید");
  }

  const services = parsed.data.services?.length ? parsed.data.services : (["dgk", "snp", "bsl"] as const);
  await connectMongoose();

  const deleted: Record<string, number> = {};
  if (services.includes("dgk")) deleted.dgk = (await DgkVariantModel.deleteMany({})).deletedCount ?? 0;
  if (services.includes("snp")) deleted.snp = (await SnapVariantModel.deleteMany({})).deletedCount ?? 0;
  if (services.includes("bsl")) deleted.bsl = (await BslVariantModel.deleteMany({})).deletedCount ?? 0;

  return NextResponse.json({ ok: true, deleted });
}
