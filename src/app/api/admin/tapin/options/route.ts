import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getTapinPackingBoxes, getTapinStates, listTapinShops } from '@/services/tapin/orders';
import { TapinError } from '@/services/tapin/client';

export async function GET(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  try {
    const shopId = new URL(request.url).searchParams.get('shopId')?.trim() || undefined;
    const warnings: string[] = [];
    const optional = async <T>(label: string, promise: Promise<T>, fallback: T) => {
      try {
        return await promise;
      } catch {
        warnings.push(label);
        return fallback;
      }
    };
    const [states, boxes, shops] = await Promise.all([
      optional('استان‌ها و شهرها', getTapinStates(true), []),
      optional('بسته‌بندی‌ها', getTapinPackingBoxes(shopId, true), { list: [], total_count: 0 }),
      optional('فروشگاه‌ها', listTapinShops(true), { list: [], total_count: 0 }),
    ]);
    return NextResponse.json({
      data: { states, boxes: boxes.list ?? [], shops: shops.list ?? [], warnings },
    });
  } catch (error) {
    if (error instanceof TapinError) {
      return NextResponse.json(
        { error: error.message, details: error.data },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: 'دریافت تنظیمات تاپین ناموفق بود.' }, { status: 502 });
  }
}
