import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requirePermission } from '@/lib/auth';
import { TapinError } from '@/services/tapin/client';
import { getTapinOrderStatusesBulk } from '@/services/tapin/orders';

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  shopId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  try {
    const input = schema.parse(await request.json());
    return NextResponse.json({ data: await getTapinOrderStatusesBulk(input.ids, input.shopId) });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    const status = error instanceof TapinError ? error.status : 502;
    return NextResponse.json({ error: 'دریافت وضعیت گروهی ناموفق بود.' }, { status });
  }
}
