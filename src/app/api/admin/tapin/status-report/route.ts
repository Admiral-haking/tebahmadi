import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requirePermission } from '@/lib/auth';
import { getTapinStatusDaily, getTapinStatusRange } from '@/services/tapin/orders';
import { TapinError } from '@/services/tapin/client';

const schema = z.object({
  date: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  shopId: z.string().uuid().optional(),
});
export async function GET(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  try {
    const p = new URL(request.url).searchParams;
    const input = schema.parse({
      date: p.get('date') || undefined,
      fromDate: p.get('fromDate') || undefined,
      toDate: p.get('toDate') || undefined,
      page: p.get('page') || 1,
      shopId: p.get('shopId') || undefined,
    });
    if (!input.date && !(input.fromDate && input.toDate))
      return NextResponse.json({ error: 'تاریخ یا بازه تاریخی لازم است.' }, { status: 400 });
    const data = input.date
      ? await getTapinStatusDaily(input.date, input.page, input.shopId)
      : await getTapinStatusRange(input.fromDate!, input.toDate!, input.page, input.shopId);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    if (error instanceof TapinError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'گزارش وضعیت تاپین ناموفق بود.' }, { status: 502 });
  }
}
