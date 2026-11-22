export const CHANNELS = [
  { key: 'site', label: 'فروشگاه سایت' },
  { key: 'digikala', label: 'دیجی‌کالا' },
  { key: 'basalaam', label: 'باسلام' },
  { key: 'snapp', label: 'اسنپ‌شاپ' },
] as const;

export type ChannelKey = (typeof CHANNELS)[number]['key'];

export type Summary = {
  channels: Array<{
    channel: ChannelKey;
    label: string;
    orderCount: number;
    itemCount: number;
    revenue: number;
    returnedCount: number;
    returnedRevenue: number;
    statusBreakdown: Record<string, number>;
  }>;
  branches: Array<{
    channel: ChannelKey;
    label: string;
    branchId: string;
    branchLabel: string;
    orderCount: number;
    itemCount: number;
    revenue: number;
    returnedCount: number;
    returnedRevenue: number;
    statusBreakdown: Record<string, number>;
  }>;
  gateways: Array<{
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
  }>;
  totals: {
    orderCount: number;
    itemCount: number;
    revenue: number;
    returnedCount: number;
    returnedRevenue: number;
    netSales: number;
  };
};

export type ProductRow = {
  productId: string | null;
  title: string;
  quantity: number;
  orderLines: number;
  revenue: number;
  cost: number;
  grossProfit: number;
  byChannel: Partial<Record<ChannelKey, { quantity: number; revenue: number; cost: number }>>;
};

export type InvoiceRow = {
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
  lines: Array<{
    title: string;
    sku: string;
    variantSummary?: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};
