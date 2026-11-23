import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { getAuth, HttpError, requireAuth } from '@/lib/auth';
import { jsonError } from '@/lib/http';
import UserModel from '@/models/User';
import { SiteInfoModel } from '@/settings/models/SiteInfo';
import { supportTicketCreateSchema, normalizeIranianMobile } from '@/support/validation';
import {
  createSupportTicket,
  listUserSupportTickets,
  serializeSupportTicket,
} from '@/support/services/ticket-service';
import {
  removeSupportAttachment,
  saveSupportAttachment,
  SupportAttachmentError,
} from '@/support/services/attachment-service';

export const runtime = 'nodejs';

function readString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

async function parseCreateRequest(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return { parsed: supportTicketCreateSchema.safeParse(await request.json()), attachment: null };
    } catch {
      return { parsed: supportTicketCreateSchema.safeParse(undefined), attachment: null };
    }
  }

  const formData = await request.formData();
  const parsed = supportTicketCreateSchema.safeParse({
    title: readString(formData.get('title')),
    message: readString(formData.get('message')),
    category: readString(formData.get('category')),
    priority: readString(formData.get('priority')),
    name: readString(formData.get('name')),
    phone: readString(formData.get('phone')),
    email: readString(formData.get('email')),
  });
  return { parsed, attachment: formData.get('attachment') };
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!Types.ObjectId.isValid(auth.sub)) return jsonError(401, 'نشست کاربری معتبر نیست.');
    await connectMongoose();
    const data = await listUserSupportTickets(new Types.ObjectId(auth.sub));
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof HttpError) return jsonError(error.status, 'برای مشاهده تیکت‌ها وارد حساب شوید.');
    console.error('Failed to list support tickets', error);
    return jsonError(500, 'دریافت تیکت‌های پشتیبانی ناموفق بود.');
  }
}

export async function POST(request: NextRequest) {
  let attachment;
  try {
    await connectMongoose();
    const siteInfo = await SiteInfoModel.findOne().select({ support: 1 }).lean();
    if (siteInfo?.support?.ticketEnabled === false) {
      return jsonError(503, 'ثبت تیکت پشتیبانی موقتاً غیرفعال است.');
    }
    const { parsed, attachment: attachmentInput } = await parseCreateRequest(request);
    if (!parsed.success) {
      return NextResponse.json({ error: 'اطلاعات تیکت کامل نیست.', details: parsed.error.flatten() }, { status: 400 });
    }

    const auth = getAuth(request);
    const userId = auth && Types.ObjectId.isValid(auth.sub) ? new Types.ObjectId(auth.sub) : undefined;
    const user = userId ? await UserModel.findById(userId).lean() : null;
    const contactPhone = user?.phone ?? (parsed.data.phone ? normalizeIranianMobile(parsed.data.phone) : null);
    if (!contactPhone) {
      return jsonError(400, 'برای پیگیری درخواست، شماره موبایل معتبر وارد کنید.');
    }

    const requesterName = parsed.data.name || [user?.fname, user?.lname].filter(Boolean).join(' ') || undefined;
    if (attachmentInput && typeof attachmentInput !== 'string') {
      attachment = await saveSupportAttachment(attachmentInput, userId);
    }

    const ticket = await createSupportTicket({
      title: parsed.data.title,
      message: parsed.data.message,
      category: parsed.data.category,
      priority: parsed.data.priority,
      userId,
      requesterName,
      contactPhone,
      contactEmail: parsed.data.email || undefined,
      attachmentId: attachment?._id,
    });

    return NextResponse.json({ data: serializeSupportTicket(ticket as unknown as Parameters<typeof serializeSupportTicket>[0]) }, { status: 201 });
  } catch (error) {
    if (attachment) {
      await removeSupportAttachment(attachment).catch((cleanupError) => {
        console.error('Failed to clean up support attachment', cleanupError);
      });
    }
    if (error instanceof SupportAttachmentError) return jsonError(error.status, error.message);
    console.error('Failed to create support ticket', error);
    return jsonError(500, 'ثبت تیکت پشتیبانی ناموفق بود. لطفاً دوباره تلاش کنید.');
  }
}
