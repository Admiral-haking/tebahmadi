import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requirePermission } from '@/lib/auth';
import { changeTapinOrdersStatus } from '@/services/tapin/orders';
import { TapinError } from '@/services/tapin/client';
import { actorFromUser, logAuditLater, requestContext } from '@/observability/audit-log';
import { runTapinStatusSync } from '@/services/tapin/sync';

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  status: z.union([z.literal(1), z.literal(2), z.literal(80)]),
  shopId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'orders:write');
  try {
    const input = schema.parse(await request.json());
    const data = await changeTapinOrdersStatus(input.ids, input.status, input.shopId);
    // Tapin accepts the bulk command asynchronously. Refresh our local shipment
    // ledger before reporting success so the admin panel does not show a stale
    // status as if the operation were already complete.
    const sync = await runTapinStatusSync();
    logAuditLater({
      action: 'update',
      entity: 'tapinShipment',
      summary: 'تغییر وضعیت گروهی مرسوله‌های تاپین',
      actor: actorFromUser(user),
      metadata: { ids: input.ids, status: input.status, shopId: input.shopId },
      ...requestContext(request),
    });
    return NextResponse.json({ data, sync });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    if (error instanceof TapinError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'عملیات گروهی تاپین ناموفق بود.' }, { status: 502 });
  }
}
