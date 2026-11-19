import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { connectMongoose } from "@/lib/mongoose";
import { requirePermission, HttpError } from "@/lib/auth";
import { jsonError } from "@/lib/http";

import { getDgkPriceUpdate } from "@/digikala/services/price-update";
import { getDgkVariantUpdate, getDgkActivation } from "@/digikala/services/veriant-update";
import { bslVariantPriceUpdate, bslVariantUpdate, bslVariantDiscountUpdate } from "@/basalaam/services/updateVarinat";
import { snpSyncPrice, snpSyncStock, snpSyncSpecialPrice } from "@/snapp/services/sync-stock";
import DgkVariantModel from "@/digikala/models/variants";
import BslVariantModel from "@/basalaam/models/variants";
import SnapVariantModel from "@/snapp/models/variants";

/**
 * Re-read the marketplace record's persisted price/stock after a push. The
 * per-service helpers only write the local cache on a SUCCESSFUL marketplace
 * call (and swallow failures), so this reflects what actually landed — letting
 * the UI show the real value instead of optimistically echoing the input
 * (which made a rejected stock of 0 look applied when it wasn't).
 */
async function readCurrent(service: "dgk" | "snp" | "bsl", vendorId: string, barcode: string) {
  const query = { vendorId, barcode };
  const projection = { price: 1, quantity: 1 } as const;
  const rec =
    service === "dgk"
      ? await DgkVariantModel.findOne(query, projection).lean()
      : service === "bsl"
        ? await BslVariantModel.findOne(query, projection).lean()
        : await SnapVariantModel.findOne(query, projection).lean();
  if (!rec) return null;
  return { price: Number(rec.price ?? 0), quantity: Number(rec.quantity ?? 0) };
}

export const runtime = "nodejs";

/**
 * PATCH /api/marketplace/variant-control — update a single linked variant on ONE
 * marketplace (independently of the others), by barcode/sku.
 *
 * Body: { service: "dgk"|"snp"|"bsl", vendorId, barcode, price?, stock?, active? }
 *   price  — تومان (each marketplace helper converts to its own unit)
 *   stock  — موجودی
 *   active — only Digikala supports an explicit toggle; Snapp/Basalam ignore it
 *            (deactivate by setting stock to 0).
 *
 * Reuses the same proven per-service helpers the bulk sync uses, so units and
 * auth are handled exactly the same way.
 */
const bodySchema = z.object({
  service: z.enum(["dgk", "snp", "bsl"]),
  vendorId: z.string().trim().min(1),
  barcode: z.string().trim().min(1),
  price: z.number().nonnegative().optional(),
  stock: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  // Phase 2 — discount (تخفیف). Snapp also accepts a time window.
  discountPrice: z.number().nonnegative().optional(),
  discountStart: z.string().trim().optional(),
  discountEnd: z.string().trim().optional(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    await requirePermission(req, "products:write");
  } catch (err) {
    if (err instanceof HttpError) return jsonError(err.status, err.message);
    throw err;
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message || "درخواست نامعتبر است");

  const { service, vendorId, barcode, price, stock, active, discountPrice, discountStart, discountEnd } = parsed.data;
  if (price === undefined && stock === undefined && active === undefined && discountPrice === undefined) {
    return jsonError(400, "حداقل یکی از قیمت / موجودی / وضعیت / تخفیف لازم است");
  }

  await connectMongoose();
  const applied: string[] = [];
  try {
    if (service === "dgk") {
      if (price !== undefined) { await getDgkPriceUpdate(vendorId, barcode, price); applied.push("price"); }
      if (stock !== undefined) { await getDgkVariantUpdate(vendorId, barcode, stock); applied.push("stock"); }
      if (active !== undefined) { await getDgkActivation(vendorId, barcode, active); applied.push("active"); }
      // Digikala's only per-variant price lever is the selling price; a discount is
      // simply a lower selling price (vs Digikala's reference price), so apply
      // discountPrice through the same selling-price endpoint.
      if (discountPrice !== undefined) { await getDgkPriceUpdate(vendorId, barcode, discountPrice); applied.push("discount"); }
    } else if (service === "bsl") {
      if (price !== undefined) { await bslVariantPriceUpdate(vendorId, barcode, price); applied.push("price"); }
      if (stock !== undefined) { await bslVariantUpdate(vendorId, barcode, stock); applied.push("stock"); }
      if (discountPrice !== undefined) { await bslVariantDiscountUpdate(vendorId, barcode, discountPrice); applied.push("discount"); }
      // Basalam has no simple active toggle here; stock 0 hides the variant.
    } else {
      // snapp — vendor-level helpers resolve the branch internally.
      if (price !== undefined) { await snpSyncPrice(vendorId, [{ sku: barcode, price }]); applied.push("price"); }
      if (stock !== undefined) { await snpSyncStock(vendorId, [{ sku: barcode, stock }]); applied.push("stock"); }
      if (discountPrice !== undefined) {
        await snpSyncSpecialPrice(vendorId, [{ sku: barcode, special_price: discountPrice, special_price_start_at: discountStart, special_price_end_at: discountEnd }]);
        applied.push("discount");
      }
    }
    const current = await readCurrent(service, vendorId, barcode);
    return NextResponse.json({ ok: true, service, applied, current });
  } catch (err) {
    const message = err instanceof Error ? err.message : "خطا در بروزرسانی مارکت‌پلیس";
    return jsonError(400, message);
  }
}
