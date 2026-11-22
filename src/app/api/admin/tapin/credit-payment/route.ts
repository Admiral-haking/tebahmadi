import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requirePermission } from '@/lib/auth';
import { createTapinCreditPayment } from '@/services/tapin/orders';
import { TapinError } from '@/services/tapin/client';
import { actorFromUser, logAuditLater, requestContext } from '@/observability/audit-log';

const schema = z.object({
  price: z.coerce.number().int().min(10_000).max(10_000_000_000),
  shopId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'orders:write');
  try {
    const { price, shopId } = schema.parse(await request.json());
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const payment = await createTapinCreditPayment(
      price,
      `${origin.replace(/\/$/, '')}/admin/tapin/payment-result`,
      shopId,
    );
    const url = new URL(payment.url);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('tapin.ir')) {
      return NextResponse.json({ error: 'نشانی درگاه تاپین معتبر نیست.' }, { status: 502 });
    }
    logAuditLater({
      action: 'create',
      entity: 'tapinCreditPayment',
      entityId: payment.transaction_pk,
      summary: 'ساخت تراکنش افزایش اعتبار تاپین',
      actor: actorFromUser(user),
      metadata: { price, shopId },
      ...requestContext(request),
    });
    return NextResponse.json({ data: payment });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof TapinError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'ساخت لینک افزایش اعتبار ناموفق بود.' }, { status: 502 });
  }
}
