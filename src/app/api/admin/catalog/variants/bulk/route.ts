import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { connectMongoose } from "@/lib/mongoose";
import { jsonError } from "@/lib/http";
import { patchVariant } from "@/catalog/services/variantsService";

export const runtime = "nodejs";

/**
 * PATCH /api/admin/catalog/variants/bulk — apply ONE change (active / quantity)
 * to many variants at once. Each variant is processed independently and the
 * response reports exactly how many succeeded / failed (with reasons), so one
 * bad item never silently drops the rest.
 *
 * Body: { ids: string[], active?: boolean, quantity?: number, sync?: boolean }
 */
const bodySchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "حداقل یک واریانت لازم است"),
  active: z.boolean().optional(),
  quantity: z.number().int().optional(),
  sync: z.boolean().optional().default(true),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, "بدنه نامعتبر است");
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message || "درخواست نامعتبر است");

  const { ids, active, quantity, sync } = parsed.data;
  if (active === undefined && quantity === undefined) {
    return jsonError(400, "هیچ تغییری مشخص نشده است");
  }

  await connectMongoose();

  const updates: { active?: boolean; quantity?: number } = {};
  if (active !== undefined) updates.active = active;
  if (quantity !== undefined) updates.quantity = Math.max(0, quantity); // never negative

  let succeeded = 0;
  const failed: { id: string; error: string }[] = [];
  for (const id of ids) {
    try {
      const res = await patchVariant({ variantId: id, updates }, sync);
      if (res) succeeded += 1;
      else failed.push({ id, error: "یافت نشد" });
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : "خطا" });
    }
  }

  return NextResponse.json({ ok: failed.length === 0, total: ids.length, succeeded, failed });
}
