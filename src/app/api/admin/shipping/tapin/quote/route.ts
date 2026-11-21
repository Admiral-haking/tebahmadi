import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, HttpError } from '@/lib/auth';
import { getTapinConfigFromEnv, quoteTapin } from '@/integrations/tapin';

const inputSchema = z.object({
  provinceCode: z.coerce.number().int().positive(),
  cityCode: z.coerce.number().int().positive(),
  weightGrams: z.coerce.number().int().positive().max(100000),
});

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'orders:write');
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'اطلاعات وزن و مقصد معتبر نیست' }, { status: 400 });
    const data = await quoteTapin(getTapinConfigFromEnv(), parsed.data);
    return NextResponse.json({ ok: true, provider: 'tapin', data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : 'استعلام تاپین ناموفق بود';
    return NextResponse.json({ error: message }, { status: message === 'tapin_not_configured' ? 503 : 502 });
  }
}
