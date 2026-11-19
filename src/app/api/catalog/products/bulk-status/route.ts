import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { bulkUpdateProductStatus } from '@/catalog/services/productService';
import { requirePermission, HttpError } from '@/lib/auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, 'حداقل یک محصول لازم است'),
  status: z.enum(['draft', 'active', 'archived']),
});

/**
 * PATCH /api/catalog/products/bulk-status — change the publish status of many
 * products at once (admin group action from the products table).
 */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    await requirePermission(req, 'products:write');
  } catch (err) {
    if (err instanceof HttpError) return jsonError(err.status, err.message);
    throw err;
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message || 'درخواست نامعتبر است');
  }

  await connectMongoose();
  try {
    const modified = await bulkUpdateProductStatus(parsed.data.ids, parsed.data.status);
    return NextResponse.json({ modified });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update products';
    return jsonError(400, message);
  }
}
