import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { serializeSupportTicket } from './services/ticket-service';

describe('support ticket serialization', () => {
  it('returns stable public identifiers and Persian-safe dates', () => {
    const createdAt = new Date('2026-11-23T08:00:00.000Z');
    const ticket = serializeSupportTicket({
      _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
      ticketNumber: 'SUP-20261123-ABC123',
      title: 'پیگیری سفارش',
      message: 'لطفاً وضعیت سفارش را بررسی کنید.',
      category: 'order',
      priority: 'normal',
      status: 'open',
      requesterName: 'علی احمدی',
      contactPhone: '+989120000000',
      replies: [],
      createdAt,
      updatedAt: createdAt,
    });

    expect(ticket.id).toBe('507f1f77bcf86cd799439011');
    expect(ticket.ticketNumber).toBe('SUP-20261123-ABC123');
    expect(ticket.contactPhone).toBe('+989120000000');
    expect(ticket.createdAt).toBe(createdAt.toISOString());
    expect(ticket.replies).toEqual([]);
  });
});
