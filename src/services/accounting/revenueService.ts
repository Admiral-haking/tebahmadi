import { connectMongoose } from '@/lib/mongoose';
import ProductModel from '@/catalog/models/Product';
import { InvoiceModel } from '@/orders/models/Invoice';
import DgkOrderModel from '@/digikala/models/orders';
import BslOrderModel from '@/basalaam/models/orders';
import SnpOrderModel from '@/snapp/models/orders';
import { PaymentTransactionModel } from '@/models/Payment';
import { RefundModel } from '@/models/Refund';
import { marketplaceAccountingAmountExpression } from './money';

/**
 * Revenue reporting across every sales channel.
 *
 * Four collections, not one. Site checkout (and Shopino) writes an `Invoice` with
 * priced line items; Digikala, Basalaam and Snapp each keep their own order
 * collection with a flat `amount`/`quantity` and no invoice is ever created for
 * them. Any figure that claims to be "total revenue" therefore has to union all
 * four — reading `Invoice` alone silently reports only part of the business.
 *
 * Reports currently use the order creation date as their range key. Site revenue
 * is recognized only after payment (`paid`); pending checkouts remain visible in
 * the status breakdown but never inflate recognized revenue.
 */

export const ACCOUNTING_CHANNELS = ['site', 'digikala', 'basalaam', 'snapp'] as const;
export type AccountingChannel = (typeof ACCOUNTING_CHANNELS)[number];

export const CHANNEL_LABELS: Record<AccountingChannel, string> = {
  site: 'فروشگاه سایت',
  digikala: 'دیجی‌کالا',
  basalaam: 'باسلام',
  snapp: 'اسنپ‌شاپ',
};

/**
 * Status vocabularies differ per channel, so each one needs its own mapping.
 *
 * `booked` — counts toward revenue. `returned` — a sale that came back, reported
 * separately rather than netted off, because an operator needs to see both the
 * gross and the return rate.
 *
 * Anything not listed is deliberately excluded: an invoice `draft` was never
 * submitted and a `canceled` order never became a sale, so counting either would
 * inflate revenue.
 */
export const INVOICE_BOOKED: readonly string[] = ['paid'];
const INVOICE_RETURNED = ['refunded'];

// `pending` is an open marketplace order, not realized revenue. Including it
// made the Digikala card overstate sales before fulfillment/cancellation.
export const DGK_BOOKED: readonly string[] = ['processed'];
const DGK_RETURNED = ['returned'];

// Snapp reports terminal non-sale orders as CANCELED. They must stay visible in
// the status breakdown but are not recognized revenue.
export const SNP_BOOKED: readonly string[] = ['CONFIRMED'];

// Basalam persists the numeric API status in `bslOrderStatus` rather than a
// generic `status` field. The first three IDs are used by the sync/stock ledger;
// 3429 also exists in historical/UI data as canceled.
export const BSL_RETURNED_STATUS_IDS = [3067, 3233, 6440, 3429] as const;

export type RevenueFilters = {
  /** Inclusive. */
  from?: Date;
  /** Exclusive, so a day range is [start, nextDayStart). */
  to?: Date;
  channels?: AccountingChannel[];
  invoiceQuery?: string;
  invoiceStatus?: string;
  invoiceSort?: 'financial_desc' | 'financial_asc' | 'amount_desc' | 'amount_asc';
};

export function parseTehranAccountingDay(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('invalid_date');
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error('invalid_date');
  }
  return new Date(`${value}T00:00:00+03:30`);
}

export function allocateInvoiceLineRevenue(
  lineTotal: number,
  subtotal: number,
  grandTotal: number,
) {
  return subtotal > 0 ? (lineTotal * grandTotal) / subtotal : 0;
}

export type ChannelTotals = {
  channel: AccountingChannel;
  label: string;
  orderCount: number;
  itemCount: number;
  revenue: number;
  returnedCount: number;
  returnedRevenue: number;
  /** Raw status counts, so unmapped vocabularies stay visible rather than silently bucketed. */
  statusBreakdown: Record<string, number>;
};

export type BranchTotals = ChannelTotals & {
  branchId: string;
  branchLabel: string;
};

export type GatewayTotals = {
  gateway: string;
  label: string;
  branchId: string;
  branchLabel: string;
  transactionCount: number;
  amount: number;
  settledAmount: number;
  unsettledAmount: number;
  discrepancy: number;
  statusBreakdown: Record<string, number>;
};

function branchLabel(channel: AccountingChannel, branchId: string): string {
  if (channel === 'site') return branchId === 'main' ? 'فروشگاه اصلی' : `سایت ${branchId}`;
  return branchId === 'unknown' ? `${CHANNEL_LABELS[channel]} بدون غرفه` : `غرفه ${branchId}`;
}

function dateMatch(filters: RevenueFilters): Record<string, unknown> {
  const range: Record<string, Date> = {};
  if (filters.from) range.$gte = filters.from;
  if (filters.to) range.$lt = filters.to;
  return Object.keys(range).length > 0 ? { createdAt: range } : {};
}

function siteFinancialDateMatch(filters: RevenueFilters): Record<string, unknown> {
  if (!filters.from && !filters.to) return {};
  const effectiveDate = {
    $ifNull: [
      { $cond: [{ $eq: ['$status', 'refunded'] }, '$refundedAt', '$paidAt'] },
      '$createdAt',
    ],
  };
  const conditions: Record<string, unknown>[] = [];
  if (filters.from) conditions.push({ $gte: [effectiveDate, filters.from] });
  if (filters.to) conditions.push({ $lt: [effectiveDate, filters.to] });
  return { $expr: conditions.length === 1 ? conditions[0] : { $and: conditions } };
}

function joinedInvoiceFinancialDateMatch(filters: RevenueFilters): Record<string, unknown> {
  if (!filters.from && !filters.to) return {};
  const effectiveDate = {
    $ifNull: [
      {
        $cond: [{ $eq: ['$invoice.status', 'refunded'] }, '$invoice.refundedAt', '$invoice.paidAt'],
      },
      '$invoice.createdAt',
    ],
  };
  const conditions: Record<string, unknown>[] = [];
  if (filters.from) conditions.push({ $gte: [effectiveDate, filters.from] });
  if (filters.to) conditions.push({ $lt: [effectiveDate, filters.to] });
  return { $expr: conditions.length === 1 ? conditions[0] : { $and: conditions } };
}

export function resolveInvoiceFinancialDate(invoice: {
  status?: string;
  createdAt: Date | string;
  paidAt?: Date | string | null;
  refundedAt?: Date | string | null;
}): Date {
  const value =
    invoice.status === 'refunded'
      ? (invoice.refundedAt ?? invoice.createdAt)
      : (invoice.paidAt ?? invoice.createdAt);
  return new Date(value);
}

function wanted(filters: RevenueFilters, channel: AccountingChannel): boolean {
  return !filters.channels || filters.channels.length === 0 || filters.channels.includes(channel);
}

function emptyTotals(channel: AccountingChannel): ChannelTotals {
  return {
    channel,
    label: CHANNEL_LABELS[channel],
    orderCount: 0,
    itemCount: 0,
    revenue: 0,
    returnedCount: 0,
    returnedRevenue: 0,
    statusBreakdown: {},
  };
}

/** Site + Shopino revenue, from priced invoice lines. */
async function siteTotals(filters: RevenueFilters): Promise<ChannelTotals> {
  const rows = await InvoiceModel.aggregate<{
    _id: string;
    orders: number;
    revenue: number;
    items: number;
  }>([
    { $match: siteFinancialDateMatch(filters) },
    {
      $group: {
        _id: '$status',
        orders: { $sum: 1 },
        // `grandTotal` is what the customer owes: lines minus discount plus
        // shipping. Summing line totals instead would ignore both.
        revenue: { $sum: '$grandTotal' },
        items: { $sum: { $sum: '$lines.qty' } },
      },
    },
  ]);

  const totals = emptyTotals('site');
  rows.forEach((row) => {
    const status = row._id ?? 'unknown';
    totals.statusBreakdown[status] = row.orders;
    if (INVOICE_BOOKED.includes(status)) {
      totals.orderCount += row.orders;
      totals.revenue += row.revenue;
      totals.itemCount += row.items ?? 0;
    } else if (INVOICE_RETURNED.includes(status)) {
      totals.returnedCount += row.orders;
      totals.returnedRevenue += row.revenue;
    }
  });
  return totals;
}

async function siteBranchTotals(filters: RevenueFilters): Promise<BranchTotals[]> {
  const rows = await InvoiceModel.aggregate<{
    _id: { site?: string | null; status?: string | null };
    orders: number;
    revenue: number;
    items: number;
  }>([
    { $match: siteFinancialDateMatch(filters) },
    {
      $group: {
        _id: { site: { $ifNull: ['$site', 'main'] }, status: '$status' },
        orders: { $sum: 1 },
        revenue: { $sum: '$grandTotal' },
        items: { $sum: { $sum: '$lines.qty' } },
      },
    },
  ]);

  const byBranch = new Map<string, BranchTotals>();
  rows.forEach((row) => {
    const branchId = row._id.site || 'main';
    const totals =
      byBranch.get(branchId) ??
      ({
        ...emptyTotals('site'),
        branchId,
        branchLabel: branchLabel('site', branchId),
      } as BranchTotals);
    const status = row._id.status ?? 'unknown';
    totals.statusBreakdown[status] = (totals.statusBreakdown[status] ?? 0) + row.orders;
    if (INVOICE_BOOKED.includes(status)) {
      totals.orderCount += row.orders;
      totals.revenue += row.revenue;
      totals.itemCount += row.items ?? 0;
    } else if (INVOICE_RETURNED.includes(status)) {
      totals.returnedCount += row.orders;
      totals.returnedRevenue += row.revenue;
    }
    byBranch.set(branchId, totals);
  });
  return Array.from(byBranch.values());
}

type MarketplaceModel = typeof DgkOrderModel | typeof BslOrderModel | typeof SnpOrderModel;

/**
 * Marketplace revenue.
 *
 * These rows are per-item, not per-order: `amount` is the line value and
 * `quantity` the units. There is no order-level total to sum, so revenue is the
 * sum of `amount`. A marketplace order ID is only unique within its vendor, so
 * the accounting identity is `(vendorId, orderId)` rather than the order ID alone.
 */
async function marketplaceTotals(
  channel: AccountingChannel,
  model: MarketplaceModel,
  filters: RevenueFilters,
  booked: string[] | null,
  returned: string[],
  orderIdField: string,
): Promise<ChannelTotals> {
  type StatusRow = { _id: string; orders: number; revenue: number; items: number };
  const rows: StatusRow[] = await (
    model as { aggregate: (p: unknown[]) => Promise<StatusRow[]> }
  ).aggregate([
    { $match: dateMatch(filters) },
    {
      $group: {
        _id: {
          vendorId: { $ifNull: ['$vendorId', 'unknown'] },
          status: '$status',
          orderId: `$${orderIdField}`,
        },
        revenue: { $sum: marketplaceAccountingAmountExpression(channel) },
        items: { $sum: '$quantity' },
      },
    },
    {
      $group: {
        _id: '$_id.status',
        orders: { $sum: 1 },
        revenue: { $sum: '$revenue' },
        items: { $sum: '$items' },
      },
    },
  ]);

  const totals = emptyTotals(channel);
  rows.forEach((row) => {
    const status = row._id ?? 'unknown';
    totals.statusBreakdown[status] = row.orders;
    if (returned.includes(status)) {
      totals.returnedCount += row.orders;
      totals.returnedRevenue += row.revenue;
      return;
    }
    // `booked === null` means this channel's status vocabulary is not known well
    // enough to filter on, so everything that is not an explicit return counts.
    // The raw breakdown above is what lets an operator spot a status that should
    // have been excluded.
    if (booked === null || booked.includes(status)) {
      totals.orderCount += row.orders;
      totals.revenue += row.revenue;
      totals.itemCount += row.items ?? 0;
    }
  });
  return totals;
}

async function marketplaceBranchTotals(
  channel: AccountingChannel,
  model: MarketplaceModel,
  filters: RevenueFilters,
  booked: string[] | null,
  returned: string[],
  orderIdField: string,
): Promise<BranchTotals[]> {
  type StatusRow = {
    _id: { vendorId?: string | null; status?: string | null };
    orders: number;
    revenue: number;
    items: number;
  };
  const rows: StatusRow[] = await (
    model as { aggregate: (p: unknown[]) => Promise<StatusRow[]> }
  ).aggregate([
    { $match: dateMatch(filters) },
    {
      $group: {
        _id: {
          vendorId: { $ifNull: ['$vendorId', 'unknown'] },
          status: '$status',
          orderId: `$${orderIdField}`,
        },
        revenue: { $sum: marketplaceAccountingAmountExpression(channel) },
        items: { $sum: '$quantity' },
      },
    },
    {
      $group: {
        _id: { vendorId: '$_id.vendorId', status: '$_id.status' },
        orders: { $sum: 1 },
        revenue: { $sum: '$revenue' },
        items: { $sum: '$items' },
      },
    },
  ]);

  const byBranch = new Map<string, BranchTotals>();
  rows.forEach((row) => {
    const branchId = row._id.vendorId || 'unknown';
    const totals =
      byBranch.get(branchId) ??
      ({
        ...emptyTotals(channel),
        branchId,
        branchLabel: branchLabel(channel, branchId),
      } as BranchTotals);
    const status = row._id.status ?? 'unknown';
    totals.statusBreakdown[status] = (totals.statusBreakdown[status] ?? 0) + row.orders;
    if (returned.includes(status)) {
      totals.returnedCount += row.orders;
      totals.returnedRevenue += row.revenue;
    } else if (booked === null || booked.includes(status)) {
      totals.orderCount += row.orders;
      totals.revenue += row.revenue;
      totals.itemCount += row.items ?? 0;
    }
    byBranch.set(branchId, totals);
  });
  return Array.from(byBranch.values());
}

async function basalaamTotals(filters: RevenueFilters): Promise<ChannelTotals> {
  type StatusRow = { _id: number | null; orders: number; revenue: number; items: number };
  const rows = await BslOrderModel.aggregate<StatusRow>([
    { $match: dateMatch(filters) },
    {
      $group: {
        _id: { status: '$bslOrderStatus', orderId: '$bslOrderId' },
        revenue: { $sum: marketplaceAccountingAmountExpression('basalaam') },
        items: { $sum: '$quantity' },
      },
    },
    {
      $group: {
        _id: '$_id.status',
        orders: { $sum: 1 },
        revenue: { $sum: '$revenue' },
        items: { $sum: '$items' },
      },
    },
  ]);

  const totals = emptyTotals('basalaam');
  rows.forEach((row) => {
    const status = row._id == null ? 'unknown' : String(row._id);
    totals.statusBreakdown[status] = row.orders;
    if ((BSL_RETURNED_STATUS_IDS as readonly number[]).includes(Number(row._id))) {
      totals.returnedCount += row.orders;
      totals.returnedRevenue += row.revenue;
      return;
    }
    totals.orderCount += row.orders;
    totals.revenue += row.revenue;
    totals.itemCount += row.items ?? 0;
  });
  return totals;
}

async function basalaamBranchTotals(filters: RevenueFilters): Promise<BranchTotals[]> {
  type StatusRow = {
    _id: { vendorId?: string | null; status?: number | null };
    orders: number;
    revenue: number;
    items: number;
  };
  const rows = await BslOrderModel.aggregate<StatusRow>([
    { $match: dateMatch(filters) },
    {
      $group: {
        _id: {
          vendorId: { $ifNull: ['$vendorId', 'unknown'] },
          status: '$bslOrderStatus',
          orderId: '$bslOrderId',
        },
        revenue: { $sum: marketplaceAccountingAmountExpression('basalaam') },
        items: { $sum: '$quantity' },
      },
    },
    {
      $group: {
        _id: { vendorId: '$_id.vendorId', status: '$_id.status' },
        orders: { $sum: 1 },
        revenue: { $sum: '$revenue' },
        items: { $sum: '$items' },
      },
    },
  ]);

  const byBranch = new Map<string, BranchTotals>();
  rows.forEach((row) => {
    const branchId = row._id.vendorId || 'unknown';
    const totals =
      byBranch.get(branchId) ??
      ({
        ...emptyTotals('basalaam'),
        branchId,
        branchLabel: branchLabel('basalaam', branchId),
      } as BranchTotals);
    const status = row._id.status == null ? 'unknown' : String(row._id.status);
    totals.statusBreakdown[status] = (totals.statusBreakdown[status] ?? 0) + row.orders;
    if ((BSL_RETURNED_STATUS_IDS as readonly number[]).includes(Number(row._id.status))) {
      totals.returnedCount += row.orders;
      totals.returnedRevenue += row.revenue;
    } else {
      totals.orderCount += row.orders;
      totals.revenue += row.revenue;
      totals.itemCount += row.items ?? 0;
    }
    byBranch.set(branchId, totals);
  });
  return Array.from(byBranch.values());
}

async function paymentGatewayTotals(filters: RevenueFilters): Promise<GatewayTotals[]> {
  if (!wanted(filters, 'site')) return [];
  type Row = {
    _id: { gateway?: string | null; site?: string | null; status?: string | null };
    transactions: number;
    amount: number;
    settledAmount: number;
    invoiceGrandTotal: number;
  };
  const rows = await PaymentTransactionModel.aggregate<Row>([
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
    { $match: joinedInvoiceFinancialDateMatch(filters) },
    // A retry can leave more than one successful-looking gateway row. The
    // financial view must compare each invoice once, using its latest payment,
    // otherwise both collection and invoice total are double counted.
    { $sort: { invoiceId: 1, paidAt: -1, createdAt: -1 } },
    { $group: { _id: '$invoiceId', payment: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$payment' } },
    {
      $group: {
        _id: {
          gateway: { $ifNull: ['$gateway', '$invoice.paymentMethod'] },
          site: { $ifNull: ['$invoice.site', 'main'] },
          status: '$status',
        },
        transactions: { $sum: 1 },
        amount: { $sum: '$amount' },
        settledAmount: { $sum: { $cond: [{ $ifNull: ['$settledAt', false] }, '$amount', 0] } },
        invoiceGrandTotal: { $sum: '$invoice.grandTotal' },
      },
    },
  ]);

  const byGateway = new Map<string, GatewayTotals>();
  rows.forEach((row) => {
    const gateway = row._id.gateway || 'unknown';
    const branchId = row._id.site || 'main';
    const key = `${branchId}:${gateway}`;
    const totals =
      byGateway.get(key) ??
      ({
        gateway,
        label: gateway,
        branchId,
        branchLabel: branchLabel('site', branchId),
        transactionCount: 0,
        amount: 0,
        settledAmount: 0,
        unsettledAmount: 0,
        discrepancy: 0,
        statusBreakdown: {},
      } as GatewayTotals);
    const status = row._id.status ?? 'unknown';
    totals.statusBreakdown[status] = (totals.statusBreakdown[status] ?? 0) + row.transactions;
    totals.transactionCount += row.transactions;
    totals.amount += row.amount;
    totals.settledAmount += row.settledAmount;
    totals.discrepancy += row.amount - row.invoiceGrandTotal;
    byGateway.set(key, totals);
  });
  return Array.from(byGateway.values()).map((row) => ({
    ...row,
    unsettledAmount: row.amount - row.settledAmount,
  }));
}

export type RevenueSummary = {
  channels: ChannelTotals[];
  branches: BranchTotals[];
  gateways: GatewayTotals[];
  totals: {
    orderCount: number;
    itemCount: number;
    revenue: number;
    returnedCount: number;
    returnedRevenue: number;
    /** Recognized sales minus returned sales; this is not accounting profit. */
    netSales: number;
  };
};

export async function loadRevenueSummary(filters: RevenueFilters = {}): Promise<RevenueSummary> {
  await connectMongoose();

  const jobs: Promise<ChannelTotals>[] = [];
  const branchJobs: Promise<BranchTotals[]>[] = [];
  if (wanted(filters, 'site')) jobs.push(siteTotals(filters));
  if (wanted(filters, 'site')) branchJobs.push(siteBranchTotals(filters));
  if (wanted(filters, 'digikala'))
    jobs.push(
      marketplaceTotals(
        'digikala',
        DgkOrderModel,
        filters,
        [...DGK_BOOKED],
        DGK_RETURNED,
        'dgkOrderId',
      ),
    );
  if (wanted(filters, 'digikala'))
    branchJobs.push(
      marketplaceBranchTotals(
        'digikala',
        DgkOrderModel,
        filters,
        [...DGK_BOOKED],
        DGK_RETURNED,
        'dgkOrderId',
      ),
    );
  if (wanted(filters, 'basalaam')) jobs.push(basalaamTotals(filters));
  if (wanted(filters, 'basalaam')) branchJobs.push(basalaamBranchTotals(filters));
  if (wanted(filters, 'snapp'))
    jobs.push(
      marketplaceTotals(
        'snapp',
        SnpOrderModel,
        filters,
        [...SNP_BOOKED],
        ['returned'],
        'snpOrderId',
      ),
    );
  if (wanted(filters, 'snapp'))
    branchJobs.push(
      marketplaceBranchTotals(
        'snapp',
        SnpOrderModel,
        filters,
        [...SNP_BOOKED],
        ['returned'],
        'snpOrderId',
      ),
    );

  const [channels, branchGroups, gateways] = await Promise.all([
    Promise.all(jobs),
    Promise.all(branchJobs),
    paymentGatewayTotals(filters),
  ]);
  const branches = branchGroups.flat().sort((a, b) => b.revenue - a.revenue);

  const totals = channels.reduce(
    (acc, channel) => ({
      orderCount: acc.orderCount + channel.orderCount,
      itemCount: acc.itemCount + channel.itemCount,
      revenue: acc.revenue + channel.revenue,
      returnedCount: acc.returnedCount + channel.returnedCount,
      returnedRevenue: acc.returnedRevenue + channel.returnedRevenue,
      netSales: 0,
    }),
    {
      orderCount: 0,
      itemCount: 0,
      revenue: 0,
      returnedCount: 0,
      returnedRevenue: 0,
      netSales: 0,
    },
  );
  totals.netSales = totals.revenue - totals.returnedRevenue;

  return { channels, branches, gateways, totals };
}

export type ProductRevenueRow = {
  productId: string | null;
  title: string;
  /** Units sold across every channel in range. */
  quantity: number;
  /** Number of order lines, which is how often the item was bought. */
  orderLines: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  byChannel: Partial<
    Record<AccountingChannel, { quantity: number; revenue: number; cost: number }>
  >;
};

function bumpProduct(
  bucket: Map<string, ProductRevenueRow>,
  key: string,
  seed: { productId: string | null; title: string },
  channel: AccountingChannel,
  quantity: number,
  revenue: number,
  cost: number,
  lines: number,
) {
  const row =
    bucket.get(key) ??
    ({
      ...seed,
      quantity: 0,
      orderLines: 0,
      revenue: 0,
      cost: 0,
      grossProfit: 0,
      byChannel: {},
    } as ProductRevenueRow);
  row.quantity += quantity;
  row.revenue += revenue;
  row.cost += cost;
  row.grossProfit = row.revenue - row.cost;
  row.orderLines += lines;
  const channelRow = row.byChannel[channel] ?? { quantity: 0, revenue: 0, cost: 0 };
  channelRow.quantity += quantity;
  channelRow.revenue += revenue;
  channelRow.cost += cost;
  row.byChannel[channel] = channelRow;
  bucket.set(key, row);
}

/**
 * Units and revenue per product, unioned across every channel.
 *
 * The two sides identify a product differently: invoice lines carry `productId`,
 * marketplace rows carry only a `barcode`. `variants.barcode` is uniquely indexed
 * on the product, so it is the join key — barcodes are resolved to their product
 * in one lookup and merged into the same bucket, which is what lets a single row
 * show "sold 12 on the site and 30 on Digikala" instead of two unrelated rows.
 *
 * A barcode with no matching product still appears, keyed by barcode with the
 * marketplace's own title, rather than being dropped — unmatched revenue is a
 * data problem the operator needs to see, not one to hide.
 */
export async function loadProductRevenue(
  filters: RevenueFilters = {},
  limit = 100,
): Promise<ProductRevenueRow[]> {
  await connectMongoose();
  const bucket = new Map<string, ProductRevenueRow>();

  if (wanted(filters, 'site')) {
    const rows = await InvoiceModel.aggregate<{
      _id: unknown;
      title: string;
      quantity: number;
      revenue: number;
      cost: number;
      lines: number;
    }>([
      { $match: { ...siteFinancialDateMatch(filters), status: { $in: INVOICE_BOOKED } } },
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$lines.productId',
          title: { $first: '$lines.title' },
          quantity: { $sum: '$lines.qty' },
          // Allocate order discount and shipping proportionally to each line so
          // product totals reconcile to the invoice grand total.
          revenue: {
            $sum: {
              $cond: [
                { $gt: ['$subtotal', 0] },
                { $multiply: ['$lines.lineTotal', { $divide: ['$grandTotal', '$subtotal'] }] },
                0,
              ],
            },
          },
          cost: {
            $sum: {
              $multiply: [
                { $ifNull: ['$lines.unitCostSnapshot', 0] },
                { $ifNull: ['$lines.qty', 0] },
              ],
            },
          },
          lines: { $sum: 1 },
        },
      },
    ]);
    rows.forEach((row) => {
      const id = row._id ? String(row._id) : null;
      bumpProduct(
        bucket,
        id ?? `title:${row.title}`,
        { productId: id, title: row.title },
        'site',
        row.quantity ?? 0,
        row.revenue ?? 0,
        row.cost ?? 0,
        row.lines ?? 0,
      );
    });
  }

  const marketplaces: [AccountingChannel, MarketplaceModel, string[], readonly string[] | null][] =
    [
      ['digikala', DgkOrderModel, DGK_RETURNED, DGK_BOOKED],
      ['basalaam', BslOrderModel, [], null],
      ['snapp', SnpOrderModel, ['returned'], SNP_BOOKED],
    ];

  for (const [channel, model, returned, booked] of marketplaces) {
    if (!wanted(filters, channel)) continue;
    type Row = {
      _id: string | null;
      title: string;
      quantity: number;
      revenue: number;
      cost: number;
      lines: number;
    };
    const rows: Row[] = await (model as { aggregate: (p: unknown[]) => Promise<Row[]> }).aggregate([
      {
        $match:
          channel === 'basalaam'
            ? {
                ...dateMatch(filters),
                bslOrderStatus: { $nin: [...BSL_RETURNED_STATUS_IDS] },
              }
            : {
                ...dateMatch(filters),
                status: booked ? { $in: [...booked] } : { $nin: returned },
              },
      },
      {
        $group: {
          _id: '$barcode',
          title: { $first: '$title' },
          quantity: { $sum: '$quantity' },
          revenue: { $sum: marketplaceAccountingAmountExpression(channel) },
          cost: {
            $sum: {
              $multiply: [{ $ifNull: ['$unitCostSnapshot', 0] }, { $ifNull: ['$quantity', 0] }],
            },
          },
          lines: { $sum: 1 },
        },
      },
    ]);

    const barcodes = rows.map((row) => row._id).filter((code): code is string => Boolean(code));
    const matches = barcodes.length
      ? await ProductModel.aggregate<{ _id: unknown; barcode: string; title: string }>([
          { $match: { 'variants.barcode': { $in: barcodes } } },
          { $unwind: '$variants' },
          { $match: { 'variants.barcode': { $in: barcodes } } },
          { $project: { barcode: '$variants.barcode', title: '$title' } },
        ])
      : [];
    const productByBarcode = new Map(
      matches.map((m) => [m.barcode, { id: String(m._id), title: m.title }]),
    );

    rows.forEach((row) => {
      const match = row._id ? productByBarcode.get(row._id) : undefined;
      const key = match ? match.id : `barcode:${row._id ?? row.title}`;
      bumpProduct(
        bucket,
        key,
        { productId: match?.id ?? null, title: match?.title ?? row.title },
        channel,
        row.quantity ?? 0,
        row.revenue ?? 0,
        row.cost ?? 0,
        row.lines ?? 0,
      );
    });
  }

  return Array.from(bucket.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export type InvoiceListRow = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  customer: string;
  grandTotal: number;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  financialDate: string;
  payment: {
    gateway: string;
    status: string;
    amount: number;
    refId?: string;
    paidAt?: string;
    settledAt?: string;
    discrepancy: number;
  } | null;
  refund: { amount: number; status: string; completedAmount: number } | null;
  lines: {
    title: string;
    sku: string;
    variantSummary?: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }[];
};

/** Invoices in range, each with its priced lines, newest first. */
export async function loadInvoiceLedger(
  filters: RevenueFilters = {},
  limit = 50,
  skip = 0,
): Promise<{ rows: InvoiceListRow[]; total: number }> {
  await connectMongoose();
  if (filters.channels?.length && !filters.channels.includes('site')) {
    return { rows: [], total: 0 };
  }
  const match: Record<string, unknown> = {
    ...siteFinancialDateMatch(filters),
    ...(filters.invoiceStatus ? { status: filters.invoiceStatus } : {}),
  };
  if (filters.invoiceQuery) {
    const safe = filters.invoiceQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    match.$or = [
      { number: { $regex: safe, $options: 'i' } },
      { 'addressSnapshot.fname': { $regex: safe, $options: 'i' } },
      { 'addressSnapshot.lname': { $regex: safe, $options: 'i' } },
      { 'addressSnapshot.phone': { $regex: safe, $options: 'i' } },
    ];
  }
  const sort: Record<string, 1 | -1> =
    filters.invoiceSort === 'amount_asc'
      ? { grandTotal: 1 as const }
      : filters.invoiceSort === 'amount_desc'
        ? { grandTotal: -1 as const }
        : filters.invoiceSort === 'financial_asc'
          ? { financialSortDate: 1 as const, _id: 1 as const }
          : { financialSortDate: -1 as const, _id: -1 as const };

  const financialSortDate = {
    $ifNull: [
      { $cond: [{ $eq: ['$status', 'refunded'] }, '$refundedAt', '$paidAt'] },
      '$createdAt',
    ],
  };

  const [docs, total] = await Promise.all([
    InvoiceModel.aggregate([
      { $match: match },
      { $addFields: { financialSortDate } },
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
      { $project: { financialSortDate: 0 } },
    ]),
    InvoiceModel.countDocuments(match),
  ]);

  const rawDocs = docs as unknown as Record<string, any>[];
  const invoiceIds = rawDocs.map((doc) => doc._id);
  const [payments, refunds] = await Promise.all([
    PaymentTransactionModel.find({
      invoiceId: { $in: invoiceIds },
      status: { $in: ['verified', 'paid'] },
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .lean(),
    RefundModel.find({ invoiceId: { $in: invoiceIds } }).lean(),
  ]);
  const paymentByInvoice = new Map<string, Record<string, any>>();
  for (const payment of payments as unknown as Record<string, any>[]) {
    const key = String(payment.invoiceId);
    if (!paymentByInvoice.has(key)) paymentByInvoice.set(key, payment);
  }
  const refundsByInvoice = new Map<string, Record<string, any>[]>();
  for (const refund of refunds as unknown as Record<string, any>[]) {
    const key = String(refund.invoiceId);
    refundsByInvoice.set(key, [...(refundsByInvoice.get(key) ?? []), refund]);
  }

  const rows: InvoiceListRow[] = rawDocs.map((doc) => {
    const payment = paymentByInvoice.get(String(doc._id));
    const invoiceRefunds = refundsByInvoice.get(String(doc._id)) ?? [];
    const refundAmount = invoiceRefunds.reduce((sum, refund) => sum + (refund.amount ?? 0), 0);
    const completedAmount = invoiceRefunds
      .filter((refund) => refund.status === 'completed')
      .reduce((sum, refund) => sum + (refund.amount ?? 0), 0);
    return {
      id: String(doc._id),
      number: doc.number ?? '',
      status: doc.status ?? 'unknown',
      createdAt:
        doc.createdAt instanceof Date
          ? doc.createdAt.toISOString()
          : new Date(doc.createdAt).toISOString(),
      customer: [doc.addressSnapshot?.fname, doc.addressSnapshot?.lname].filter(Boolean).join(' '),
      grandTotal: doc.grandTotal ?? 0,
      subtotal: doc.subtotal ?? 0,
      discountTotal: doc.discountTotal ?? 0,
      shippingTotal: doc.shippingTotal ?? 0,
      financialDate: resolveInvoiceFinancialDate({
        status: doc.status,
        createdAt: doc.createdAt,
        paidAt: doc.paidAt,
        refundedAt: doc.refundedAt,
      }).toISOString(),
      payment: payment
        ? {
            gateway: payment.gateway ?? '',
            status: payment.status ?? '',
            amount: payment.amount ?? 0,
            refId: payment.refId ?? undefined,
            paidAt: payment.paidAt ? new Date(payment.paidAt).toISOString() : undefined,
            settledAt: payment.settledAt ? new Date(payment.settledAt).toISOString() : undefined,
            discrepancy: (payment.amount ?? 0) - (doc.grandTotal ?? 0),
          }
        : null,
      refund: invoiceRefunds.length
        ? {
            amount: refundAmount,
            status: invoiceRefunds.at(-1)?.status ?? 'recorded',
            completedAmount,
          }
        : null,
      lines: (doc.lines ?? []).map((line: Record<string, any>) => ({
        title: line.title ?? '',
        sku: line.sku ?? '',
        variantSummary: line.variantSummary ?? undefined,
        qty: line.qty ?? 0,
        unitPrice: line.unitPriceEffective ?? 0,
        lineTotal: line.lineTotal ?? 0,
      })),
    };
  });

  return { rows, total };
}
