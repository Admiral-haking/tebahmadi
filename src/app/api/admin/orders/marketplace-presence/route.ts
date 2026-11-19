import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";

import { connectMongoose } from "@/lib/mongoose";
import { jsonError } from "@/lib/http";
import { requirePermission, HttpError } from "@/lib/auth";
import DgkVariantModel from "@/digikala/models/variants";
import SnapVariantModel from "@/snapp/models/variants";
import BslVariantModel from "@/basalaam/models/variants";

export const runtime = "nodejs";

/**
 * POST /api/admin/orders/marketplace-presence — given a set of SITE variant ids
 * (order-line variantIds), report which marketplaces each variant is linked on
 * (Digikala / Snapp / Basalam) with the platform ids, so an order can bridge to
 * the seller panels. We match on `variantId` (the site variant _id stored on the
 * marketplace variant records) — the order line's `sku` is NOT the marketplace
 * barcode, so matching by sku/barcode found nothing.
 *
 * Body: { variantIds: string[] }
 * Returns: { presence: { [variantId]: { dgk: [...], snp: [...], bsl: [...] } } }
 */
const bodySchema = z.object({
  variantIds: z.array(z.string().trim().min(1)).min(1).max(300),
});

type Presence = {
  dgk: { dgkProductId: number; dgkVariantId: number; vendorId: string; quantity: number; price: number }[];
  snp: { snpProductId: string; vendorId: string; quantity: number; price: number }[];
  bsl: { bslProductId: number; bslVariantId: number; vendorId: string; quantity: number; price: number; sku?: string }[];
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await requirePermission(req, "products:read");
  } catch (err) {
    if (err instanceof HttpError) return jsonError(err.status, err.message);
    throw err;
  }

  let raw: unknown;
  try { raw = await req.json(); } catch { return jsonError(400, "بدنه نامعتبر است"); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(400, "شناسه‌ها نامعتبر است");

  const ids = Array.from(new Set(parsed.data.variantIds.map((b) => b.trim()).filter((id) => Types.ObjectId.isValid(id))));
  if (!ids.length) return NextResponse.json({ presence: {} });
  const objectIds = ids.map((id) => new Types.ObjectId(id));
  await connectMongoose();

  const [dgk, snp, bsl] = await Promise.all([
    DgkVariantModel.find({ variantId: { $in: objectIds } }, { variantId: 1, dgkProductId: 1, dgkVariantId: 1, vendorId: 1, quantity: 1, price: 1 }).lean(),
    SnapVariantModel.find({ variantId: { $in: objectIds } }, { variantId: 1, snpProductId: 1, vendorId: 1, quantity: 1, price: 1 }).lean(),
    BslVariantModel.find({ variantId: { $in: objectIds } }, { variantId: 1, bslProductId: 1, bslVariantId: 1, vendorId: 1, quantity: 1, price: 1, sku: 1 }).lean(),
  ]);

  const result: Record<string, Presence> = {};
  const ensure = (vid: string): Presence => (result[vid] ??= { dgk: [], snp: [], bsl: [] });

  for (const d of dgk as any[]) ensure(String(d.variantId)).dgk.push({ dgkProductId: d.dgkProductId, dgkVariantId: d.dgkVariantId, vendorId: d.vendorId, quantity: d.quantity ?? 0, price: d.price ?? 0 });
  for (const s of snp as any[]) ensure(String(s.variantId)).snp.push({ snpProductId: String(s.snpProductId), vendorId: s.vendorId, quantity: s.quantity ?? 0, price: s.price ?? 0 });
  for (const b of bsl as any[]) ensure(String(b.variantId)).bsl.push({ bslProductId: b.bslProductId, bslVariantId: b.bslVariantId, vendorId: b.vendorId, quantity: b.quantity ?? 0, price: b.price ?? 0, sku: b.sku });

  return NextResponse.json({ presence: result });
}
