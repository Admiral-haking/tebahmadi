import { z } from 'zod';

export const SUPPORT_CATEGORIES = ['general', 'order', 'product', 'payment', 'shipping', 'technical'] as const;
export const SUPPORT_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const SUPPORT_STATUSES = ['open', 'in_progress', 'waiting_for_customer', 'resolved', 'closed'] as const;

export const supportTicketCreateSchema = z.object({
  title: z.string().trim().min(3, 'عنوان تیکت را کامل کنید.').max(160, 'عنوان تیکت بیش از حد طولانی است.'),
  message: z.string().trim().min(10, 'شرح درخواست را کامل‌تر بنویسید.').max(5000, 'شرح درخواست بیش از حد طولانی است.'),
  category: z.enum(SUPPORT_CATEGORIES).default('general'),
  priority: z.enum(SUPPORT_PRIORITIES).default('normal'),
  name: z.string().trim().max(120, 'نام بیش از حد طولانی است.').optional().or(z.literal('')),
  phone: z.string().trim().max(32, 'شماره تماس معتبر نیست.').optional().or(z.literal('')),
  email: z.string().trim().email('ایمیل معتبر نیست.').max(160, 'ایمیل بیش از حد طولانی است.').optional().or(z.literal('')),
});

export type SupportTicketCreateInput = z.infer<typeof supportTicketCreateSchema>;

export function normalizeIranianMobile(input: string): string | null {
  const latinDigits = input
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  let digits = latinDigits.trim().replace(/^00/, '+').replace(/[^+\d]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);

  if (/^09\d{9}$/.test(digits)) return `+98${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+98${digits}`;
  if (/^98\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}
