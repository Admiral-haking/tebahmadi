import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { TapinError } from '@/services/tapin/client';
import { getTapinOrderItemsDocument } from '@/services/tapin/orders';

export async function GET(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  await requirePermission(request, 'orders:read');
  const orderId = Number((await context.params).orderId);
  if (!Number.isSafeInteger(orderId) || orderId < 1)
    return NextResponse.json({ error: 'شناسه سفارش نامعتبر است.' }, { status: 400 });
  try {
    const response = await getTapinOrderItemsDocument(orderId);
    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    const status = error instanceof TapinError ? error.status : 502;
    return NextResponse.json({ error: 'دریافت فهرست اقلام ناموفق بود.' }, { status });
  }
}
