import type { Types } from 'mongoose';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
} from './validation';

export { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_STATUSES } from './validation';

export type SupportTicketCategory = (typeof SUPPORT_CATEGORIES)[number];
export type SupportTicketPriority = (typeof SUPPORT_PRIORITIES)[number];
export type SupportTicketStatus = (typeof SUPPORT_STATUSES)[number];

export type SupportReplyAuthorRole = 'customer' | 'staff';

export interface SupportReplySchema {
  _id?: Types.ObjectId;
  body: string;
  authorId?: Types.ObjectId;
  authorRole: SupportReplyAuthorRole;
  createdAt: Date;
}

export interface SupportTicketDTO {
  id: string;
  ticketNumber: string;
  title: string;
  message: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  requesterName?: string;
  contactPhone?: string;
  contactEmail?: string;
  attachmentId?: string;
  replies: Array<{
    id: string;
    body: string;
    authorRole: SupportReplyAuthorRole;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export const SUPPORT_CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  general: 'عمومی',
  order: 'سفارش',
  product: 'محصول',
  payment: 'پرداخت',
  shipping: 'ارسال',
  technical: 'مشکل فنی',
};

export const SUPPORT_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: 'کم',
  normal: 'معمولی',
  high: 'زیاد',
  urgent: 'فوری',
};

export const SUPPORT_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'باز',
  in_progress: 'در حال بررسی',
  waiting_for_customer: 'منتظر پاسخ شما',
  resolved: 'حل‌شده',
  closed: 'بسته‌شده',
};
