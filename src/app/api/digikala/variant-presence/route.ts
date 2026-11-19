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
 * POST /api/digikala/variant-presence — for a set of Digikala variant ids
 * (active-order items), report which marketplaces/panels each is also linked on.
 * Resolves dgkVariantId → site variantId (stored on the dgk variant record), then
 * finds every panel (Digikala / Snapp / Basalam) sharing that site variant.
 *
 * Body: { dgkVariantIds: number[] }
 * Returns: { presence: { [dgkVariantId]: { dgk: [...], snp: [...], bsl: [...] } } }
 */
const bodySchema = z.object({
  dgkVariantIds: z.array(z.union([z.number(), z.string()])).min(1).max(300),
});

type Panel = { vendorId: string; quantity: number; price: number };
type Presence = {
  dgk: (Panel & { dgkProductId: number; dgkVariantId: number })[];
  snp: (Panel & { snpProductId: string })[];
  bsl: (Panel & { bslProductId: number; bslVariantId: number })[];
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

  const dgkIds = Array.from(new Set(parsed.data.dgkVariantIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))));
  if (!dgkIds.length) return NextResponse.json({ presence: {} });

  await connectMongoose();

  // 1) Resolve the source dgk variants → their site variantId.
  const sources = await DgkVariantModel.find(
    { dgkVariantId: { $in: dgkIds } },
    { dgkVariantId: 1, variantId: 1 },
  ).lean();

  // dgkVariantId → site variantId (string)
  const dgkToSite = new Map<number, string>();
  const siteIds: any[] = [];
  for (const s of sources as any[]) {
    if (s.variantId) {
      dgkToSite.set(Number(s.dgkVariantId), String(s.variantId));
      siteIds.push(s.variantId);
    }
  }
  if (!siteIds.length) return NextResponse.json({ presence: {} });

  // 2) Find every panel sharing those site variants.
  const [dgk, snp, bsl] = await Promise.all([
    DgkVariantModel.find({ variantId: { $in: siteIds } }, { variantId: 1, dgkProductId: 1, dgkVariantId: 1, vendorId: 1, quantity: 1, price: 1 }).lean(),
    SnapVariantModel.find({ variantId: { $in: siteIds } }, { variantId: 1, snpProductId: 1, vendorId: 1, quantity: 1, price: 1 }).lean(),
    BslVariantModel.find({ variantId: { $in: siteIds } }, { variantId: 1, bslProductId: 1, bslVariantId: 1, vendorId: 1, quantity: 1, price: 1 }).lean(),
  ]);

  // 3) Group by site variantId.
  const bySite: Record<string, Presence> = {};
  const ensure = (vid: string): Presence => (bySite[vid] ??= { dgk: [], snp: [], bsl: [] });
  for (const d of dgk as any[]) ensure(String(d.variantId)).dgk.push({ dgkProductId: d.dgkProductId, dgkVariantId: d.dgkVariantId, vendorId: d.vendorId, quantity: d.quantity ?? 0, price: d.price ?? 0 });
  for (const s of snp as any[]) ensure(String(s.variantId)).snp.push({ snpProductId: String(s.snpProductId), vendorId: s.vendorId, quantity: s.quantity ?? 0, price: s.price ?? 0 });
  for (const b of bsl as any[]) ensure(String(b.variantId)).bsl.push({ bslProductId: b.bslProductId, bslVariantId: b.bslVariantId, vendorId: b.vendorId, quantity: b.quantity ?? 0, price: b.price ?? 0 });

  // 4) Re-key by the requested dgkVariantId.
  const presence: Record<string, Presence> = {};
  for (const [dgkVid, siteId] of dgkToSite.entries()) {
    if (bySite[siteId]) presence[String(dgkVid)] = bySite[siteId];
  }

  return NextResponse.json({ presence });
}
