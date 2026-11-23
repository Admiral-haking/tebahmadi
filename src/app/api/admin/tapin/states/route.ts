import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getTapinStates } from '@/services/tapin/orders';
import { TapinError } from '@/services/tapin/client';

export async function GET(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  try {
    return NextResponse.json({ data: await getTapinStates() });
  } catch (error) {
    if (error instanceof TapinError) {
      return NextResponse.json(
        { error: error.message, details: error.data },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: 'دریافت شهرهای تاپین ناموفق بود.' }, { status: 502 });
  }
}
