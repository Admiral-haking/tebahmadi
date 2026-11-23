import { describe, expect, it } from 'vitest';
import { supportTicketCreateSchema } from './validation';

describe('support ticket input contract', () => {
  it('defaults optional category and priority for a valid ticket', () => {
    const result = supportTicketCreateSchema.safeParse({
      title: 'پیگیری سفارش',
      message: 'لطفاً وضعیت سفارش من را بررسی کنید.',
      phone: '۰۹۱۲۰۰۰۰۰۰۰۰',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('general');
      expect(result.data.priority).toBe('normal');
      expect(result.data.phone).toBe('۰۹۱۲۰۰۰۰۰۰۰۰');
    }
  });

  it('rejects an unsupported category and an empty message', () => {
    const result = supportTicketCreateSchema.safeParse({
      title: 'پیگیری',
      category: 'unknown',
      message: '   ',
    });

    expect(result.success).toBe(false);
  });
});
