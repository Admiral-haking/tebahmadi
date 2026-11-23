import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { runTapinStatusSync } from '@/services/tapin/sync';
import { actorFromUser, logAuditLater, requestContext } from '@/observability/audit-log';

export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'orders:write');
  try {
    const body = await request.json().catch(() => ({}));
    const data = await runTapinStatusSync({ forceRetryFailures: body?.action === 'retry-failed' });
    logAuditLater({
      action: 'update',
      entity: 'tapinSync',
      summary: 'اجرای دستی همگام‌سازی وضعیت تاپین',
      actor: actorFromUser(user),
      metadata: data,
      ...requestContext(request),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'همگام‌سازی تاپین ناموفق بود.' },
      { status: 502 },
    );
  }
}
