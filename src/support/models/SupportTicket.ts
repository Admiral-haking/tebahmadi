import { model, models, Schema, Types, type HydratedDocument, type Model } from 'mongoose';
import type {
  SupportReplyAuthorRole,
  SupportReplySchema,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../types';
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES, SUPPORT_STATUSES } from '../validation';

export interface SupportTicketSchema {
  ticketNumber: string;
  title: string;
  message: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  userId?: Types.ObjectId;
  requesterName?: string;
  contactPhone?: string;
  contactEmail?: string;
  attachmentId?: Types.ObjectId;
  replies: SupportReplySchema[];
  createdAt: Date;
  updatedAt: Date;
}

export type SupportTicketDocument = HydratedDocument<SupportTicketSchema>;

const replySchema = new Schema<SupportReplySchema>(
  {
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    authorId: { type: Schema.Types.ObjectId, ref: 'User' },
    authorRole: { type: String, enum: ['customer', 'staff'] satisfies SupportReplyAuthorRole[], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true, versionKey: false },
);

const supportTicketSchema = new Schema<SupportTicketSchema>(
  {
    ticketNumber: { type: String, required: true, unique: true, index: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    category: { type: String, enum: [...SUPPORT_CATEGORIES], default: 'general', index: true },
    priority: { type: String, enum: [...SUPPORT_PRIORITIES], default: 'normal', index: true },
    status: { type: String, enum: [...SUPPORT_STATUSES], default: 'open', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    requesterName: { type: String, trim: true, maxlength: 120 },
    contactPhone: { type: String, trim: true, maxlength: 32 },
    contactEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
    attachmentId: { type: Schema.Types.ObjectId, ref: 'Media' },
    replies: { type: [replySchema], default: [] },
  },
  { timestamps: true },
);

supportTicketSchema.index({ createdAt: -1 });
supportTicketSchema.index({ status: 1, createdAt: -1 });

const SupportTicketModel: Model<SupportTicketSchema> =
  (models.SupportTicket as Model<SupportTicketSchema> | undefined) ||
  model<SupportTicketSchema>('SupportTicket', supportTicketSchema);

export default SupportTicketModel;
