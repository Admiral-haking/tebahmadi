import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, HttpError } from '@/lib/auth';
import { getTapinConfigFromEnv, registerTapin } from '@/integrations/tapin';

const schema = z.object({
  manualId: z.string().trim().min(1).max(128),
  provinceCode: z.coerce.number().int().positive(),
  cityCode: z.coerce.number().int().positive(),
  weightGrams: z.coerce.number().int().min(50).max(30000),
  recipient: z.object({
    name: z.string().trim().min(2).max(80),
    firstName: z.string().trim().min(1).max(30).optional(),
    lastName: z.string().trim().min(1).max(40).optional(),
    mobile: z.string().trim().regex(/^09\d{9}$/),
    address: z.string().trim().min(5).max(300),
    postalCode: z.string().trim().regex(/^\d{10}$/),
  }),
  items: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    quantity: z.coerce.number().int().positive(),
    priceToman: z.coerce.number().int().nonnegative(),
    weightGrams: z.coerce.number().int().nonnegative(),
  })).min(1),
  payType: z.coerce.number().int().min(0).max(3).optional(),
  orderType: z.coerce.number().int().refine((v) => [0, 1, 3, 5].includes(v)).optional(),
  packetType: z.coerce.number().int().min(1).max(3).optional(),
  contentType: z.coerce.number().int().min(1).max(4).optional(),
});

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, 'orders:write');
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'اطلاعات گیرنده، وزن یا اقلام مرسوله کامل نیست.' }, { status: 400 });
    const result = await registerTapin(getTapinConfigFromEnv(), parsed.data);
    return NextResponse.json({ ok: true, provider: 'tapin', data: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
    const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ثبت مرسوله ناموفق بود.' }, { status });
  }
}
