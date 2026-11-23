import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { HttpError, requirePermission } from '@/lib/auth';
import { jsonError } from '@/lib/http';
import {
  listSupportTickets,
  serializeSupportTicket,
  updateSupportTicket,
  type SupportTicketLike,
} from '@/support/services/ticket-service';
import { SUPPORT_STATUSES } from '@/support/validation';

export const runtime = 'nodejs';

const updateSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'شناسه تیکت نامعتبر است.'),
  status: z.enum(SUPPORT_STATUSES).optional(),
  reply: z.string().trim().max(5000).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, 'orders:read');
    await connectMongoose();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const limit = Math.min(50, Math.max(10, Number(url.searchParams.get('limit') ?? 20) || 20));
    const rawStatus = url.searchParams.get('status') ?? undefined;
    const status = rawStatus && (SUPPORT_STATUSES as readonly string[]).includes(rawStatus)
      ? rawStatus as typeof SUPPORT_STATUSES[number]
      : undefined;
    const result = await listSupportTickets({
      page,
      limit,
      status,
      search: url.searchParams.get('q') ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, 'دسترسی به تیکت‌های پشتیبانی مجاز نیست.');
    console.error('Failed to list support tickets for admin', error);
    return jsonError(500, 'دریافت تیکت‌های پشتیبانی ناموفق بود.');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requirePermission(request, 'orders:write');
    await connectMongoose();
    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'اطلاعات بروزرسانی تیکت نامعتبر است.', details: parsed.error.flatten() }, { status: 400 });
    }
    if (!parsed.data.status && !parsed.data.reply?.trim()) {
      return jsonError(400, 'حداقل یک تغییر برای ذخیره وارد کنید.');
    }

    const updated = await updateSupportTicket(new Types.ObjectId(parsed.data.id), {
      status: parsed.data.status,
      reply: parsed.data.reply,
      authorId: admin._id,
    });
    if (!updated) return jsonError(404, 'تیکت پیدا نشد.');
    return NextResponse.json({ data: serializeSupportTicket(updated as unknown as SupportTicketLike) });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, 'دسترسی به بروزرسانی تیکت مجاز نیست.');
    console.error('Failed to update support ticket', error);
    return jsonError(500, 'بروزرسانی تیکت ناموفق بود.');
  }
}
