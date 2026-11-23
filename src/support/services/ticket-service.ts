import { nanoid } from 'nanoid';
import { Types, type FilterQuery } from 'mongoose';
import SupportTicketModel, { type SupportTicketSchema } from '../models/SupportTicket';
import type {
  SupportReplyAuthorRole,
  SupportTicketCategory,
  SupportTicketDTO,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../types';

export type SupportTicketLike = Omit<SupportTicketSchema, 'createdAt' | 'updatedAt'> & {
  _id: Types.ObjectId | string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function stringId(value: Types.ObjectId | string | undefined): string | undefined {
  if (!value) return undefined;
  return String(value);
}

function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function serializeSupportTicket(ticket: SupportTicketLike): SupportTicketDTO {
  return {
    id: String(ticket._id),
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    message: ticket.message,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    requesterName: ticket.requesterName,
    contactPhone: ticket.contactPhone,
    contactEmail: ticket.contactEmail,
    attachmentId: stringId(ticket.attachmentId),
    replies: (ticket.replies ?? []).map((reply, index) => ({
      id: stringId(reply._id) ?? `${ticket._id}-reply-${index + 1}`,
      body: reply.body,
      authorRole: reply.authorRole,
      createdAt: isoDate(reply.createdAt),
    })),
    createdAt: isoDate(ticket.createdAt),
    updatedAt: isoDate(ticket.updatedAt),
  };
}

export interface CreateSupportTicketInput {
  title: string;
  message: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  userId?: Types.ObjectId;
  requesterName?: string;
  contactPhone?: string;
  contactEmail?: string;
  attachmentId?: Types.ObjectId;
}

export function createSupportTicketNumber(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `SUP-${date}-${nanoid(6).toUpperCase()}`;
}

export async function createSupportTicket(input: CreateSupportTicketInput) {
  return SupportTicketModel.create({
    ...input,
    ticketNumber: createSupportTicketNumber(),
    status: 'open',
    replies: [],
  });
}

export async function listUserSupportTickets(userId: Types.ObjectId) {
  const tickets = await SupportTicketModel.find({ userId }).sort({ createdAt: -1 }).limit(50).lean();
  return tickets.map((ticket) => serializeSupportTicket(ticket as unknown as SupportTicketLike));
}

export interface ListSupportTicketsOptions {
  page: number;
  limit: number;
  status?: SupportTicketStatus;
  search?: string;
}

export async function listSupportTickets({ page, limit, status, search }: ListSupportTicketsOptions) {
  const filter: FilterQuery<SupportTicketSchema> = {};
  if (status) filter.status = status;
  if (search?.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [{ ticketNumber: regex }, { title: regex }, { contactPhone: regex }, { requesterName: regex }];
  }

  const skip = (page - 1) * limit;
  const [tickets, total, stats] = await Promise.all([
    SupportTicketModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SupportTicketModel.countDocuments(filter),
    SupportTicketModel.aggregate<{ _id: SupportTicketStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const counts = stats.reduce<Record<string, number>>((result, row) => {
    result[row._id] = row.count;
    return result;
  }, {});

  return {
    items: tickets.map((ticket) => serializeSupportTicket(ticket as unknown as SupportTicketLike)),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    stats: {
      total,
      open: counts.open ?? 0,
      inProgress: counts.in_progress ?? 0,
      waitingForCustomer: counts.waiting_for_customer ?? 0,
      resolved: counts.resolved ?? 0,
      closed: counts.closed ?? 0,
    },
  };
}

export interface UpdateSupportTicketInput {
  status?: SupportTicketStatus;
  reply?: string;
  authorId?: Types.ObjectId;
}

export async function updateSupportTicket(id: Types.ObjectId, input: UpdateSupportTicketInput) {
  const update: Record<string, unknown> = {};
  if (input.status) update.status = input.status;
  if (input.reply?.trim()) {
    update.$push = {
      replies: {
        body: input.reply.trim(),
        authorId: input.authorId,
        authorRole: 'staff' satisfies SupportReplyAuthorRole,
        createdAt: new Date(),
      },
    };
  }

  if (Object.keys(update).length === 0) return null;
  return SupportTicketModel.findOneAndUpdate({ _id: id }, update, { new: true }).lean();
}
