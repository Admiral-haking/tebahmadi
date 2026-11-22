import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requirePermission } from '@/lib/auth';
import { TapinError } from '@/services/tapin/client';
import { createTapinShop, getTapinShop, listTapinShops } from '@/services/tapin/orders';
import { tapinShopInputSchema } from '@/services/tapin/shop-validation';
import { actorFromUser, logAuditLater, requestContext } from '@/observability/audit-log';

function failure(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json({ error: error.flatten() }, { status: 400 });
  if (error instanceof TapinError)
    return NextResponse.json(
      { error: error.message, details: error.data },
      { status: error.status },
    );
  return NextResponse.json({ error: 'عملیات فروشگاه تاپین ناموفق بود.' }, { status: 502 });
}

export async function GET(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  try {
    const shopId = new URL(request.url).searchParams.get('shopId') || undefined;
    return NextResponse.json({
      data: shopId ? await getTapinShop(shopId) : await listTapinShops(),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'orders:write');
  try {
    const input = tapinShopInputSchema.parse(await request.json());
    const data = await createTapinShop(input);
    logAuditLater({
      action: 'create',
      entity: 'tapinShop',
      entityId: data.id,
      entityLabel: input.shop_name,
      summary: 'ثبت فروشگاه جدید در تاپین',
      actor: actorFromUser(user),
      ...requestContext(request),
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
