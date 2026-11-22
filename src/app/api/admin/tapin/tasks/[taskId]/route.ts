import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { getTapinTask } from '@/services/tapin/orders';
import { TapinError } from '@/services/tapin/client';

type Context = { params: Promise<{ taskId: string }> };

export async function GET(request: NextRequest, context: Context) {
  await requirePermission(request, 'orders:read');
  const taskId = (await context.params).taskId.trim();
  if (!taskId || taskId.length > 128 || !/^[a-z0-9-]+$/i.test(taskId)) {
    return NextResponse.json({ error: 'شناسه Task معتبر نیست.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ data: await getTapinTask(taskId) });
  } catch (error) {
    if (error instanceof TapinError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'دریافت جزئیات Task ناموفق بود.' }, { status: 502 });
  }
}
