import { Types } from 'mongoose';

import { connectMongoose } from '@/lib/mongoose';
import {
  AccountModel,
  AccountingIssueModel,
  CashAccountModel,
  ExpenseModel,
  FinancialPeriodModel,
  JournalEntryModel,
  SettlementModel,
} from '@/models/accounting/Accounting';
import BslOrderModel from '@/basalaam/models/orders';
import ProductModel from '@/catalog/models/Product';
import DgkOrderModel from '@/digikala/models/orders';
import { InvoiceModel } from '@/orders/models/Invoice';
import { PaymentTransactionModel } from '@/models/Payment';
import SnpOrderModel from '@/snapp/models/orders';
import { accountingAmountInToman } from './money';

export const DEFAULT_ACCOUNTS = [
  ['1101', 'صندوق', 'asset'],
  ['1102', 'بانک', 'asset'],
  ['1103', 'وجوه نزد درگاه‌ها و مارکت‌پلیس‌ها', 'asset'],
  ['1201', 'حساب‌های دریافتنی', 'asset'],
  ['1301', 'موجودی کالا', 'asset'],
  ['2101', 'حساب‌های پرداختنی', 'liability'],
  ['3101', 'سرمایه', 'equity'],
  ['4101', 'فروش کالا', 'revenue'],
  ['4102', 'درآمد ارسال', 'revenue'],
  ['5101', 'بهای تمام‌شده کالای فروش‌رفته', 'expense'],
  ['5201', 'کارمزد درگاه و مارکت‌پلیس', 'expense'],
  ['5301', 'هزینه‌های عملیاتی', 'expense'],
  ['5401', 'مالیات و عوارض', 'expense'],
] as const;

export type MarketplaceAccountingChannel = 'digikala' | 'basalaam' | 'snapp';

const MARKETPLACE_MODELS = {
  digikala: DgkOrderModel,
  basalaam: BslOrderModel,
  snapp: SnpOrderModel,
} as const;

type JournalLineInput = {
  accountCode: string;
  debit?: number;
  credit?: number;
  description?: string;
};

function integerAmount(value: unknown, field = 'amount') {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`invalid_${field}`);
  return amount;
}

function sourceIdForMarketplaceOrder(channel: MarketplaceAccountingChannel, order: any) {
  const lineId =
    channel === 'digikala'
      ? (order.dgkOrderItemId ?? order.inventoryLineKey ?? order._id)
      : channel === 'basalaam'
        ? (order.bslOrderItemId ?? order._id)
        : (order.snpVariantId ?? order._id);
  const orderId =
    channel === 'digikala'
      ? order.dgkOrderId
      : channel === 'basalaam'
        ? order.bslOrderId
        : order.snpOrderId;
  return `${channel}:${order.vendorId ?? 'unknown'}:${orderId}:${lineId}`;
}

async function marketplaceUnitCost(barcode?: string | null) {
  if (!barcode) return 0;
  const product = await ProductModel.findOne({ 'variants.barcode': barcode })
    .select({ variants: 1 })
    .lean();
  const variant = (product?.variants ?? []).find((item: any) => item.barcode === barcode);
  const price = variant?.price as { costPrice?: number; amount?: number } | undefined;
  return Math.round(price?.costPrice ?? price?.amount ?? 0);
}

export function validateJournalLines(lines: JournalLineInput[]) {
  if (lines.length < 2) throw new Error('journal_requires_two_lines');
  const debit = lines.reduce((sum, line) => sum + integerAmount(line.debit ?? 0, 'debit'), 0);
  const credit = lines.reduce((sum, line) => sum + integerAmount(line.credit ?? 0, 'credit'), 0);
  if (debit <= 0 || debit !== credit) throw new Error('journal_not_balanced');
  if (lines.some((line) => (line.debit ?? 0) > 0 && (line.credit ?? 0) > 0)) {
    throw new Error('journal_line_has_debit_and_credit');
  }
  return { debit, credit };
}

export function calculateSettlementNet(gross: number, fee = 0, tax = 0, deduction = 0) {
  const net =
    integerAmount(gross, 'gross') -
    integerAmount(fee, 'fee') -
    integerAmount(tax, 'tax') -
    integerAmount(deduction, 'deduction');
  if (net < 0) throw new Error('invalid_settlement_net');
  return net;
}

export async function ensureDefaultChart() {
  await connectMongoose();
  await Promise.all(
    DEFAULT_ACCOUNTS.map(([code, name, type]) =>
      AccountModel.updateOne(
        { code },
        { $setOnInsert: { code, name, type, active: true, system: true } },
        { upsert: true },
      ),
    ),
  );
  return AccountModel.find({}).sort({ code: 1 }).lean();
}

export async function createAccount(input: {
  code: string;
  name: string;
  type: string;
  parentId?: string;
}) {
  await connectMongoose();
  return AccountModel.create(input);
}

export async function createCashAccount(input: {
  name: string;
  kind: string;
  accountId: string;
  bankName?: string;
  iban?: string;
  accountNumber?: string;
}) {
  await connectMongoose();
  return CashAccountModel.create(input);
}

export async function createFinancialPeriod(input: { name: string; startsAt: Date; endsAt: Date }) {
  await connectMongoose();
  if (!(input.startsAt < input.endsAt)) throw new Error('invalid_financial_period');
  const overlap = await FinancialPeriodModel.exists({
    startsAt: { $lte: input.endsAt },
    endsAt: { $gte: input.startsAt },
  });
  if (overlap) throw new Error('financial_period_overlap');
  return FinancialPeriodModel.create(input);
}

async function assertOpenPeriod(date: Date) {
  const closed = await FinancialPeriodModel.exists({
    status: 'closed',
    startsAt: { $lte: date },
    endsAt: { $gte: date },
  });
  if (closed) throw new Error('financial_period_closed');
}

export async function postJournal(input: {
  date: Date;
  description: string;
  lines: JournalLineInput[];
  sourceType?: string;
  sourceId?: string;
  actorId?: string;
}) {
  await connectMongoose();
  await assertOpenPeriod(input.date);
  validateJournalLines(input.lines);
  const codes = [...new Set(input.lines.map((line) => line.accountCode))];
  const accounts = await AccountModel.find({ code: { $in: codes }, active: true }).lean();
  if (accounts.length !== codes.length) throw new Error('journal_account_not_found');
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  const number = `J-${input.date.toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now()}`;
  return JournalEntryModel.create({
    number,
    date: input.date,
    description: input.description.trim(),
    status: 'posted',
    postedAt: new Date(),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    actorId: input.actorId && Types.ObjectId.isValid(input.actorId) ? input.actorId : undefined,
    lines: input.lines.map((line) => {
      const account = byCode.get(line.accountCode)!;
      return {
        accountId: account._id,
        accountCode: account.code,
        accountName: account.name,
        debit: integerAmount(line.debit ?? 0, 'debit'),
        credit: integerAmount(line.credit ?? 0, 'credit'),
        description: line.description,
      };
    }),
  });
}

export async function reverseJournal(id: string, actorId?: string) {
  await connectMongoose();
  if (!Types.ObjectId.isValid(id)) throw new Error('invalid_journal_id');
  const original = await JournalEntryModel.findById(id);
  if (!original || original.status !== 'posted') throw new Error('journal_not_reversible');
  const reversal = await postJournal({
    date: new Date(),
    description: `اصلاح سند ${original.number}: ${original.description}`,
    sourceType: 'journal-reversal',
    sourceId: String(original._id),
    actorId,
    lines: original.lines.map((line) => ({
      accountCode: line.accountCode,
      debit: line.credit,
      credit: line.debit,
      description: line.description ?? undefined,
    })),
  });
  original.status = 'reversed';
  original.reversedBy = reversal._id;
  await original.save();
  return reversal;
}

export async function postInvoiceSale(invoiceId: string) {
  await ensureDefaultChart();
  const existing = await JournalEntryModel.findOne({
    sourceType: 'invoice-sale',
    sourceId: invoiceId,
  });
  if (existing) return existing;
  const invoice = await InvoiceModel.findById(invoiceId).lean();
  if (!invoice || invoice.status !== 'paid') throw new Error('paid_invoice_not_found');
  const productRevenue = Math.max(0, invoice.grandTotal - invoice.shippingTotal);
  const cost = Math.round(
    invoice.lines.reduce((sum, line) => {
      const units = line.qty ?? line.requestedQty ?? 0;
      return sum + (line.unitCostSnapshot ?? 0) * units;
    }, 0),
  );
  return postJournal({
    date: invoice.paidAt ?? invoice.createdAt,
    description: `فروش فاکتور ${invoice.number}`,
    sourceType: 'invoice-sale',
    sourceId: invoiceId,
    lines: [
      { accountCode: '1103', debit: invoice.grandTotal },
      ...(productRevenue ? [{ accountCode: '4101', credit: productRevenue }] : []),
      ...(invoice.shippingTotal ? [{ accountCode: '4102', credit: invoice.shippingTotal }] : []),
      ...(cost
        ? [
            { accountCode: '5101', debit: cost },
            { accountCode: '1301', credit: cost },
          ]
        : []),
    ],
  });
}

export async function reverseInvoiceSale(invoiceId: string) {
  await connectMongoose();
  const sale = await JournalEntryModel.findOne({ sourceType: 'invoice-sale', sourceId: invoiceId });
  if (!sale || sale.status !== 'posted') return null;
  return reverseJournal(String(sale._id));
}

export async function postMarketplaceOrderSale(input: {
  channel: MarketplaceAccountingChannel;
  orderId: string;
  actorId?: string;
}) {
  await ensureDefaultChart();
  const model = MARKETPLACE_MODELS[input.channel] as any;
  const order = await model.findById(input.orderId).lean();
  if (!order) throw new Error('marketplace_order_not_found');
  const sourceId = sourceIdForMarketplaceOrder(input.channel, order);
  const existing = await JournalEntryModel.findOne({
    sourceType: 'marketplace-sale',
    sourceId,
  });
  if (existing) return existing;
  const quantity = Math.max(0, Number(order.quantity ?? 0));
  const grossAmount = integerAmount(accountingAmountInToman(input.channel, order.amount), 'gross');
  const unitCostSnapshot =
    order.unitCostSnapshot != null
      ? integerAmount(order.unitCostSnapshot, 'unit_cost')
      : await marketplaceUnitCost(order.barcode);
  if (order.unitCostSnapshot == null) {
    await model.updateOne({ _id: order._id }, { $set: { unitCostSnapshot } });
  }
  const cost = Math.round(unitCostSnapshot * quantity);
  return postJournal({
    date: order.createdAt ?? new Date(),
    description: `فروش ${input.channel} - ${order.title ?? sourceId}`,
    sourceType: 'marketplace-sale',
    sourceId,
    actorId: input.actorId,
    lines: [
      { accountCode: '1103', debit: grossAmount, description: input.channel },
      { accountCode: '4101', credit: grossAmount, description: input.channel },
      ...(cost
        ? [
            { accountCode: '5101', debit: cost, description: input.channel },
            { accountCode: '1301', credit: cost, description: input.channel },
          ]
        : []),
    ],
  });
}

export async function reverseMarketplaceOrderSale(input: {
  channel: MarketplaceAccountingChannel;
  orderId: string;
  actorId?: string;
}) {
  await ensureDefaultChart();
  const model = MARKETPLACE_MODELS[input.channel] as any;
  const order = await model.findById(input.orderId).lean();
  if (!order) throw new Error('marketplace_order_not_found');
  const sale = await JournalEntryModel.findOne({
    sourceType: 'marketplace-sale',
    sourceId: sourceIdForMarketplaceOrder(input.channel, order),
  });
  if (!sale || sale.status !== 'posted') return null;
  return reverseJournal(String(sale._id), input.actorId);
}

export async function postUnpostedMarketplaceSales(input: {
  channel?: MarketplaceAccountingChannel;
  limit?: number;
  actorId?: string;
}) {
  const channels = input.channel ? [input.channel] : Object.keys(MARKETPLACE_MODELS);
  const posted: unknown[] = [];
  for (const channel of channels as MarketplaceAccountingChannel[]) {
    const model = MARKETPLACE_MODELS[channel] as any;
    const statusFilter =
      channel === 'digikala'
        ? { status: { $in: ['pending', 'processed'] } }
        : channel === 'basalaam'
          ? { bslOrderStatus: { $nin: [3067, 3233, 6440, 3429] } }
          : { status: { $ne: 'returned' } };
    const orders = await model
      .find(statusFilter)
      .sort({ createdAt: -1 })
      .limit(input.limit ?? 100)
      .lean();
    for (const order of orders) {
      posted.push(
        await postMarketplaceOrderSale({
          channel,
          orderId: String(order._id),
          actorId: input.actorId,
        }),
      );
    }
  }
  return posted;
}

export async function createAndPostExpense(input: {
  title: string;
  category: string;
  amount: number;
  date: Date;
  reference?: string;
  description?: string;
  actorId?: string;
}) {
  await ensureDefaultChart();
  const amount = integerAmount(input.amount);
  const expense = await ExpenseModel.create({ ...input, amount, status: 'draft' });
  const journal = await postJournal({
    date: input.date,
    description: `هزینه: ${input.title}`,
    sourceType: 'expense',
    sourceId: String(expense._id),
    actorId: input.actorId,
    lines: [
      { accountCode: '5301', debit: amount },
      { accountCode: '1102', credit: amount },
    ],
  });
  expense.status = 'posted';
  expense.journalEntryId = journal._id;
  await expense.save();
  return expense;
}

export async function createSettlement(input: {
  provider: string;
  reference: string;
  periodFrom: Date;
  periodTo: Date;
  settledAt: Date;
  currency?: 'toman' | 'rial';
  grossAmount: number;
  feeAmount?: number;
  taxAmount?: number;
  otherDeduction?: number;
  lines?: Record<string, unknown>[];
}) {
  await ensureDefaultChart();
  const currency = input.currency ?? 'toman';
  const toToman = (value: unknown, field: string) => {
    const amount = integerAmount(value, field);
    return currency === 'rial' ? Math.floor(amount / 10) : amount;
  };
  const grossAmount = toToman(input.grossAmount, 'gross');
  const feeAmount = toToman(input.feeAmount ?? 0, 'fee');
  const taxAmount = toToman(input.taxAmount ?? 0, 'tax');
  const otherDeduction = toToman(input.otherDeduction ?? 0, 'deduction');
  const netAmount = calculateSettlementNet(grossAmount, feeAmount, taxAmount, otherDeduction);
  const lines = await Promise.all(
    (input.lines ?? []).map(async (line) => {
      const invoice =
        line.invoiceId && Types.ObjectId.isValid(String(line.invoiceId))
          ? await InvoiceModel.findById(line.invoiceId).select({ grandTotal: 1 }).lean()
          : null;
      const lineGross = toToman(line.grossAmount ?? 0, 'line_gross');
      const lineFee = toToman(line.feeAmount ?? 0, 'line_fee');
      const lineTax = toToman(line.taxAmount ?? 0, 'line_tax');
      const lineDeduction = toToman(line.otherDeduction ?? 0, 'line_deduction');
      const lineNet = calculateSettlementNet(lineGross, lineFee, lineTax, lineDeduction);
      return {
        ...line,
        grossAmount: lineGross,
        feeAmount: lineFee,
        taxAmount: lineTax,
        otherDeduction: lineDeduction,
        netAmount: lineNet,
        matched: Boolean(
          invoice
            ? invoice.grandTotal === lineGross
            : line.orderId || line.platform || line.calculationType,
        ),
        mismatchReason: !invoice
          ? line.orderId || line.platform || line.calculationType
            ? undefined
            : 'invoice_not_found'
          : invoice.grandTotal !== lineGross
            ? 'amount_mismatch'
            : undefined,
      };
    }),
  );
  return SettlementModel.create({
    ...input,
    currency,
    grossAmount,
    feeAmount,
    taxAmount,
    otherDeduction,
    netAmount,
    lines,
    status: lines.every((line) => line.matched) ? 'reconciled' : 'imported',
  });
}

function numberFromDgk(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
}

function dgkNotationLines(section: any, calculationType: string, vendorId?: string) {
  return (section?.notations ?? []).map((notation: any) => {
    const grossAmount = numberFromDgk(
      notation.final_credit ?? notation.credit ?? notation.amount ?? notation.total_amount,
    );
    const deduction = numberFromDgk(
      notation.final_debit ?? notation.debit ?? notation.general_discount_debit,
    );
    return {
      platform: 'digikala',
      vendorId,
      orderId: notation.order_id ? String(notation.order_id) : undefined,
      orderItemId: notation.item_serial ? String(notation.item_serial) : undefined,
      calculationType,
      grossAmount,
      otherDeduction: deduction,
      netAmount: Math.max(0, grossAmount - deduction),
    };
  });
}

export async function importDigikalaInvoiceSettlement(input: {
  vendorId?: string;
  invoice: Record<string, any>;
  details?: Record<string, any>;
}) {
  const invoice = input.invoice ?? {};
  const details = input.details ?? {};
  const reference = String(
    invoice.id ?? details.id ?? invoice.invoice_id ?? details.invoice_id ?? '',
  );
  if (!reference) throw new Error('digikala_invoice_reference_required');
  const grossAmount = numberFromDgk(
    invoice.invoice_total_amount ?? details.sales?.total_amount ?? details.total_income,
  );
  const netAmount = numberFromDgk(details.total_paid_amount ?? details.cash?.total_amount);
  const taxAmount = numberFromDgk(details.vat_amount);
  const otherDeductions =
    numberFromDgk(details.sales_return?.total_amount) +
    numberFromDgk(details.others?.total_amount) +
    numberFromDgk(details.payment_deficit?.total_amount);
  const feeAmount = Math.max(0, grossAmount - netAmount - taxAmount - otherDeductions);
  const start = invoice.start_date ?? details.start_date ?? invoice.invoice_start_date;
  const end = invoice.end_date ?? details.end_date ?? invoice.invoice_end_date ?? start;
  const settledAt =
    details.early_settlement?.settlement_date ??
    invoice.cash_sale_date ??
    invoice.credit_sale_date ??
    end ??
    new Date();
  return createSettlement({
    provider: input.vendorId ? `digikala:${input.vendorId}` : 'digikala',
    reference,
    periodFrom: start ? new Date(start) : new Date(),
    periodTo: end ? new Date(end) : new Date(),
    settledAt: new Date(settledAt),
    grossAmount,
    feeAmount,
    taxAmount,
    otherDeduction: otherDeductions,
    lines: [
      ...dgkNotationLines(details.sales, 'sales', input.vendorId),
      ...dgkNotationLines(details.sales_return, 'sales_return', input.vendorId),
      ...dgkNotationLines(details.others, 'others', input.vendorId),
    ],
  });
}

export async function postSettlement(id: string, actorId?: string) {
  await ensureDefaultChart();
  const settlement = await SettlementModel.findById(id);
  if (!settlement || settlement.status === 'posted') throw new Error('settlement_not_postable');
  const journal = await postJournal({
    date: settlement.settledAt,
    description: `تسویه ${settlement.provider} - ${settlement.reference}`,
    sourceType: 'settlement',
    sourceId: String(settlement._id),
    actorId,
    lines: [
      { accountCode: '1102', debit: settlement.netAmount },
      ...(settlement.feeAmount ? [{ accountCode: '5201', debit: settlement.feeAmount }] : []),
      ...(settlement.taxAmount + settlement.otherDeduction
        ? [{ accountCode: '5401', debit: settlement.taxAmount + settlement.otherDeduction }]
        : []),
      { accountCode: '1103', credit: settlement.grossAmount },
    ],
  });
  settlement.status = 'posted';
  settlement.journalEntryId = journal._id;
  await settlement.save();
  return settlement;
}

export async function financialPeriodCloseBlockers(startsAt: Date, endsAt: Date) {
  await ensureDefaultChart();
  const [openSettlements, invalidJournals, unpostedPaidInvoices] = await Promise.all([
    SettlementModel.find({
      settledAt: { $gte: startsAt, $lte: endsAt },
      status: { $ne: 'posted' },
    })
      .limit(20)
      .lean(),
    JournalEntryModel.find({
      date: { $gte: startsAt, $lte: endsAt },
      status: 'posted',
      $expr: {
        $ne: [{ $sum: '$lines.debit' }, { $sum: '$lines.credit' }],
      },
    })
      .limit(20)
      .lean(),
    InvoiceModel.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: startsAt, $lte: endsAt } } },
      {
        $lookup: {
          from: 'accounting_journal_entries',
          let: { invoiceId: { $toString: '$_id' } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$sourceType', 'invoice-sale'] },
                    { $eq: ['$sourceId', '$$invoiceId'] },
                    { $eq: ['$status', 'posted'] },
                  ],
                },
              },
            },
          ],
          as: 'journal',
        },
      },
      { $match: { journal: { $size: 0 } } },
      { $limit: 20 },
      { $project: { number: 1, grandTotal: 1, paidAt: 1 } },
    ]),
  ]);
  return [
    ...openSettlements.map((item: any) => ({
      type: 'open_settlement',
      entityId: String(item._id),
      message: `${item.provider} ${item.reference}`,
    })),
    ...invalidJournals.map((item: any) => ({
      type: 'unbalanced_journal',
      entityId: String(item._id),
      message: item.number,
    })),
    ...unpostedPaidInvoices.map((item: any) => ({
      type: 'paid_invoice_without_journal',
      entityId: String(item._id),
      message: item.number,
    })),
  ];
}

export async function updateAccountingIssue(input: {
  id: string;
  status?: 'open' | 'reviewing' | 'ignored' | 'resolved';
  assignedTo?: string;
  note?: string;
}) {
  await ensureDefaultChart();
  if (!Types.ObjectId.isValid(input.id)) throw new Error('invalid_issue_id');
  const update: Record<string, unknown> = {};
  if (input.status) {
    update.status = input.status;
    update.resolvedAt = input.status === 'resolved' ? new Date() : undefined;
  }
  if (input.assignedTo !== undefined) update.assignedTo = input.assignedTo.trim();
  if (input.note !== undefined) update.note = input.note.trim();
  return AccountingIssueModel.findByIdAndUpdate(input.id, { $set: update }, { new: true });
}

export async function closeFinancialPeriod(id: string, actorId?: string) {
  await ensureDefaultChart();
  const period = await FinancialPeriodModel.findOne({ _id: id, status: 'open' });
  if (!period) throw new Error('open_period_not_found');
  const blockers = await financialPeriodCloseBlockers(period.startsAt, period.endsAt);
  if (blockers.length) {
    throw new Error(`financial_period_has_blockers:${blockers.length}`);
  }
  const rows = await JournalEntryModel.aggregate([
    {
      $match: {
        status: { $in: ['posted', 'reversed'] },
        date: { $gte: period.startsAt, $lte: period.endsAt },
      },
    },
    { $unwind: '$lines' },
    { $match: { 'lines.accountCode': { $regex: '^[45]' } } },
    {
      $group: {
        _id: '$lines.accountCode',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
  ]);
  const lines: JournalLineInput[] = [];
  let retained = 0;
  for (const row of rows) {
    const creditBalance = row.credit - row.debit;
    if (creditBalance > 0) lines.push({ accountCode: row._id, debit: creditBalance });
    if (creditBalance < 0) lines.push({ accountCode: row._id, credit: -creditBalance });
    retained += creditBalance;
  }
  if (retained > 0) lines.push({ accountCode: '3101', credit: retained });
  if (retained < 0) lines.push({ accountCode: '3101', debit: -retained });
  const closing = lines.length
    ? await postJournal({
        date: period.endsAt,
        description: `سند اختتامیه ${period.name}`,
        lines,
        sourceType: 'period-close',
        sourceId: String(period._id),
        actorId,
      })
    : null;
  period.status = 'closed';
  period.closedAt = new Date();
  period.closingEntryId = closing?._id;
  await period.save();
  return period;
}

export async function financialStatements(from?: Date, to?: Date) {
  await ensureDefaultChart();
  const date: Record<string, Date> = {};
  if (from) date.$gte = from;
  if (to) date.$lt = to;
  const match = {
    status: { $in: ['posted', 'reversed'] },
    ...(Object.keys(date).length ? { date } : {}),
  };
  const ledger = await JournalEntryModel.aggregate([
    { $match: match },
    { $unwind: '$lines' },
    {
      $group: {
        _id: { code: '$lines.accountCode', name: '$lines.accountName' },
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
    { $sort: { '_id.code': 1 } },
  ]);
  const accounts = await AccountModel.find({}).lean();
  const typeByCode = new Map(accounts.map((account) => [account.code, account.type]));
  const trialBalance = ledger.map((row) => ({
    code: row._id.code,
    name: row._id.name,
    debit: row.debit,
    credit: row.credit,
    balance: row.debit - row.credit,
    type: typeByCode.get(row._id.code),
  }));
  const revenue = trialBalance
    .filter((row) => row.type === 'revenue')
    .reduce((sum, row) => sum + row.credit - row.debit, 0);
  const expense = trialBalance
    .filter((row) => row.type === 'expense')
    .reduce((sum, row) => sum + row.debit - row.credit, 0);
  const assets = trialBalance
    .filter((row) => row.type === 'asset')
    .reduce((sum, row) => sum + row.debit - row.credit, 0);
  const liabilities = trialBalance
    .filter((row) => row.type === 'liability')
    .reduce((sum, row) => sum + row.credit - row.debit, 0);
  const equity = trialBalance
    .filter((row) => row.type === 'equity')
    .reduce((sum, row) => sum + row.credit - row.debit, 0);
  const [expenses, settlements, cashAccounts, periods, journals, trends] = await Promise.all([
    ExpenseModel.find({}).sort({ date: -1 }).limit(100).lean(),
    SettlementModel.find({}).sort({ settledAt: -1 }).limit(100).lean(),
    CashAccountModel.find({ active: true }).lean(),
    FinancialPeriodModel.find({}).sort({ startsAt: -1 }).lean(),
    JournalEntryModel.find(match).sort({ date: -1 }).limit(200).lean(),
    JournalEntryModel.aggregate([
      { $match: match },
      { $unwind: '$lines' },
      { $match: { 'lines.accountCode': { $in: ['4101', '5101', '5201', '5301', '5401'] } } },
      {
        $group: {
          _id: {
            month: { $dateToString: { format: '%Y-%m', date: '$date' } },
            code: '$lines.accountCode',
          },
          debit: { $sum: '$lines.debit' },
          credit: { $sum: '$lines.credit' },
        },
      },
      { $sort: { '_id.month': 1 } },
    ]),
  ]);
  const [cashFlowRows, gatewayRows] = await Promise.all([
    JournalEntryModel.aggregate([
      { $match: match },
      { $unwind: '$lines' },
      { $match: { 'lines.accountCode': { $in: ['1101', '1102'] } } },
      {
        $group: {
          _id: { accountCode: '$lines.accountCode', accountName: '$lines.accountName' },
          inflow: { $sum: '$lines.debit' },
          outflow: { $sum: '$lines.credit' },
        },
      },
      { $sort: { '_id.accountCode': 1 } },
    ]),
    PaymentTransactionModel.aggregate([
      { $match: { status: { $in: ['verified', 'paid'] } } },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoiceId',
          foreignField: '_id',
          as: 'invoice',
        },
      },
      { $unwind: '$invoice' },
      ...(Object.keys(date).length
        ? [
            {
              $match: {
                'invoice.paidAt': date,
              },
            },
          ]
        : []),
      {
        $group: {
          _id: { gateway: '$gateway', site: { $ifNull: ['$invoice.site', 'main'] } },
          collected: { $sum: '$amount' },
          settled: { $sum: { $cond: [{ $ifNull: ['$settledAt', false] }, '$amount', 0] } },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { collected: -1 } },
    ]),
  ]);
  const receivables = trialBalance.find((row) => row.code === '1201')?.balance ?? 0;
  const payableRow = trialBalance.find((row) => row.code === '2101');
  const payables = payableRow ? payableRow.credit - payableRow.debit : 0;
  const accountTypeSummary = trialBalance.reduce<Record<string, number>>((acc, row) => {
    const type = row.type ?? 'unknown';
    const normalBalance =
      type === 'revenue' || type === 'liability' || type === 'equity'
        ? row.credit - row.debit
        : row.debit - row.credit;
    acc[type] = (acc[type] ?? 0) + normalBalance;
    return acc;
  }, {});
  const settlementSummary = (settlements as any[]).reduce(
    (acc, settlement) => {
      acc.count += 1;
      acc.grossAmount += settlement.grossAmount ?? 0;
      acc.netAmount += settlement.netAmount ?? 0;
      acc.feeAmount += settlement.feeAmount ?? 0;
      acc.taxAmount += settlement.taxAmount ?? 0;
      acc.otherDeduction += settlement.otherDeduction ?? 0;
      acc[settlement.status ?? 'unknown'] = (acc[settlement.status ?? 'unknown'] ?? 0) + 1;
      return acc;
    },
    {
      count: 0,
      grossAmount: 0,
      netAmount: 0,
      feeAmount: 0,
      taxAmount: 0,
      otherDeduction: 0,
    } as Record<string, number>,
  );
  const alerts = [
    ...settlements.flatMap((settlement: any) =>
      (settlement.lines ?? [])
        .filter((line: any) => !line.matched)
        .map((line: any) => ({
          type: 'settlement_mismatch',
          severity: 'high',
          entityId: String(settlement._id),
          message: line.mismatchReason,
        })),
    ),
    ...trialBalance
      .filter((row) => !Number.isFinite(row.balance))
      .map((row) => ({ type: 'invalid_balance', severity: 'critical', entityId: row.code })),
  ];
  await Promise.all(
    alerts.map((alert: any) =>
      AccountingIssueModel.updateOne(
        { type: alert.type, entityId: alert.entityId },
        {
          $setOnInsert: {
            type: alert.type,
            entityId: alert.entityId,
            status: 'open',
          },
          $set: {
            severity: alert.severity ?? 'medium',
            message: alert.message,
          },
        },
        { upsert: true },
      ),
    ),
  );
  const issues = await AccountingIssueModel.find({ status: { $ne: 'resolved' } })
    .sort({ severity: 1, updatedAt: -1 })
    .limit(100)
    .lean();
  return {
    accounts,
    trialBalance,
    profitAndLoss: { revenue, expense, netProfit: revenue - expense },
    balanceSheet: { assets, liabilities, equity, retainedProfit: revenue - expense },
    accountTypeSummary,
    settlementSummary,
    cashFlow: {
      inflow: cashFlowRows.reduce((sum: number, row: any) => sum + (row.inflow ?? 0), 0),
      outflow: cashFlowRows.reduce((sum: number, row: any) => sum + (row.outflow ?? 0), 0),
      net: cashFlowRows.reduce(
        (sum: number, row: any) => sum + (row.inflow ?? 0) - (row.outflow ?? 0),
        0,
      ),
      rows: cashFlowRows.map((row: any) => ({
        accountCode: row._id.accountCode,
        accountName: row._id.accountName,
        inflow: row.inflow ?? 0,
        outflow: row.outflow ?? 0,
        net: (row.inflow ?? 0) - (row.outflow ?? 0),
      })),
    },
    gatewaySubledger: gatewayRows.map((row: any) => ({
      provider: row._id.gateway ?? 'unknown',
      branchId: row._id.site ?? 'main',
      collected: row.collected ?? 0,
      settled: row.settled ?? 0,
      inTransit: (row.collected ?? 0) - (row.settled ?? 0),
      transactions: row.transactions ?? 0,
    })),
    receivables,
    payables,
    expenses,
    settlements,
    cashAccounts,
    periods,
    journals,
    trends,
    alerts,
    issues,
  };
}
