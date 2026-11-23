import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { TapinError } from '@/services/tapin/client';
import { listTapinTasks } from '@/services/tapin/orders';

export async function GET(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get('page')) || 1);
  const count = Math.min(100, Math.max(1, Number(params.get('count')) || 20));
  try {
    return NextResponse.json({ data: await listTapinTasks(page, count) });
  } catch (error) {
    const status = error instanceof TapinError ? error.status : 502;
    return NextResponse.json({ error: 'دریافت Taskهای تاپین ناموفق بود.' }, { status });
  }
}
