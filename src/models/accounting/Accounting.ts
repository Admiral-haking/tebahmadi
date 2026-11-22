import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const accountSchema = new Schema(
  {
    code: { type: String, required: true, trim: true, unique: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['asset', 'liability', 'equity', 'revenue', 'expense'],
    },
    parentId: { type: Schema.Types.ObjectId, index: true },
    active: { type: Boolean, default: true },
    system: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const journalLineSchema = new Schema(
  {
    accountId: { type: Schema.Types.ObjectId, required: true },
    accountCode: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    debit: { type: Number, required: true, min: 0, default: 0 },
    credit: { type: Number, required: true, min: 0, default: 0 },
    description: { type: String, trim: true },
  },
  { _id: false },
);

const journalSchema = new Schema(
  {
    number: { type: String, required: true, unique: true, trim: true },
    date: { type: Date, required: true, index: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: ['draft', 'posted', 'reversed'], default: 'draft', index: true },
    lines: { type: [journalLineSchema], required: true },
    sourceType: { type: String, trim: true, index: true },
    sourceId: { type: String, trim: true, index: true },
    periodId: { type: Schema.Types.ObjectId, index: true },
    reversalOf: { type: Schema.Types.ObjectId, index: true },
    reversedBy: { type: Schema.Types.ObjectId },
    postedAt: { type: Date },
    actorId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);
journalSchema.index({ sourceType: 1, sourceId: 1 }, { unique: true, sparse: true });

const expenseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, index: true },
    accountId: { type: Schema.Types.ObjectId },
    cashAccountId: { type: Schema.Types.ObjectId },
    vendor: { type: String, trim: true },
    reference: { type: String, trim: true },
    description: { type: String, trim: true },
    journalEntryId: { type: Schema.Types.ObjectId },
    status: { type: String, enum: ['draft', 'posted', 'void'], default: 'draft' },
  },
  { timestamps: true },
);

const cashAccountSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    kind: { type: String, required: true, enum: ['cash', 'bank', 'gateway', 'marketplace'] },
    accountId: { type: Schema.Types.ObjectId, required: true },
    bankName: { type: String, trim: true },
    iban: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const settlementLineSchema = new Schema(
  {
    invoiceId: { type: Schema.Types.ObjectId },
    platform: { type: String, trim: true },
    vendorId: { type: String, trim: true },
    orderId: { type: String, trim: true },
    orderItemId: { type: String, trim: true },
    calculationType: { type: String, trim: true },
    grossAmount: { type: Number, min: 0, default: 0 },
    feeAmount: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    otherDeduction: { type: Number, min: 0, default: 0 },
    netAmount: { type: Number, min: 0, default: 0 },
    matched: { type: Boolean, default: false },
    mismatchReason: { type: String, trim: true },
  },
  { _id: false },
);

const settlementSchema = new Schema(
  {
    provider: { type: String, required: true, trim: true, index: true },
    reference: { type: String, required: true, trim: true },
    currency: { type: String, enum: ['toman', 'rial'], default: 'toman', index: true },
    periodFrom: { type: Date, required: true },
    periodTo: { type: Date, required: true },
    settledAt: { type: Date, required: true, index: true },
    grossAmount: { type: Number, required: true, min: 0 },
    feeAmount: { type: Number, required: true, min: 0, default: 0 },
    taxAmount: { type: Number, required: true, min: 0, default: 0 },
    otherDeduction: { type: Number, required: true, min: 0, default: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['imported', 'reconciled', 'posted'],
      default: 'imported',
      index: true,
    },
    lines: { type: [settlementLineSchema], default: [] },
    journalEntryId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);
settlementSchema.index({ provider: 1, reference: 1 }, { unique: true });

const periodSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
    openingEntryId: { type: Schema.Types.ObjectId },
    closingEntryId: { type: Schema.Types.ObjectId },
    closedAt: { type: Date },
  },
  { timestamps: true },
);
periodSchema.index({ startsAt: 1, endsAt: 1 }, { unique: true });

const issueSchema = new Schema(
  {
    type: { type: String, required: true, trim: true, index: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    entityId: { type: String, required: true, trim: true, index: true },
    message: { type: String, trim: true },
    status: {
      type: String,
      enum: ['open', 'reviewing', 'ignored', 'resolved'],
      default: 'open',
      index: true,
    },
    assignedTo: { type: String, trim: true },
    note: { type: String, trim: true },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);
issueSchema.index({ type: 1, entityId: 1 }, { unique: true });

export type AccountDocument = InferSchemaType<typeof accountSchema> & {
  _id: mongoose.Types.ObjectId;
};
export type JournalEntryDocument = InferSchemaType<typeof journalSchema> & {
  _id: mongoose.Types.ObjectId;
};
export const AccountModel =
  (mongoose.models.Account as mongoose.Model<AccountDocument>) ||
  mongoose.model<AccountDocument>('Account', accountSchema, 'accounting_accounts');
export const JournalEntryModel =
  (mongoose.models.JournalEntry as mongoose.Model<JournalEntryDocument>) ||
  mongoose.model<JournalEntryDocument>('JournalEntry', journalSchema, 'accounting_journal_entries');
export const ExpenseModel =
  mongoose.models.AccountingExpense ||
  mongoose.model('AccountingExpense', expenseSchema, 'accounting_expenses');
export const CashAccountModel =
  mongoose.models.CashAccount ||
  mongoose.model('CashAccount', cashAccountSchema, 'accounting_cash_accounts');
export const SettlementModel =
  mongoose.models.AccountingSettlement ||
  mongoose.model('AccountingSettlement', settlementSchema, 'accounting_settlements');
export const FinancialPeriodModel =
  mongoose.models.FinancialPeriod ||
  mongoose.model('FinancialPeriod', periodSchema, 'accounting_periods');
export const AccountingIssueModel =
  mongoose.models.AccountingIssue ||
  mongoose.model('AccountingIssue', issueSchema, 'accounting_issues');
