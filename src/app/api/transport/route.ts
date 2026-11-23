import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { isMongoConfigured } from '@/lib/preview-fallback';
import { TransportModel } from '@/orders/models/Transport';
import { transportCreateSchema } from '@/orders/validation/transportSchemas';
import { requirePermission } from '@/lib/auth';

export const runtime = 'nodejs';

const PREVIEW_TRANSPORTS = [
  {
    id: 'preview-pishtaz',
    _id: 'preview-pishtaz',
    name: 'پست پیشتاز سراسر کشور',
    description: 'ارسال مطمئن به تمام شهرهای ایران در ۲ تا ۴ روز کاری',
    isActive: true,
  },
  {
    id: 'preview-tipax',
    _id: 'preview-tipax',
    name: 'تیپاکس (تحویل سریع)',
    description: 'تحویل درب منزل با بسته‌بندی ایمن',
    isActive: true,
  },
];

export async function GET(request: NextRequest) {
  try {
    if (!isMongoConfigured()) {
      return NextResponse.json(
        { data: PREVIEW_TRANSPORTS },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    await connectMongoose();
    const url = new URL(request.url);
    const isActiveParam = url.searchParams.get('isActive');
    const query: Record<string, unknown> = {};
    if (isActiveParam !== null) {
      query.isActive = isActiveParam === 'true';
    }

    const carriers = await TransportModel.find(query).sort({ createdAt: -1 }).lean();
    const data = carriers.map((carrier) => ({
      ...carrier,
      _id: carrier._id.toString(),
      id: carrier._id.toString(),
    }));
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Failed to load transport methods', error);
    return NextResponse.json(
      { data: [], error: 'transport_unavailable' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': '3',
        },
      },
    );
  }
}

export async function POST(request: NextRequest) {
  await connectMongoose();
  const user = await requirePermission(request, 'orders:write');
  const privileged = new Set(['admin', 'manager']);
  if (!(user.roles ?? []).some((role) => privileged.has(role))) {
    return NextResponse.json({ error: 'forbidden_for_user' }, { status: 403 });
  }
  try {
    const json = await request.json();
    const parsed = transportCreateSchema.parse(json);
    const carrier = await TransportModel.create(parsed);
    return NextResponse.json({ data: carrier }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    const mongoError = error as { code?: number };
    if (mongoError?.code === 11000) {
      return NextResponse.json({ error: 'Carrier name already exists' }, { status: 409 });
    }
    console.error('Failed to create carrier', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
