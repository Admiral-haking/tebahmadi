import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { requirePermission } from '@/lib/auth';
import { deleteSlide } from '@/content/services/slideService';
import { zObjectIdString } from '@/lib/z';

const paramsSchema = z.object({ id: zObjectIdString });

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  await connectMongoose();
  await requirePermission(request, 'catalog:publish');

  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const removed = await deleteSlide(parsed.data.id);
  if (!removed) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

