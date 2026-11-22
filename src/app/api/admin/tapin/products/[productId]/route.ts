import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requirePermission } from '@/lib/auth';
import { deleteTapinProduct, updateTapinProduct } from '@/services/tapin/products';
import { tapinProductInputSchema } from '@/services/tapin/product-validation';
import { TapinError } from '@/services/tapin/client';
import { actorFromUser, logAuditLater, requestContext } from '@/observability/audit-log';

type Context = { params: Promise<{ productId: string }> };
function id(raw: string) {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}
function failure(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json({ error: error.flatten() }, { status: 400 });
  if (error instanceof TapinError)
    return NextResponse.json(
      { error: error.message, details: error.data },
      { status: error.status },
    );
  return NextResponse.json({ error: 'عملیات محصول تاپین ناموفق بود.' }, { status: 502 });
}
export async function PATCH(request: NextRequest, context: Context) {
  const user = await requirePermission(request, 'orders:write');
  const productId = id((await context.params).productId);
  if (!productId) return NextResponse.json({ error: 'شناسه محصول معتبر نیست.' }, { status: 400 });
  try {
    const input = tapinProductInputSchema.parse(await request.json());
    const shopId = new URL(request.url).searchParams.get('shopId')?.trim() || undefined;
    const data = await updateTapinProduct(productId, input, shopId);
    logAuditLater({
      action: 'update',
      entity: 'tapinProduct',
      entityId: String(productId),
      entityLabel: input.title,
      summary: 'ویرایش محصول تاپین',
      actor: actorFromUser(user),
      metadata: { shopId },
      ...requestContext(request),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: NextRequest, context: Context) {
  const user = await requirePermission(request, 'orders:write');
  const productId = id((await context.params).productId);
  if (!productId) return NextResponse.json({ error: 'شناسه محصول معتبر نیست.' }, { status: 400 });
  try {
    const shopId = new URL(request.url).searchParams.get('shopId')?.trim() || undefined;
    const data = await deleteTapinProduct(productId, shopId);
    logAuditLater({
      action: 'delete',
      entity: 'tapinProduct',
      entityId: String(productId),
      summary: 'حذف محصول از تاپین',
      actor: actorFromUser(user),
      severity: 'high',
      metadata: { shopId },
      ...requestContext(request),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return failure(error);
  }
}
