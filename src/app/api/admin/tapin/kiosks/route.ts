import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requirePermission } from '@/lib/auth';
import { getTapinKiosks } from '@/services/tapin/orders';
import { TapinError } from '@/services/tapin/client';

const schema = z.object({
  provinceCode: z.coerce.number().int().positive(),
  cityCode: z.coerce.number().int().positive(),
  shopId: z.string().uuid().optional(),
});

export async function GET(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  try {
    const params = new URL(request.url).searchParams;
    const input = schema.parse({
      provinceCode: params.get('provinceCode'),
      cityCode: params.get('cityCode'),
      shopId: params.get('shopId') || undefined,
    });
    return NextResponse.json({
      data: await getTapinKiosks(input.provinceCode, input.cityCode, input.shopId),
    });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    if (error instanceof TapinError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'دریافت کیوسک‌های تاپین ناموفق بود.' }, { status: 502 });
  }
}
