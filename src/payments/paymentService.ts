import mongoose from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import { buildCallbackUrl, ensureAppBaseUrl, normalizeCallbackPath } from '@/payments/paymentCalc';
import { getZarinpalClient } from '@/payments/zarinpalAdapter';
import { getTorobClient } from '@/payments/torobAdapter';
import { getAzkivamClient } from '@/payments/azkivamAdapter';
import { getDigipayClient } from '@/payments/digipayAdapter';
import { getSnappPayClient } from '@/payments/snapppayAdapter';
import { PaymentTransactionModel, type PaymentTransactionDocument } from '@/models/Payment';
import { InvoiceModel, type InvoiceDocument } from '@/models/Invoice';
import ProductModel from '@/catalog/models/Product';
import CategoryModel from '@/catalog/models/Category';
import { updateInvoiceStatus } from '@/orders/services/invoiceService';
import { supportsMongoTransactions } from '@/lib/mongo';
import { logErrorLater } from '@/observability/error-log';
import {
  buildSnappPayAmounts,
  buildSnappPayCartList,
  normalizeSnappPayMobileNumber,
  type SnappPayGatewayCart,
  type SnappPayGatewayCartItem,
} from '@/payments/snappPayCalc';

export { buildSnappPayAmounts, buildSnappPayCartList, normalizeSnappPayMobileNumber };

export type PaymentGateway = 'zarinpal' | 'torob' | 'azkivam' | 'digipay' | 'snapppay';

interface CreatePaymentInput {
  invoiceId: string;
  userId: string;
  amount: number;
  description?: string;
  email?: string;
  mobile?: string;
  gateway?: PaymentGateway;
}

interface CreatePaymentResult {
  gatewayUrl: string;
  authority: string;
  transactionId: string;
}

interface VerifyInput {
  authority?: string;
  invoiceId: string;
  transactionId: string;
  digipay?: {
    trackingCode?: string;
    providerId?: string;
    result?: string;
    type?: string;
    amount?: string;
  };
  snapppay?: {
    transactionId?: string;
    state?: string;
    amount?: string;
  };
}

interface VerifyResult {
  ok: boolean;
  code: number;
  refId?: string;
  message?: string;
}

type TorobSettleResult =
  | { ok: true; alreadySettled?: boolean }
  | { ok: false; reason: string; code?: number };

type SnappPayMutationResult =
  | { ok: true; transactionId?: string }
  | { ok: false; reason: string; code?: number };

export type SnappPayEligibilityResult =
  | {
    enabled: true;
    title: string;
    description: string;
  }
  | { enabled: false; reason?: string };

type SnappPayUpdateCartItemInput = {
  id: string | number;
  name: string;
  count: number;
  amountToman: number;
  category: string;
  commissionType: number;
};

type SnappPayUpdateCartInput = {
  cartId: string | number;
  isShipmentIncluded: boolean;
  isTaxIncluded: boolean;
  shippingAmountToman: number;
  taxAmountToman: number;
  cartItems: SnappPayUpdateCartItemInput[];
};

type SnappPayUpdateInput = {
  discountAmountToman: number;
  externalSourceAmountToman: number;
  cartList: SnappPayUpdateCartInput[];
};

type SnappPayPreparedUpdatePayload = {
  amountRial: number;
  discountAmountRial: number;
  externalSourceAmountRial: number;
  cartList: SnappPayGatewayCart[];
  amountFormula: Record<string, unknown>;
  request: SnappPayUpdateInput;
};

type SnappPayPreparedUpdateResult =
  | { ok: true; payload: SnappPayPreparedUpdatePayload }
  | { ok: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function updateInvoicePaymentContext(
  invoice: InvoiceDocument,
  paymentMethod: string,
  patch: Record<string, unknown>,
  session?: mongoose.ClientSession,
) {
  const current = isRecord(invoice.paymentMethodData) ? invoice.paymentMethodData : {};
  const paymentMethodData = {
    ...current,
    ...patch,
    paymentMethod,
    updatedAt: new Date(),
  };

  await InvoiceModel.updateOne(
    { _id: invoice._id },
    {
      $set: {
        paymentMethod,
        paymentMethodData,
      },
    },
    session ? { session } : undefined,
  ).exec();

  invoice.paymentMethod = paymentMethod;
  invoice.paymentMethodData = paymentMethodData;
}

function getZarinpalEnv() {
  const merchantId = process.env.ZARINPAL_MERCHANT_ID;
  if (!merchantId) {
    throw new Error('ZARINPAL_MERCHANT_ID is not configured');
  }

  const sandbox = process.env.ZARINPAL_SANDBOX === 'true' || process.env.NODE_ENV === 'development';
  return { merchantId, sandbox };
}

function getTorobEnv() {
  const baseUrl = process.env.TOROBPAY_BASE_URL ?? 'https://cpg.torobpay.com';
  const clientId = process.env.TOROBPAY_CLIENT_ID;
  const clientSecret = process.env.TOROBPAY_CLIENT_SECRET;
  const username = process.env.TOROBPAY_USERNAME;
  const password = process.env.TOROBPAY_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('TOROBPAY credentials are not configured');
  }

  return { baseUrl, clientId, clientSecret, username, password };
}

function getAzkivamEnv() {
  const baseUrl = process.env.AZKIVAM_BASE_URL ?? 'https://api.azkiloan.com';
  const merchantId = process.env.AZKIVAM_MERCHANT_ID;
  const username = process.env.AZKIVAM_USERNAME;
  const password = process.env.AZKIVAM_PASSWORD;
  const apiKey =
    process.env.AZKIVAM_API_KEY ??
    process.env.AZKIVAM_CONNECTION_KEY ??
    process.env.AZKIVAM_SIGNATURE_KEY;

  if (!merchantId || (!apiKey && (!username || !password))) {
    throw new Error('AZKIVAM credentials are not configured');
  }

  return { baseUrl, merchantId, username, password, apiKey };
}

function getDigipayEnv() {
  const baseUrl = process.env.DIGIPAY_BASE_URL ?? 'https://api.mydigipay.com/digipay/api';
  const clientId = process.env.DIGIPAY_CLIENT_ID;
  const clientSecret = process.env.DIGIPAY_CLIENT_SECRET;
  const username = process.env.DIGIPAY_USERNAME;
  const password = process.env.DIGIPAY_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('DIGIPAY credentials are not configured');
  }

  return { baseUrl, clientId, clientSecret, username, password };
}

function getSnappPayEnv() {
  // NOTE: the staging host includes the `okd4` segment — without it the gateway
  // returns 503 and the SnappPay option never shows. Override with
  // SNAPPPAY_BASE_URL (e.g. the production host) in env.
  const baseUrl = process.env.SNAPPPAY_BASE_URL ?? 'https://fms-gateway-staging.apps.public.okd4.teh-1.snappcloud.io';
  const clientId = process.env.SNAPPPAY_CLIENT_ID;
  const clientSecret = process.env.SNAPPPAY_CLIENT_SECRET;
  const username = process.env.SNAPPPAY_USERNAME;
  const password = process.env.SNAPPPAY_PASSWORD;
  const venture = process.env.SNAPPPAY_VENTURE;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('SNAPPPAY credentials are not configured');
  }

  return { baseUrl, clientId, clientSecret, username, password, venture };
}

function getCallbackBase() {
  const baseUrl = ensureAppBaseUrl(process.env.APP_BASE_URL);
  const callbackPath = normalizeCallbackPath(process.env.PAYMENT_CALLBACK_PATH);
  return { baseUrl, callbackPath };
}

function getTorobCallbackPath() {
  return normalizeCallbackPath(process.env.TOROBPAY_CALLBACK_PATH ?? '/api/payments/torob/callback');
}

function getDigipayCallbackPath() {
  return normalizeCallbackPath(process.env.DIGIPAY_CALLBACK_PATH ?? '/api/payments/digipay/callback');
}

function getSnappPayCallbackPath() {
  return normalizeCallbackPath(process.env.SNAPPPAY_CALLBACK_PATH ?? '/api/payments/snapppay/callback');
}

function buildGatewayCallbackUrl(input: {
  baseUrl: string;
  path: string;
  invoiceId: string;
  transactionId: mongoose.Types.ObjectId | string;
  gateway: PaymentGateway;
  state?: string;
}) {
  const url = new URL(
    buildCallbackUrl(input.baseUrl, input.path, input.invoiceId, input.transactionId),
  );
  url.searchParams.set('gateway', input.gateway);
  if (input.state) {
    url.searchParams.set('state', input.state);
  }
  return url.toString();
}

async function loadInvoice(invoiceId: string) {
  const invoice = await InvoiceModel.findById(invoiceId).exec();
  if (!invoice) {
    throw new Error('invoice_not_found');
  }
  return invoice;
}

function ensureInvoicePayable(invoice: InvoiceDocument, amount: number) {
  if (invoice.status === 'paid') {
    throw new Error('invoice_already_paid');
  }
  if (invoice.grandTotal !== amount) {
    throw new Error('invoice_amount_mismatch');
  }
}

function tomanToRial(amount: number) {
  return Math.max(0, Math.floor(amount)) * 10;
}

function rialToToman(amountRial: number) {
  return Math.max(0, Math.floor(amountRial / 10));
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

type InvoiceLine = InvoiceDocument['lines'][number];
type SnappPayInvoiceLine = {
  title: string;
  priceModel: 'fixed' | 'per_unit';
  qty?: number;
  requestedQty?: number;
  unitPriceBase: number;
  unitPriceEffective: number;
  variantOfferAmount?: number;
  lineTotal: number;
  [key: string]: unknown;
};

function cloneInvoiceLine(line: InvoiceLine): SnappPayInvoiceLine {
  if (line && typeof (line as { toObject?: () => SnappPayInvoiceLine }).toObject === 'function') {
    return (line as { toObject: () => SnappPayInvoiceLine }).toObject();
  }
  return { ...line } as SnappPayInvoiceLine;
}

function buildInvoiceLinesFromSnappPayUpdate(
  existingLines: InvoiceLine[],
  request: SnappPayUpdateInput,
): SnappPayInvoiceLine[] {
  const firstCart = request.cartList[0];
  if (!firstCart || firstCart.cartItems.length === 0) {
    return existingLines.map(cloneInvoiceLine);
  }

  const templateLine = existingLines[0] ? cloneInvoiceLine(existingLines[0]) : null;
  const updatedLines: SnappPayInvoiceLine[] = [];

  for (const item of firstCart.cartItems) {
    const normalizedId =
      typeof item.id === 'number' ? Math.floor(item.id) : Number.parseInt(String(item.id), 10);
    const sourceIndex = Number.isFinite(normalizedId) && normalizedId > 0 ? normalizedId - 1 : -1;
    const sourceLine =
      sourceIndex >= 0 && sourceIndex < existingLines.length
        ? cloneInvoiceLine(existingLines[sourceIndex])
        : templateLine;

    if (!sourceLine) {
      continue;
    }

    const count = Math.max(1, Math.floor(item.count));
    const unitPriceToman = Math.max(0, Math.floor(item.amountToman));
    const lineTotal = unitPriceToman * count;
    const title = item.name?.trim() || sourceLine.title;

    if (sourceLine.priceModel === 'per_unit') {
      updatedLines.push({
        ...sourceLine,
        title,
        requestedQty: count,
        unitPriceBase: unitPriceToman,
        unitPriceEffective: unitPriceToman,
        variantOfferAmount: 0,
        lineTotal,
      });
    } else {
      updatedLines.push({
        ...sourceLine,
        title,
        qty: count,
        unitPriceBase: unitPriceToman,
        unitPriceEffective: unitPriceToman,
        variantOfferAmount: 0,
        lineTotal,
      });
    }
  }

  return updatedLines;
}

async function persistSnappPayUpdateToInvoice(
  invoice: InvoiceDocument,
  transaction: PaymentTransactionDocument,
  payload: SnappPayPreparedUpdatePayload,
) {
  const request = payload.request;
  const firstCart = request.cartList[0];
  const lines = buildInvoiceLinesFromSnappPayUpdate(invoice.lines ?? [], request);
  const subtotal = lines.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0);
  const shippingTotal = firstCart
    ? firstCart.isShipmentIncluded
      ? 0
      : Math.max(0, Math.floor(firstCart.shippingAmountToman))
    : (invoice.shippingTotal ?? 0);
  const discountTotal = Math.max(0, Math.floor(request.discountAmountToman));
  const grandTotal = rialToToman(payload.amountRial);

  await InvoiceModel.updateOne(
    { _id: invoice._id },
    {
      $set: {
        lines,
        subtotal,
        discountTotal,
        shippingTotal,
        shippingPrice: shippingTotal,
        grandTotal,
      },
    },
  ).exec();

  await PaymentTransactionModel.updateOne(
    { _id: transaction._id },
    { $set: { amount: grandTotal } },
  ).exec();

  invoice.lines = lines as unknown as InvoiceDocument['lines'];
  invoice.subtotal = subtotal;
  invoice.discountTotal = discountTotal;
  invoice.shippingTotal = shippingTotal;
  invoice.shippingPrice = shippingTotal;
  invoice.grandTotal = grandTotal;
  transaction.amount = grandTotal;
}

async function ensureSnappPaySettledForUpdate(
  client: ReturnType<typeof getSnappPayClient>,
  paymentToken: string,
): Promise<{ ok: true } | { ok: false; reason: string; code?: number }> {
  const statusResult = await client.getPaymentStatus(paymentToken);
  if (!statusResult.ok) {
    return { ok: false, reason: 'snapppay_status_check_failed', code: statusResult.code };
  }

  const status = statusResult.status?.toUpperCase();
  if (status === 'SETTLE') {
    return { ok: true };
  }

  if (status === 'VERIFY') {
    const settleResult = await client.settlePayment(paymentToken);
    if (settleResult.ok) {
      return { ok: true };
    }

    const recheck = await client.getPaymentStatus(paymentToken);
    if (recheck.status?.toUpperCase() === 'SETTLE') {
      return { ok: true };
    }

    return { ok: false, reason: 'snapppay_settle_before_update_failed', code: settleResult.code };
  }

  return { ok: false, reason: 'snapppay_transaction_not_ready_for_update', code: statusResult.code };
}

async function callSnappPayUpdatePayment(
  client: ReturnType<typeof getSnappPayClient>,
  input: {
    paymentToken: string;
    amountRial: number;
    discountAmountRial: number;
    externalSourceAmountRial: number;
    cartList: SnappPayGatewayCart[];
  },
) {
  let result = await client.updatePayment(input);
  if (result.ok || result.code !== 1053) {
    return result;
  }

  await delay(3000);
  result = await client.updatePayment(input);
  if (result.ok || result.code !== 1011) {
    return result;
  }

  const statusResult = await client.getPaymentStatus(input.paymentToken);
  const status = statusResult.status?.toUpperCase();
  if (status === 'VERIFY') {
    const settleResult = await client.settlePayment(input.paymentToken);
    if (!settleResult.ok) {
      const recheck = await client.getPaymentStatus(input.paymentToken);
      if (recheck.status?.toUpperCase() !== 'SETTLE') {
        return result;
      }
    }
    await delay(3000);
    return client.updatePayment(input);
  }

  return result;
}

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = trimmed.replace(/,/g, '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function buildTorobCartList(invoice: InvoiceDocument): Array<Record<string, unknown>> {
  const items = (invoice.lines ?? []).map((line) => ({
    id: line.variantId?.toString() ?? line.productId?.toString() ?? line.sku,
    name: line.title,
    count: Math.max(1, Math.floor(line.qty ?? line.requestedQty ?? 1)),
    amount: tomanToRial(line.lineTotal ?? 0),
    category: 'general',
    commissionType: 'DEFAULT',
  }));

  return [
    {
      cartId: invoice._id.toString(),
      totalAmount: tomanToRial(invoice.grandTotal ?? 0),
      taxAmount: 0,
      shippingAmount: tomanToRial(invoice.shippingTotal ?? 0),
      isTaxIncluded: true,
      isShipmentIncluded: true,
      cartItems: items,
    },
  ];
}

function getSnappPayPaymentMethodTypes(): string[] | undefined {
  const raw = process.env.SNAPPPAY_PAYMENT_METHOD_TYPES;
  if (!raw) {
    return undefined;
  }

  const values = raw
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  return values.length > 0 ? values : undefined;
}

function buildSnappPayProviderTransactionId(transactionId: mongoose.Types.ObjectId | string): string {
  const hex = transactionId.toString().replace(/[^a-fA-F0-9]/g, '').slice(-12) || Date.now().toString(16);
  const numeric = parseInt(hex, 16);
  return String(1_000_000_000 + (numeric % 9_000_000_000));
}

type AzkivamItemPayload = {
  name: string;
  count: number;
  amount: number;
  url: string;
};

function sumAzkivamItems(items: AzkivamItemPayload[]): number {
  return items.reduce((sum, item) => sum + item.amount * item.count, 0);
}

function normalizeAzkivamMobileNumber(value: string | undefined): string {
  const digits = (value ?? '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+98')) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith('98') && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function buildAzkivamItems(invoice: InvoiceDocument): AzkivamItemPayload[] {
  const baseUrl = ensureAppBaseUrl(process.env.APP_BASE_URL).replace(/\/$/, '');
  const s: AzkivamItemPayload[] = [];

  for (const line of invoice.lines ?? []) {
    const count =
      line.priceModel === 'fixed'
        ? Math.max(1, Math.floor(line.qty ?? 1))
        : 1;
    const lineTotalToman =
      typeof line.lineTotal === 'number' && Number.isFinite(line.lineTotal)
        ? line.lineTotal
        : (line.unitPriceEffective ?? 0) * count;
    const name = line.title.concat(" ", line.variantSummary?.replace(/\/ weightGrams: [0-9]+/g, "") || "");
    const url = `${baseUrl}/product/${line.productSlug}`;

    const amountToman = Math.floor(lineTotalToman / count);
    const lineRemainderToman = Math.floor(lineTotalToman) - amountToman * count;

    s.push({
      name,
      count,
      amount: tomanToRial(amountToman),
      url,
    });

    if (lineRemainderToman > 0) {
      s.push({
        name: `${name} - تعدیل مبلغ`,
        count: 1,
        amount: tomanToRial(lineRemainderToman),
        url,
      });
    }
  }

  if (invoice.transportName && invoice.shippingTotal) {
    s.push({
      name: `حمل و نقل‌ (${invoice.transportName})`,
      count: 1,
      amount: tomanToRial(invoice.shippingTotal ?? 0),
      url: `${baseUrl}/cart/`,
    })
  }

  if ((invoice.discountTotal ?? 0) > 0) {
    s.push({
      name: 'تخفیف',
      count: 1,
      amount: -tomanToRial(invoice.discountTotal ?? 0),
      url: `${baseUrl}/cart/`,
    });
  }

  return s;
}

function buildAzkivamPaymentPayload(invoice: InvoiceDocument, providerId: number, mobileNumber: string) {
  const amountRial = tomanToRial(invoice.grandTotal ?? 0);
  const items = buildAzkivamItems(invoice);
  const itemsTotalRial = sumAzkivamItems(items);

  if (itemsTotalRial !== amountRial) {
    throw new Error(`azkivam_items_total_mismatch:${amountRial}:${itemsTotalRial}`);
  }

  return {
    amountRial,
    providerId,
    mobileNumber,
    items,
    requestSnapshot: {
      amount: amountRial,
      provider_id: providerId,
      mobile_number: mobileNumber,
      merchant_id: getAzkivamEnv().merchantId,
      items,
    },
  };
}

// SnappPay requires each cart item's `category` in Persian. Invoice lines only
// store productId, so resolve the product's primary category name here.
async function resolveSnappPayLineCategories(invoice: InvoiceDocument): Promise<Map<string, string>> {
  const productIds = [...new Set((invoice.lines ?? []).map((line) => String(line.productId)).filter(Boolean))];
  if (!productIds.length) return new Map();

  const products = await ProductModel.find({ _id: { $in: productIds } }, { categories: 1 }).lean();
  const categoryIds = [...new Set(products.flatMap((p) => (p.categories ?? []).map((c) => String(c))))];
  const categories = categoryIds.length
    ? await CategoryModel.find({ _id: { $in: categoryIds } }, { name: 1 }).lean()
    : [];
  const nameById = new Map(categories.map((c) => [String(c._id), String(c.name ?? '')]));

  const byProduct = new Map<string, string>();
  for (const product of products) {
    const firstCategory = (product.categories ?? [])[0];
    const name = firstCategory ? nameById.get(String(firstCategory)) : undefined;
    if (name) byProduct.set(String(product._id), name);
  }
  return byProduct;
}

function buildSnappPayUpdatePayloadFromInvoice(
  invoice: InvoiceDocument,
  categoryByProductId?: Map<string, string>,
): SnappPayPreparedUpdatePayload {
  const amounts = buildSnappPayAmounts(invoice);
  const cartList = buildSnappPayCartList(invoice, categoryByProductId);

  const request: SnappPayUpdateInput = {
    discountAmountToman: Math.max(0, Math.floor(invoice.discountTotal ?? 0)),
    externalSourceAmountToman: 0,
    cartList: cartList.map((cart) => ({
      cartId: cart.cartId,
      isShipmentIncluded: cart.isShipmentIncluded,
      isTaxIncluded: cart.isTaxIncluded,
      shippingAmountToman: Math.max(0, Math.floor(cart.shippingAmount / 10)),
      taxAmountToman: Math.max(0, Math.floor(cart.taxAmount / 10)),
      cartItems: cart.cartItems.map((item) => ({
        id: item.id,
        name: item.name,
        count: item.count,
        amountToman: Math.max(0, Math.floor(item.amount / 10)),
        category: item.category,
        commissionType: item.commissionType,
      })),
    })),
  };

  return {
    amountRial: amounts.amountRial,
    discountAmountRial: amounts.discountAmountRial,
    externalSourceAmountRial: amounts.externalSourceAmountRial,
    cartList,
    amountFormula: amounts,
    request,
  };
}

function prepareSnappPayUpdatePayload(rawInput: unknown): SnappPayPreparedUpdateResult {
  if (!isRecord(rawInput)) {
    return { ok: false, reason: 'snapppay_update_invalid_payload' };
  }

  const rawCartList = rawInput.cartList;
  if (!Array.isArray(rawCartList) || rawCartList.length === 0) {
    return { ok: false, reason: 'snapppay_update_cart_list_missing' };
  }

  const parsedCartList: SnappPayGatewayCart[] = [];
  const requestCartList: SnappPayUpdateCartInput[] = [];
  let cartsTotalAmountRial = 0;

  for (let cartIndex = 0; cartIndex < rawCartList.length; cartIndex += 1) {
    const rawCart = rawCartList[cartIndex];
    if (!isRecord(rawCart)) {
      return { ok: false, reason: 'snapppay_update_invalid_payload' };
    }

    const rawItems = rawCart.cartItems;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return { ok: false, reason: 'snapppay_update_cart_items_missing' };
    }

    const shippingAmountToman = readFiniteNumber(rawCart.shippingAmountToman);
    const taxAmountToman = readFiniteNumber(rawCart.taxAmountToman);
    if (
      shippingAmountToman === null ||
      taxAmountToman === null ||
      shippingAmountToman < 0 ||
      taxAmountToman < 0
    ) {
      return { ok: false, reason: 'snapppay_update_invalid_amount' };
    }

    const isShipmentIncluded = readBoolean(rawCart.isShipmentIncluded, false);
    const isTaxIncluded = readBoolean(rawCart.isTaxIncluded, false);

    const shippingAmountRial = tomanToRial(shippingAmountToman);
    const taxAmountRial = tomanToRial(taxAmountToman);

    const parsedItems: SnappPayGatewayCartItem[] = [];
    const requestItems: SnappPayUpdateCartItemInput[] = [];
    let cartItemsTotalAmountRial = 0;

    for (let itemIndex = 0; itemIndex < rawItems.length; itemIndex += 1) {
      const rawItem = rawItems[itemIndex];
      if (!isRecord(rawItem)) {
        return { ok: false, reason: 'snapppay_update_invalid_payload' };
      }

      const name = typeof rawItem.name === 'string' ? rawItem.name.trim() : '';
      const countValue = readFiniteNumber(rawItem.count);
      const amountTomanValue = readFiniteNumber(rawItem.amountToman);
      const commissionTypeValue = readFiniteNumber(rawItem.commissionType);
      if (
        !name ||
        countValue === null ||
        amountTomanValue === null ||
        countValue < 1 ||
        amountTomanValue <= 0 ||
        (commissionTypeValue !== null && commissionTypeValue < 1)
      ) {
        return { ok: false, reason: 'snapppay_update_invalid_amount' };
      }

      const count = Math.max(1, Math.floor(countValue));
      const amountToman = Math.max(0, Math.floor(amountTomanValue));
      const amountRial = tomanToRial(amountToman);
      const itemTotalAmountRial = amountRial * count;
      cartItemsTotalAmountRial += itemTotalAmountRial;

      const category =
        typeof rawItem.category === 'string' && rawItem.category.trim().length > 0
          ? rawItem.category.trim()
          : 'general';
      const commissionType =
        commissionTypeValue !== null ? Math.max(1, Math.floor(commissionTypeValue)) : 100;

      const idValue = readFiniteNumber(rawItem.id);
      const normalizedId = idValue !== null && idValue > 0 ? Math.floor(idValue) : itemIndex + 1;

      parsedItems.push({
        id: normalizedId,
        name,
        count,
        amount: amountRial,
        category,
        commissionType,
      });
      requestItems.push({
        id: normalizedId,
        name,
        count,
        amountToman,
        category,
        commissionType,
      });
    }

    const totalAmountRial =
      cartItemsTotalAmountRial + (isShipmentIncluded ? 0 : shippingAmountRial) + (isTaxIncluded ? 0 : taxAmountRial);
    cartsTotalAmountRial += totalAmountRial;

    const cartIdValue = readFiniteNumber(rawCart.cartId);
    const normalizedCartId = cartIdValue !== null && cartIdValue > 0 ? Math.floor(cartIdValue) : cartIndex + 1;

    parsedCartList.push({
      cartId: normalizedCartId,
      totalAmount: totalAmountRial,
      taxAmount: taxAmountRial,
      shippingAmount: shippingAmountRial,
      isTaxIncluded,
      isShipmentIncluded,
      cartItems: parsedItems,
    });

    requestCartList.push({
      cartId: normalizedCartId,
      isShipmentIncluded,
      isTaxIncluded,
      shippingAmountToman: Math.max(0, Math.floor(shippingAmountToman)),
      taxAmountToman: Math.max(0, Math.floor(taxAmountToman)),
      cartItems: requestItems,
    });
  }

  const discountAmountToman = readFiniteNumber(rawInput.discountAmountToman);
  const externalSourceAmountToman = readFiniteNumber(rawInput.externalSourceAmountToman);
  if (
    discountAmountToman === null ||
    externalSourceAmountToman === null ||
    discountAmountToman < 0 ||
    externalSourceAmountToman < 0
  ) {
    return { ok: false, reason: 'snapppay_update_invalid_amount' };
  }

  const discountAmountRial = tomanToRial(discountAmountToman);
  const externalSourceAmountRial = tomanToRial(externalSourceAmountToman);
  const amountRial = cartsTotalAmountRial - discountAmountRial - externalSourceAmountRial;
  if (amountRial <= 0) {
    return { ok: false, reason: 'snapppay_update_invalid_amount' };
  }

  return {
    ok: true,
    payload: {
      amountRial,
      discountAmountRial,
      externalSourceAmountRial,
      cartList: parsedCartList,
      amountFormula: {
        cartsTotalAmountRial,
        discountAmountRial,
        externalSourceAmountRial,
        amountRial,
      },
      request: {
        discountAmountToman: Math.max(0, Math.floor(discountAmountToman)),
        externalSourceAmountToman: Math.max(0, Math.floor(externalSourceAmountToman)),
        cartList: requestCartList,
      },
    },
  };
}

function generateAzkivamProviderId() {
  return Math.floor(Date.now() / 10) * 1000 + Math.floor(Math.random() * 1000);
}

function getDigipayPreferredGateway() {
  const raw = process.env.DIGIPAY_PREFERRED_GATEWAY;
  if (!raw) {
    return 2;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveTorobPaymentToken(transaction: PaymentTransactionDocument): string | undefined {
  const meta = (transaction.meta ?? {}) as { paymentToken?: unknown };
  if (typeof meta.paymentToken === 'string' && meta.paymentToken.trim().length > 0) {
    return meta.paymentToken.trim();
  }
  if (typeof transaction.authority === 'string' && transaction.authority.trim().length > 0) {
    return transaction.authority.trim();
  }
  return undefined;
}

function resolvePaymentToken(transaction: PaymentTransactionDocument): string | undefined {
  const meta = isRecord(transaction.meta) ? transaction.meta : {};
  const paymentToken = meta.paymentToken;
  if (typeof paymentToken === 'string' && paymentToken.trim().length > 0) {
    return paymentToken.trim();
  }
  if (typeof transaction.authority === 'string' && transaction.authority.trim().length > 0) {
    return transaction.authority.trim();
  }
  return undefined;
}

function resolveSnappPayProviderTransactionId(
  transaction: PaymentTransactionDocument,
): string | undefined {
  const meta = isRecord(transaction.meta) ? transaction.meta : {};
  const value = meta.snappPayProviderTransactionId;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function resolveAzkivamTicketId(transaction: PaymentTransactionDocument): string | undefined {
  const meta = isRecord(transaction.meta) ? transaction.meta : {};
  const ticketId = meta.ticketId;
  if (typeof ticketId === 'string' && ticketId.trim().length > 0) {
    return ticketId.trim();
  }
  if (typeof transaction.authority === 'string' && transaction.authority.trim().length > 0) {
    return transaction.authority.trim();
  }
  return undefined;
}

function resolveDigipayProviderId(transaction: PaymentTransactionDocument): string | undefined {
  const meta = isRecord(transaction.meta) ? transaction.meta : {};
  const providerId = meta.providerId;
  if (typeof providerId === 'string' && providerId.trim().length > 0) {
    return providerId.trim();
  }
  return transaction._id.toString();
}

async function finalizeSuccessfulPayment(
  transaction: PaymentTransactionDocument,
  invoice: InvoiceDocument,
  refId: string | null | undefined,
  verifyPayload: unknown,
) {
  const applyPayment = async (session?: mongoose.ClientSession) => {
    const txDoc = await PaymentTransactionModel.findById(transaction._id).session(session ?? null);
    if (!txDoc) {
      throw new Error('transaction_not_found');
    }
    if (txDoc.status !== 'paid') {
      txDoc.status = 'paid';
      txDoc.refId = refId ?? txDoc.refId;
      txDoc.verifyPayload = verifyPayload;
      txDoc.errorCode = undefined;
      txDoc.errorMessage = undefined;
      await txDoc.save({ session });
    }

    await updateInvoicePaymentContext(
      invoice,
      transaction.gateway,
      {
        transactionId: txDoc._id.toString(),
        authority: txDoc.authority ?? undefined,
        refId: txDoc.refId ?? refId ?? undefined,
        status: 'paid',
        paidAt: new Date(),
        verify: verifyPayload,
      },
      session,
    );

    const statusResult = await updateInvoiceStatus(invoice._id.toString(), 'paid', session);
    if (!statusResult.ok) {
      throw new Error(`invoice_status_update_failed:${statusResult.reason}`);
    }
  };

  if (!supportsMongoTransactions()) {
    await applyPayment();
    return;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await applyPayment(session);
    });
  } catch (error) {
    if ((error as { code?: number }).code === 20) {
      await applyPayment();
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }
}

async function finalizeVerifiedTorobPayment(
  transaction: PaymentTransactionDocument,
  invoice: InvoiceDocument,
  refId: string | null | undefined,
  verifyPayload: unknown,
) {
  const applyVerification = async (session?: mongoose.ClientSession) => {
    const txDoc = await PaymentTransactionModel.findById(transaction._id).session(session ?? null);
    if (!txDoc) {
      throw new Error('transaction_not_found');
    }

    if (txDoc.status !== 'verified' && txDoc.status !== 'paid') {
      txDoc.status = 'verified';
      txDoc.refId = refId ?? txDoc.refId;
      txDoc.verifyPayload = verifyPayload;
      txDoc.errorCode = undefined;
      txDoc.errorMessage = undefined;
      await txDoc.save({ session });
    }

    await updateInvoicePaymentContext(
      invoice,
      transaction.gateway,
      {
        transactionId: txDoc._id.toString(),
        authority: txDoc.authority ?? undefined,
        refId: txDoc.refId ?? refId ?? undefined,
        status: txDoc.status === 'paid' ? 'paid' : 'verified',
        verifiedAt: new Date(),
        isSettled: txDoc.status === 'paid',
        verify: verifyPayload,
      },
      session,
    );

    const statusResult = await updateInvoiceStatus(invoice._id.toString(), 'paid', session);
    if (!statusResult.ok) {
      throw new Error(`invoice_status_update_failed:${statusResult.reason}`);
    }
  };

  if (!supportsMongoTransactions()) {
    await applyVerification();
    return;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await applyVerification(session);
    });
  } catch (error) {
    if ((error as { code?: number }).code === 20) {
      await applyVerification();
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }
}

export async function createPaymentForInvoice(input: CreatePaymentInput): Promise<CreatePaymentResult> {
  await connectMongoose();

  const invoice = await loadInvoice(input.invoiceId);
  ensureInvoicePayable(invoice, input.amount);

  if (invoice.userId?.toString() !== input.userId) {
    throw new Error('invoice_user_mismatch');
  }

  const gateway: PaymentGateway = input.gateway ?? 'zarinpal';
  const { baseUrl, callbackPath } = getCallbackBase();

  const transactionId = new mongoose.Types.ObjectId();
  const snappPayProviderTransactionId =
    gateway === 'snapppay' ? buildSnappPayProviderTransactionId(transactionId) : undefined;
  const callbackURL = buildCallbackUrl(baseUrl, callbackPath, input.invoiceId, transactionId);
  const torobReturnURL = buildCallbackUrl(baseUrl, getTorobCallbackPath(), input.invoiceId, transactionId);
  const snappPayReturnURL = buildCallbackUrl(baseUrl, getSnappPayCallbackPath(), input.invoiceId, transactionId);
  const digipayCallbackURL = buildGatewayCallbackUrl({
    baseUrl,
    path: getDigipayCallbackPath(),
    invoiceId: input.invoiceId,
    transactionId,
    gateway: 'digipay',
  });
  const azkivamSuccessURL = buildGatewayCallbackUrl({
    baseUrl,
    path: callbackPath,
    invoiceId: input.invoiceId,
    transactionId,
    gateway: 'azkivam',
    state: 'success',
  });
  const azkivamFailureURL = buildGatewayCallbackUrl({
    baseUrl,
    path: callbackPath,
    invoiceId: input.invoiceId,
    transactionId,
    gateway: 'azkivam',
    state: 'failed',
  });
  const description = input.description ?? `Payment for invoice ${invoice.number ?? input.invoiceId}`;

  const transaction = await PaymentTransactionModel.create({
    _id: transactionId,
    invoiceId: input.invoiceId,
    userId: input.userId,
    amount: input.amount,
    description,
    email: input.email,
    mobile: input.mobile,
    callbackURL:
      gateway === 'torob'
        ? torobReturnURL
        : gateway === 'snapppay'
          ? snappPayReturnURL
          : gateway === 'azkivam'
            ? azkivamSuccessURL
            : gateway === 'digipay'
              ? digipayCallbackURL
              : callbackURL,
    gateway,
    status: 'initiated',
    meta: {
      invoiceNumber: invoice.number,
      ...(snappPayProviderTransactionId
        ? { snappPayProviderTransactionId }
        : {}),
    },
  });

  await updateInvoicePaymentContext(invoice, gateway, {
    transactionId: transaction._id.toString(),
    callbackURL:
      gateway === 'torob'
        ? torobReturnURL
        : gateway === 'snapppay'
          ? snappPayReturnURL
          : gateway === 'azkivam'
            ? azkivamSuccessURL
            : gateway === 'digipay'
              ? digipayCallbackURL
              : callbackURL,
    amount: transaction.amount,
    status: 'initiated',
    requestedAt: new Date(),
    ...(snappPayProviderTransactionId
      ? { providerTransactionId: snappPayProviderTransactionId }
      : {}),
  });

  try {
    if (gateway === 'snapppay') {
      const env = getSnappPayEnv();
      const client = getSnappPayClient(env);
      const amounts = buildSnappPayAmounts(invoice);
      const snappPayCategories = await resolveSnappPayLineCategories(invoice);
      const snappPayCartList = buildSnappPayCartList(invoice, snappPayCategories);
      const snappPayMobile = normalizeSnappPayMobileNumber(transaction.mobile ?? invoice.addressSnapshot?.phone);
      if (!/^\+98\d{10}$/.test(snappPayMobile)) {
        throw new Error('snapppay_mobile_number_invalid');
      }
      if (amounts.amountRial !== tomanToRial(transaction.amount)) {
        throw new Error('snapppay_amount_formula_mismatch');
      }

      const snappPay = await client.requestPayment({
        amountRial: amounts.amountRial,
        discountAmountRial: amounts.discountAmountRial,
        externalSourceAmountRial: amounts.externalSourceAmountRial,
        mobile: snappPayMobile,
        returnURL: snappPayReturnURL,
        transactionId: snappPayProviderTransactionId ?? buildSnappPayProviderTransactionId(transaction._id),
        cartList: snappPayCartList,
        // forcedPaymentMethodTypes intentionally omitted: SnappPay requires it
        // NOT be sent so customers can use every available payment capability.
      });

      await PaymentTransactionModel.updateOne(
        { _id: transaction._id },
        {
          $set: {
            authority: snappPay.paymentToken,
            status: 'requested',
            callbackURL: snappPayReturnURL,
            meta: {
              invoiceNumber: invoice.number,
              paymentToken: snappPay.paymentToken,
              snappPayProviderTransactionId:
                snappPayProviderTransactionId ?? buildSnappPayProviderTransactionId(transaction._id),
              amountFormula: amounts,
            },
          },
        },
      );

      await updateInvoicePaymentContext(invoice, gateway, {
        authority: snappPay.paymentToken,
        paymentToken: snappPay.paymentToken,
        providerTransactionId:
          snappPayProviderTransactionId ?? buildSnappPayProviderTransactionId(transaction._id),
        gatewayUrl: snappPay.paymentPageUrl,
        status: 'requested',
        request: {
          paymentToken: snappPay.paymentToken,
          paymentPageUrl: snappPay.paymentPageUrl,
          providerTransactionId:
            snappPayProviderTransactionId ?? buildSnappPayProviderTransactionId(transaction._id),
          amount: amounts.amountRial,
          cartList: snappPayCartList,
          discountAmount: amounts.discountAmountRial,
          externalSourceAmount: amounts.externalSourceAmountRial,
          amountFormula: amounts,
        },
      });

      return {
        gatewayUrl: snappPay.paymentPageUrl,
        authority: snappPay.paymentToken,
        transactionId: transaction._id.toString(),
      };
    }

    if (gateway === 'digipay') {
      const env = getDigipayEnv();
      const client = getDigipayClient(env);
      const providerId = transaction._id.toString();
      const digipay = await client.createTicket({
        amountRial: tomanToRial(transaction.amount),
        cellNumber: transaction.mobile ?? invoice.addressSnapshot?.phone ?? '',
        providerId,
        callbackUrl: digipayCallbackURL,
        preferredGateway: getDigipayPreferredGateway(),
        additionalInfo: {
          invoiceId: input.invoiceId,
          invoiceNumber: invoice.number,
          transactionId: transaction._id.toString(),
        },
      });

      await PaymentTransactionModel.updateOne(
        { _id: transaction._id },
        {
          $set: {
            authority: digipay.ticket,
            status: 'requested',
            callbackURL: digipayCallbackURL,
            meta: {
              invoiceNumber: invoice.number,
              ticket: digipay.ticket,
              providerId,
            },
          },
        },
      );

      await updateInvoicePaymentContext(invoice, gateway, {
        authority: digipay.ticket,
        ticket: digipay.ticket,
        providerId,
        gatewayUrl: digipay.redirectUrl,
        status: 'requested',
        request: digipay.raw,
      });

      return {
        gatewayUrl: digipay.redirectUrl,
        authority: digipay.ticket,
        transactionId: transaction._id.toString(),
      };
    }

    if (gateway === 'azkivam') {
      const env = getAzkivamEnv();
      const client = getAzkivamClient(env);
      const providerId = generateAzkivamProviderId();
      const mobileNumber = normalizeAzkivamMobileNumber(transaction.mobile ?? invoice.addressSnapshot?.phone);
      if (!mobileNumber) {
        throw new Error('azkivam_mobile_number_missing');
      }
      const azkivamPayload = buildAzkivamPaymentPayload(invoice, providerId, mobileNumber);
      const azkivamRequestPayload = {
        ...azkivamPayload.requestSnapshot,
        redirect_uri: azkivamSuccessURL,
        fallback_uri: azkivamFailureURL,
      };
      const azkivam = await client.createTicket({
        amountRial: azkivamPayload.amountRial,
        redirectUri: azkivamSuccessURL,
        fallbackUri: azkivamFailureURL,
        providerId,
        mobileNumber,
        items: azkivamPayload.items,
      });

      await PaymentTransactionModel.updateOne(
        { _id: transaction._id },
        {
          $set: {
            authority: azkivam.ticketId,
            status: 'requested',
            callbackURL: azkivamSuccessURL,
            meta: {
              invoiceNumber: invoice.number,
              ticketId: azkivam.ticketId,
              providerId,
              requestPayload: azkivamRequestPayload,
              failureCallbackURL: azkivamFailureURL,
            },
          },
        },
      );

      await updateInvoicePaymentContext(invoice, gateway, {
        authority: azkivam.ticketId,
        ticketId: azkivam.ticketId,
        providerId,
        gatewayUrl: azkivam.paymentUri,
        status: 'requested',
        request: {
          payload: azkivamRequestPayload,
          response: azkivam.raw,
        },
        successCallbackURL: azkivamSuccessURL,
        failureCallbackURL: azkivamFailureURL,
      });

      return {
        gatewayUrl: azkivam.paymentUri,
        authority: azkivam.ticketId,
        transactionId: transaction._id.toString(),
      };
    }

    if (gateway === 'torob') {
      const env = getTorobEnv();
      const client = getTorobClient(env);
      const torob = await client.requestPayment({
        amountRial: tomanToRial(transaction.amount),
        mobile: transaction.mobile ?? undefined,
        returnURL: torobReturnURL,
        transactionId: transaction._id.toString(),
        cartList: buildTorobCartList(invoice),
      });

      await PaymentTransactionModel.updateOne(
        { _id: transaction._id },
        {
          $set: {
            authority: torob.paymentToken,
            status: 'requested',
            callbackURL: torobReturnURL,
            meta: {
              invoiceNumber: invoice.number,
              paymentToken: torob.paymentToken,
            },
          },
        }
      );

      await updateInvoicePaymentContext(invoice, gateway, {
        authority: torob.paymentToken,
        paymentToken: torob.paymentToken,
        gatewayUrl: torob.paymentPageUrl,
        status: 'requested',
        request: {
          paymentToken: torob.paymentToken,
          paymentPageUrl: torob.paymentPageUrl,
        },
      });

      return {
        gatewayUrl: torob.paymentPageUrl,
        authority: torob.paymentToken,
        transactionId: transaction._id.toString(),
      };
    }

    const env = getZarinpalEnv();
    const client = getZarinpalClient(env);
    const metadata: Record<string, string> = {
      invoiceId: input.invoiceId,
      transactionId: transaction._id.toString(),
    };

    const requestEmail = transaction.email ?? undefined;
    const requestMobile = transaction.mobile ?? undefined;

    const { authority, gatewayUrl } = await client.requestPayment({
      amount: transaction.amount,
      description,
      callbackURL,
      email: requestEmail,
      mobile: requestMobile,
      metadata,
    });

    await PaymentTransactionModel.updateOne(
      { _id: transaction._id },
      {
        $set: {
          authority,
          status: 'requested',
          callbackURL,
        },
      }
    );

    await updateInvoicePaymentContext(invoice, gateway, {
      authority,
      gatewayUrl,
      status: 'requested',
      request: {
        authority,
        gatewayUrl,
      },
    });

    return { gatewayUrl, authority, transactionId: transaction._id.toString() };
  } catch (error) {
    const requestError = error as { code?: number; message?: string };
    logErrorLater({
      category: 'payment',
      source: 'payment.create',
      error,
      metadata: {
        gateway,
        invoiceId: input.invoiceId,
        transactionId: transaction._id.toString(),
        amount: input.amount,
      },
    });
    await PaymentTransactionModel.updateOne(
      { _id: transaction._id },
      {
        $set: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'request_failed',
          errorCode: requestError.code,
        },
      }
    );
    await updateInvoicePaymentContext(invoice, gateway, {
      status: 'failed',
      lastError: {
        code: requestError.code,
        message: error instanceof Error ? error.message : 'request_failed',
      },
    });
    throw error;
  }
}

export async function markRedirected(transactionId: string) {
  await connectMongoose();
  await PaymentTransactionModel.updateOne(
    { _id: transactionId, status: { $in: ['requested', 'initiated'] } },
    { $set: { status: 'redirected' } }
  ).exec();
}


type SnappPayEligibilityCacheEntry = {
  result: SnappPayEligibilityResult;
  expiresAt: number;
};

const snapppayEligibilityCache = new Map<string, SnappPayEligibilityCacheEntry>();
const SNAPPPAY_ELIGIBILITY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SNAPPPAY_ELIGIBILITY_STALE_TTL_MS = 60 * 60 * 1000; // 1 hour

function buildSnappPayEligibilityCacheKey(
  amountToman: number,
  paymentMethodTypes?: string[],
) {
  const normalizedAmount = Math.max(0, Math.floor(amountToman));
  const normalizedMethods = (paymentMethodTypes ?? [])
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(',');

  return String(normalizedAmount).concat(':', normalizedMethods);
}

export async function checkSnappPayEligibilityForAmount(
  amountToman: number,
): Promise<SnappPayEligibilityResult> {
  if (amountToman <= 0) {
    return { enabled: false, reason: 'invalid_amount' };
  }

  const paymentMethodTypes = getSnappPayPaymentMethodTypes();
  const cacheKey = buildSnappPayEligibilityCacheKey(amountToman, paymentMethodTypes);
  const now = Date.now();
  const cached = snapppayEligibilityCache.get(cacheKey);
  if (cached && now < cached.expiresAt) {
    return cached.result;
  }

  try {
    const env = getSnappPayEnv();
    const client = getSnappPayClient(env);

    // The staging gateway occasionally 5xx/times out; retry a couple of times so
    // a transient blip doesn't hide the SnappPay option.
    let result: Awaited<ReturnType<typeof client.checkEligibility>> | undefined;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await client.checkEligibility(tomanToRial(amountToman), paymentMethodTypes);
        break;
      } catch (err) {
        lastErr = err;
        const status = Number((err as { status?: number })?.status) || 0;
        const transient = status >= 500 || status === 0 || status === 429;
        if (!transient || attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    if (!result) throw lastErr ?? new Error('snapppay_eligibility_no_result');

    if (!result.eligible) {
      const cachedResult: SnappPayEligibilityResult = { enabled: false, reason: 'not_eligible' };
      snapppayEligibilityCache.set(cacheKey, {
        result: cachedResult,
        expiresAt: now + SNAPPPAY_ELIGIBILITY_CACHE_TTL_MS,
      });
      return cachedResult;
    }

    const cachedResult: SnappPayEligibilityResult = {
      enabled: true,
      title: (result.title_message ?? result.titleMessage ?? result.title ?? 'اسنپ‌پی').trim(),
      description: (result.description ?? '').trim(),
    };
    snapppayEligibilityCache.set(cacheKey, {
      result: cachedResult,
      expiresAt: now + SNAPPPAY_ELIGIBILITY_CACHE_TTL_MS,
    });
    return cachedResult;
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('snapppay credentials are not configured')) {
      return { enabled: false, reason: 'credentials_missing' };
    }

    if (cached && now < cached.expiresAt + SNAPPPAY_ELIGIBILITY_STALE_TTL_MS) {
      return cached.result;
    }

    // A gateway 5xx / timeout is external and transient (the SnappPay option just
    // hides for this render) — log concisely at warn, not a full error dump.
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`SnappPay eligibility unavailable: ${msg}`);
    logErrorLater({
      category: 'payment',
      source: 'snapppay.eligibility',
      error,
      level: 'warning',
      metadata: { amountToman },
    });
    const cachedResult: SnappPayEligibilityResult = { enabled: false, reason: 'eligibility_failed' };
    snapppayEligibilityCache.set(cacheKey, {
      result: cachedResult,
      expiresAt: now + SNAPPPAY_ELIGIBILITY_CACHE_TTL_MS,
    });
    return cachedResult;
  }
}

async function setTransactionStatus(
  transactionId: string,
  status: PaymentTransactionDocument['status'],
  updates: Partial<PaymentTransactionDocument> & {
    verifyPayload?: unknown;
    errorCode?: number;
    errorMessage?: string;
  }
) {
  await PaymentTransactionModel.updateOne({ _id: transactionId }, { $set: { status, ...updates } }).exec();
}

export async function markTransactionFailed(
  transactionId: string,
  authority: string | undefined,
  status: 'failed' | 'canceled',
  errorMessage?: string
) {
  await connectMongoose();
  const updates: Partial<PaymentTransactionDocument> = {
    status,
    errorMessage,
  };

  if (authority) {
    updates.authority = authority;
  }

  await PaymentTransactionModel.updateOne(
    { _id: transactionId, status: { $ne: 'paid' } },
    { $set: updates }
  ).exec();
}

export async function settleTorobPayment(invoiceId: string): Promise<TorobSettleResult> {
  await connectMongoose();

  const transaction = await PaymentTransactionModel.findOne({
    invoiceId,
    gateway: 'torob',
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!transaction) {
    return { ok: false, reason: 'transaction_not_found' };
  }

  if (transaction.status === 'paid') {
    return { ok: true, alreadySettled: true };
  }

  if (transaction.status !== 'verified') {
    return { ok: false, reason: `transaction_status_${transaction.status}` };
  }

  const invoice = await InvoiceModel.findById(invoiceId).exec();
  if (!invoice) {
    return { ok: false, reason: 'invoice_not_found' };
  }

  const paymentToken = resolveTorobPaymentToken(transaction);
  if (!paymentToken) {
    return { ok: false, reason: 'transaction_payment_token_missing' };
  }

  const env = getTorobEnv();
  const client = getTorobClient(env);

  try {
    const settleResult = await client.settlePayment(paymentToken);

    const applySettlement = async (session?: mongoose.ClientSession) => {
      const txDoc = await PaymentTransactionModel.findById(transaction._id).session(session ?? null);
      if (!txDoc) {
        throw new Error('transaction_not_found');
      }

      if (txDoc.status !== 'paid') {
        txDoc.status = 'paid';
        txDoc.errorCode = undefined;
        txDoc.errorMessage = undefined;
        txDoc.meta = {
          ...(isRecord(txDoc.meta) ? txDoc.meta : {}),
          settledAt: new Date(),
          settlePayload: settleResult.raw,
        };
        await txDoc.save({ session });
      }

      await updateInvoicePaymentContext(
        invoice,
        'torob',
        {
          transactionId: txDoc._id.toString(),
          authority: txDoc.authority ?? undefined,
          refId: txDoc.refId ?? undefined,
          status: 'paid',
          isSettled: true,
          settledAt: new Date(),
          settle: settleResult.raw,
        },
        session,
      );
    };

    if (!supportsMongoTransactions()) {
      await applySettlement();
      return { ok: true };
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await applySettlement(session);
      });
    } catch (error) {
      if ((error as { code?: number }).code === 20) {
        await applySettlement();
      } else {
        throw error;
      }
    } finally {
      await session.endSession();
    }

    return { ok: true };
  } catch (error) {
    const settleError = error as { code?: number };
    logErrorLater({
      category: 'payment',
      source: 'torob.settle',
      error,
      metadata: {
        invoiceId,
        transactionId: transaction._id.toString(),
        code: settleError.code,
      },
    });
    await PaymentTransactionModel.updateOne(
      { _id: transaction._id },
      {
        $set: {
          errorCode: settleError.code,
          errorMessage: error instanceof Error ? error.message : 'torob_settle_failed',
          meta: {
            ...(isRecord(transaction.meta) ? transaction.meta : {}),
            settleFailedAt: new Date(),
          },
        },
      },
    ).exec();

    await updateInvoicePaymentContext(invoice, 'torob', {
      status: 'verified',
      isSettled: false,
      lastError: {
        code: settleError.code,
        message: error instanceof Error ? error.message : 'torob_settle_failed',
      },
    });

    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'torob_settle_failed',
      code: settleError.code,
    };
  }
}

async function loadLatestSnappPayTransaction(invoiceId: string) {
  const transaction = await PaymentTransactionModel.findOne({
    invoiceId,
    gateway: 'snapppay',
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!transaction) {
    return { transaction: null, invoice: null, paymentToken: null };
  }

  const invoice = await InvoiceModel.findById(invoiceId).exec();
  const paymentToken = resolvePaymentToken(transaction);
  return { transaction, invoice, paymentToken };
}

export async function updateSnappPayPayment(invoiceId: string, updateInput?: unknown): Promise<SnappPayMutationResult> {
  await connectMongoose();
  const { transaction, invoice, paymentToken } = await loadLatestSnappPayTransaction(invoiceId);

  if (!transaction) return { ok: false, reason: 'transaction_not_found' };
  if (!invoice) return { ok: false, reason: 'invoice_not_found' };
  if (!paymentToken) return { ok: false, reason: 'transaction_payment_token_missing' };
  if (transaction.status !== 'paid') {
    return { ok: false, reason: 'transaction_status_' + transaction.status };
  }

  const env = getSnappPayEnv();
  const client = getSnappPayClient(env);
  const prepared =
    updateInput === undefined || updateInput === null
      ? { ok: true as const, payload: buildSnappPayUpdatePayloadFromInvoice(invoice, await resolveSnappPayLineCategories(invoice)) }
      : prepareSnappPayUpdatePayload(updateInput);

  if (!prepared.ok) {
    return { ok: false, reason: prepared.reason };
  }

  const originalAmountRial = tomanToRial(transaction.amount ?? 0);
  if (prepared.payload.amountRial >= originalAmountRial) {
    return { ok: false, reason: 'snapppay_update_amount_not_reduced' };
  }

  const settleReady = await ensureSnappPaySettledForUpdate(client, paymentToken);
  if (!settleReady.ok) {
    return { ok: false, reason: settleReady.reason, code: settleReady.code };
  }

  const currentPaymentData = isRecord(invoice.paymentMethodData) ? invoice.paymentMethodData : {};
  const updateHistory = Array.isArray(currentPaymentData.snappPayUpdateHistory)
    ? currentPaymentData.snappPayUpdateHistory.filter((entry) => isRecord(entry)).slice(-9)
    : [];

  const result = await callSnappPayUpdatePayment(client, {
    paymentToken,
    amountRial: prepared.payload.amountRial,
    discountAmountRial: prepared.payload.discountAmountRial,
    externalSourceAmountRial: prepared.payload.externalSourceAmountRial,
    cartList: prepared.payload.cartList,
  });

  if (!result.ok) {
    await updateInvoicePaymentContext(invoice, 'snapppay', {
      lastError: {
        code: result.code,
        message: 'snapppay_update_failed',
      },
      updateFailedAt: new Date(),
      updateRequest: prepared.payload.request,
      update: result.raw,
      amountFormula: prepared.payload.amountFormula,
      snappPayUpdateHistory: [
        ...updateHistory,
        {
          at: new Date(),
          status: 'failed',
          request: prepared.payload.request,
          response: result.raw,
          code: result.code,
        },
      ],
    });
    return { ok: false, reason: 'snapppay_update_failed', code: result.code };
  }

  const providerTransactionId =
    result.transactionId ?? resolveSnappPayProviderTransactionId(transaction) ?? undefined;

  await persistSnappPayUpdateToInvoice(invoice, transaction, prepared.payload);

  await updateInvoicePaymentContext(invoice, 'snapppay', {
    status: 'paid',
    updatedPaymentAt: new Date(),
    providerTransactionId,
    snappPayProviderTransactionId: providerTransactionId,
    updateRequest: prepared.payload.request,
    update: result.raw,
    amountFormula: prepared.payload.amountFormula,
    amount: prepared.payload.amountRial,
    snappPayUpdateHistory: [
      ...updateHistory,
      {
        at: new Date(),
        status: 'success',
        request: prepared.payload.request,
        response: result.raw,
        transactionId: providerTransactionId,
      },
    ],
  });

  return { ok: true, transactionId: providerTransactionId };
}

export async function cancelSnappPayPayment(invoiceId: string): Promise<SnappPayMutationResult> {
  await connectMongoose();
  const { transaction, invoice, paymentToken } = await loadLatestSnappPayTransaction(invoiceId);

  if (!transaction) return { ok: false, reason: 'transaction_not_found' };
  if (!invoice) return { ok: false, reason: 'invoice_not_found' };
  if (!paymentToken) return { ok: false, reason: 'transaction_payment_token_missing' };
  if (transaction.status !== 'paid') {
    return { ok: false, reason: `transaction_status_${transaction.status}` };
  }

  const env = getSnappPayEnv();
  const client = getSnappPayClient(env);
  const result = await client.cancelPayment(paymentToken);

  if (!result.ok) {
    await updateInvoicePaymentContext(invoice, 'snapppay', {
      lastError: {
        code: result.code,
        message: 'snapppay_cancel_failed',
      },
      cancelFailedAt: new Date(),
      cancel: result.raw,
    });
    return { ok: false, reason: 'snapppay_cancel_failed', code: result.code };
  }

  await setTransactionStatus(transaction._id.toString(), 'canceled', {
    verifyPayload: {
      ...(isRecord(transaction.verifyPayload) ? transaction.verifyPayload : {}),
      cancel: result.raw,
    },
  });
  await updateInvoicePaymentContext(invoice, 'snapppay', {
    status: 'canceled',
    canceledAt: new Date(),
    cancel: result.raw,
  });
  const statusResult = await updateInvoiceStatus(invoice._id.toString(), 'canceled');
  if (!statusResult.ok) {
    return { ok: false, reason: 'invoice_status_update_failed:' + statusResult.reason };
  }

  return { ok: true, transactionId: result.transactionId };
}

export async function verifyAndFinalize(input: VerifyInput): Promise<VerifyResult> {
  await connectMongoose();

  const query = input.authority
    ? { $or: [{ _id: input.transactionId }, { authority: input.authority }] }
    : { _id: input.transactionId };

  const transaction = await PaymentTransactionModel.findOne(query).exec();
  if (!transaction) {
    throw new Error('transaction_not_found');
  }

  if (transaction.invoiceId.toString() !== input.invoiceId) {
    throw new Error('transaction_invoice_mismatch');
  }

  if (transaction.status === 'paid') {
    return {
      ok: true,
      code: 100,
      refId: transaction.refId ?? undefined,
    };
  }

  if (transaction.gateway === 'torob' && transaction.status === 'verified') {
    return {
      ok: true,
      code: 100,
      refId: transaction.refId ?? undefined,
    };
  }

  if (transaction.gateway === 'snapppay' && transaction.status === 'verified') {
    return {
      ok: true,
      code: 100,
      refId: transaction.refId ?? undefined,
    };
  }

  if (!['requested', 'redirected'].includes(transaction.status)) {
    return {
      ok: false,
      code: transaction.errorCode ?? 0,
      refId: transaction.refId ?? undefined,
      message: transaction.errorMessage ?? `transaction_status_${transaction.status}`,
    };
  }

  const invoice = await InvoiceModel.findById(transaction.invoiceId).exec();
  if (!invoice) {
    throw new Error('invoice_not_found');
  }
  ensureInvoicePayable(invoice, transaction.amount);

  if (transaction.gateway === 'torob') {
    const paymentToken = resolveTorobPaymentToken(transaction);
    if (!paymentToken) {
      throw new Error('transaction_payment_token_missing');
    }

    const env = getTorobEnv();
    const client = getTorobClient(env);
    const verifyResult = await client.verifyPayment(paymentToken);
    if (!verifyResult.ok) {
      await setTransactionStatus(transaction._id.toString(), 'failed', {
        verifyPayload: verifyResult.raw,
        errorCode: verifyResult.code,
        errorMessage: 'torob_verify_failed',
      });
      await updateInvoicePaymentContext(invoice, transaction.gateway, {
        status: 'failed',
        verify: verifyResult.raw,
        lastError: {
          code: verifyResult.code,
          message: 'torob_verify_failed',
        },
      });
      return {
        ok: false,
        code: verifyResult.code ?? 0,
        message: 'torob_verify_failed',
      };
    }

    const refId = verifyResult.transactionId ?? transaction.refId;
    await finalizeVerifiedTorobPayment(transaction, invoice, refId ?? undefined, verifyResult.raw);

    return {
      ok: true,
      code: 100,
      refId: refId ?? undefined,
    };
  }

  if (transaction.gateway === 'snapppay') {
    const paymentToken = resolvePaymentToken(transaction);
    if (!paymentToken) {
      throw new Error('transaction_payment_token_missing');
    }

    const callbackState = input.snapppay?.state?.toUpperCase();
    if (callbackState && callbackState !== 'OK') {
      await setTransactionStatus(transaction._id.toString(), 'failed', {
        errorMessage: `snapppay_gateway_status_${callbackState}`,
      });
      await updateInvoicePaymentContext(invoice, transaction.gateway, {
        status: 'failed',
        lastError: {
          message: `snapppay_gateway_status_${callbackState}`,
        },
      });
      return {
        ok: false,
        code: 0,
        message: `snapppay_gateway_status_${callbackState}`,
      };
    }

    const callbackAmount = input.snapppay?.amount ? Number(input.snapppay.amount) : undefined;
    if (
      Number.isFinite(callbackAmount) &&
      callbackAmount !== undefined &&
      callbackAmount !== tomanToRial(transaction.amount)
    ) {
      throw new Error('snapppay_amount_mismatch');
    }

    const env = getSnappPayEnv();
    const client = getSnappPayClient(env);
    const verifyResult = await client.verifyPayment(paymentToken);
    if (!verifyResult.ok) {
      const statusResult = await client.getPaymentStatus(paymentToken);
      const status = statusResult.status?.toUpperCase();
      if (status !== 'VERIFY' && status !== 'SETTLE') {
        await setTransactionStatus(transaction._id.toString(), 'failed', {
          verifyPayload: {
            verify: verifyResult.raw,
            status: statusResult.raw,
          },
          errorCode: verifyResult.code ?? statusResult.code,
          errorMessage: 'snapppay_verify_failed',
        });
        await updateInvoicePaymentContext(invoice, transaction.gateway, {
          status: 'failed',
          verify: verifyResult.raw,
          statusCheck: statusResult.raw,
          lastError: {
            code: verifyResult.code ?? statusResult.code,
            message: 'snapppay_verify_failed',
          },
        });
        return {
          ok: false,
          code: verifyResult.code ?? statusResult.code ?? 0,
          message: 'snapppay_verify_failed',
        };
      }
    }

    const settleResult = await client.settlePayment(paymentToken);
    if (!settleResult.ok) {
      const statusResult = await client.getPaymentStatus(paymentToken);
      if (statusResult.status?.toUpperCase() !== 'SETTLE') {
        await setTransactionStatus(transaction._id.toString(), 'verified', {
          verifyPayload: {
            verify: verifyResult.raw,
            settle: settleResult.raw,
            status: statusResult.raw,
          },
          errorCode: settleResult.code ?? statusResult.code,
          errorMessage: 'snapppay_settle_failed',
        });
        await updateInvoicePaymentContext(invoice, transaction.gateway, {
          status: 'verified',
          isSettled: false,
          verify: verifyResult.raw,
          settle: settleResult.raw,
          statusCheck: statusResult.raw,
          lastError: {
            code: settleResult.code ?? statusResult.code,
            message: 'snapppay_settle_failed',
          },
        });
        return {
          ok: false,
          code: settleResult.code ?? statusResult.code ?? 0,
          message: 'snapppay_settle_failed',
        };
      }
    }

    const providerTransactionId = resolveSnappPayProviderTransactionId(transaction);
    const refId =
      settleResult.transactionId ??
      verifyResult.transactionId ??
      transaction.refId ??
      providerTransactionId;
    await finalizeSuccessfulPayment(transaction, invoice, refId ?? undefined, {
      verify: verifyResult.raw,
      settle: settleResult.raw,
    });

    await updateInvoicePaymentContext(invoice, transaction.gateway, {
      status: 'paid',
      isSettled: true,
      settledAt: new Date(),
      settle: settleResult.raw,
      ...(providerTransactionId ? { providerTransactionId } : {}),
    });

    return {
      ok: true,
      code: 100,
      refId: refId ?? undefined,
    };
  }

  if (transaction.gateway === 'azkivam') {
    const ticketId = resolveAzkivamTicketId(transaction);
    if (!ticketId) {
      throw new Error('transaction_ticket_id_missing');
    }

    const env = getAzkivamEnv();
    const client = getAzkivamClient(env);
    const verifyResult = await client.verifyTicket(ticketId);
    if (verifyResult.ok) {
      await finalizeSuccessfulPayment(
        transaction,
        invoice,
        verifyResult.ticketId ?? transaction.refId ?? ticketId,
        verifyResult.raw,
      );
      return {
        ok: true,
        code: 100,
        refId: verifyResult.ticketId ?? ticketId,
      };
    }

    await setTransactionStatus(transaction._id.toString(), 'failed', {
      verifyPayload: verifyResult.raw,
      errorCode: verifyResult.code,
      errorMessage: `azkivam_verification_failed_${verifyResult.code}`,
    });

    await updateInvoicePaymentContext(invoice, transaction.gateway, {
      status: 'failed',
      verify: verifyResult.raw,
      lastError: {
        code: verifyResult.code,
        message: `azkivam_verification_failed_${verifyResult.code}`,
      },
    });

    return {
      ok: false,
      code: verifyResult.code,
      message: `azkivam_verification_failed_${verifyResult.code}`,
    };
  }

  if (transaction.gateway === 'digipay') {
    const providerId = input.digipay?.providerId ?? resolveDigipayProviderId(transaction);
    const trackingCode = input.digipay?.trackingCode;
    const callbackResult = input.digipay?.result?.toUpperCase();

    if (callbackResult && callbackResult !== 'SUCCESS') {
      await setTransactionStatus(transaction._id.toString(), 'failed', {
        errorMessage: `digipay_gateway_status_${callbackResult}`,
      });
      await updateInvoicePaymentContext(invoice, transaction.gateway, {
        status: 'failed',
        lastError: {
          message: `digipay_gateway_status_${callbackResult}`,
        },
      });
      return {
        ok: false,
        code: 0,
        message: `digipay_gateway_status_${callbackResult}`,
      };
    }

    if (!trackingCode) {
      throw new Error('digipay_tracking_code_missing');
    }
    if (!providerId) {
      throw new Error('digipay_provider_id_missing');
    }

    const callbackAmount = input.digipay?.amount ? Number(input.digipay.amount) : undefined;
    if (
      Number.isFinite(callbackAmount) &&
      callbackAmount !== undefined &&
      callbackAmount !== tomanToRial(transaction.amount)
    ) {
      throw new Error('digipay_amount_mismatch');
    }

    const env = getDigipayEnv();
    const client = getDigipayClient(env);
    const verifyResult = await client.verifyPurchase({
      trackingCode,
      providerId,
      type: input.digipay?.type,
    });

    if (verifyResult.ok) {
      await finalizeSuccessfulPayment(
        transaction,
        invoice,
        verifyResult.trackingCode ?? transaction.refId ?? trackingCode,
        verifyResult.raw,
      );
      return {
        ok: true,
        code: 100,
        refId: verifyResult.trackingCode ?? trackingCode,
      };
    }

    await setTransactionStatus(transaction._id.toString(), 'failed', {
      verifyPayload: verifyResult.raw,
      errorCode: verifyResult.code,
      errorMessage: `digipay_verification_failed_${verifyResult.code}`,
    });

    await updateInvoicePaymentContext(invoice, transaction.gateway, {
      status: 'failed',
      verify: verifyResult.raw,
      lastError: {
        code: verifyResult.code,
        message: verifyResult.message ?? `digipay_verification_failed_${verifyResult.code}`,
      },
    });

    return {
      ok: false,
      code: verifyResult.code,
      message: verifyResult.message ?? `digipay_verification_failed_${verifyResult.code}`,
    };
  }

  const env = getZarinpalEnv();
  const client = getZarinpalClient(env);
  if (!transaction.authority && input.authority) {
    transaction.authority = input.authority;
    await transaction.save();
  }

  const authority = transaction.authority;
  if (!authority) {
    throw new Error('transaction_authority_missing');
  }

  const verifyResult = await client.verifyPayment({ authority, amount: transaction.amount });
  if (verifyResult.ok || verifyResult.code === 101) {
    await finalizeSuccessfulPayment(transaction, invoice, verifyResult.refId ?? transaction.refId, verifyResult.raw);
    return {
      ok: true,
      code: verifyResult.code === 101 ? 101 : 100,
      refId: (verifyResult.refId ?? transaction.refId) ?? undefined,
    };
  }

  await setTransactionStatus(transaction._id.toString(), 'failed', {
    verifyPayload: verifyResult.raw,
    errorCode: verifyResult.code,
    errorMessage: `verification_failed_${verifyResult.code}`,
  });

  await updateInvoicePaymentContext(invoice, transaction.gateway, {
    status: 'failed',
    verify: verifyResult.raw,
    lastError: {
      code: verifyResult.code,
      message: `verification_failed_${verifyResult.code}`,
    },
  });

  return {
    ok: false,
    code: verifyResult.code,
    message: `verification_failed_${verifyResult.code}`,
  };
}
