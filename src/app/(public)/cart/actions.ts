'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';

import { AUTH_COOKIE_NAME, verifyJwt } from '@/lib/auth';
import { connectMongoose } from '@/lib/mongoose';
import UserModel from '@/models/User';
import { InvoiceModel } from '@/orders/models/Invoice';
import { normalizeGuestCheckoutPhone } from '@/orders/validation/guest-checkout';
import {
  buildCartAvailabilityIssues,
  getUnavailableVariantIds,
  normalizeCartVariantIds,
  type CartAvailabilityLine,
  type CartAvailabilityRow,
} from '@/components/cart/cart-availability';
import { getCartVariantAvailability } from '@/orders/services/cartAvailabilityService';
import { previewInvoice, createInvoice, updateInvoiceStatus, type InvoicePricingInput } from '@/orders/services/invoiceService';
import {
  checkSnappPayEligibilityForAmount,
  createPaymentForInvoice,
  type PaymentGateway,
} from '@/payments/paymentService';
import { getVisiblePaymentGateways } from '@/payments/paymentGatewayControls';

const cartLineSchema = z.object({
  productId: z.string().min(1),
  productSlug: z.string().optional(),
  title: z.string(),
  variantId: z.string().min(1),
  sku: z.string().min(1),
  priceModel: z.enum(['fixed', 'per_unit']),
  unitOfMeasure: z.string().optional(),
  qty: z.number().optional(),
  requestedQty: z.number().optional(),
  requestedUnit: z.string().optional(),
  unitPriceBase: z.number().nonnegative(),
  variantOfferAmount: z.number().optional(),
  mediaThumbId: z.string().optional(),
  attributesSummary: z.string().optional(),
  weightGramsPerUnit: z.number().optional(),
});

const cartAddressSchema = z.object({
  fname: z.string().optional(),
  lname: z.string().optional(),
  phone: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
});

const shippingPaymentSchema = z.enum(['online', 'on_delivery']);

const cartStateSchema = z.object({
  lines: z.array(cartLineSchema),
  savedLines: z.array(cartLineSchema).default([]),
  offerCode: z.string().nullable().optional(),
  transportId: z.string().nullable().optional(),
  address: cartAddressSchema.nullable().optional(),
  shippingPaymentMethod: shippingPaymentSchema.default('online'),
});

type CartStateInput = z.infer<typeof cartStateSchema>;

type Estimate = {
  subtotal: number;
  discount: number;
};

type PricingTotals = {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  grandTotal: number;
};

type PriceCartSuccess = {
  status: 'success';
  estimate: Estimate;
  totals: PricingTotals;
  offer?: {
    code: string;
    discount: number;
  };
  shipping: {
    transportId: string;
    transportName: string;
    price: number;
    chargedPrice: number;
    deferredPrice: number;
    paymentMethod: z.infer<typeof shippingPaymentSchema>;
    rowLabel?: string;
  };
};

export type PriceCartResult =
  | { status: 'empty'; estimate: Estimate }
  | { status: 'incomplete'; estimate: Estimate; message?: string }
  | PriceCartSuccess
  | { status: 'error'; estimate: Estimate; message: string };

export type CheckoutResult =
  | { ok: true; redirectTo: string; redirectDelayMs?: number }
  | { ok: false; error: string; authRequired?: boolean };

export type SnappPayEligibilityResult = {
  enabled: boolean;
  title?: string;
  description?: string;
  reason?: string;
};

function hasPersianText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

function translateCartError(raw: string | null | undefined, fallback: string): string {
  const message = raw?.trim();
  if (!message) return fallback;
  if (hasPersianText(message)) return message;

  const lower = message.toLowerCase();

  if (lower === 'auth_required' || lower.includes('authentication required')) {
    return 'برای ادامه، لطفاً وارد حساب کاربری شوید.';
  }
  if (lower.includes('guest_phone_invalid')) {
    return 'برای ثبت سفارش مهمان، شماره موبایل معتبر وارد کنید.';
  }
  if (lower.includes('guest_user_create_failed')) {
    return 'ساخت حساب مهمان انجام نشد. لطفاً دوباره تلاش کنید.';
  }
  if (lower.includes('invoice_user_required')) {
    return 'اطلاعات مشتری برای ثبت سفارش کامل نیست.';
  }
  if (lower.includes('product') && lower.includes('not found')) {
    return 'محصول انتخاب‌شده یافت نشد.';
  }
  if (lower.includes('variant') && lower.includes('not found')) {
    return 'تنوع انتخاب‌شده یافت نشد.';
  }
  if (lower.includes('is not active')) {
    return 'تنوع انتخاب‌شده فعال نیست.';
  }
  if (lower.includes('quantity required for fixed price variant')) {
    return 'تعداد برای این کالا معتبر نیست.';
  }
  if (lower.includes('requestedqty required for per-unit variants')) {
    return 'مقدار درخواستی برای این کالا معتبر نیست.';
  }
  if (lower.includes('per-unit pricing requires unitofmeasure on variant')) {
    return 'واحد اندازه‌گیری این کالا نامعتبر است.';
  }
  if (lower.includes('at least one line required')) {
    return 'سبد خرید شما خالی است.';
  }
  if (lower.startsWith('offer invalid:')) {
    const reason = lower.split(':')[1]?.trim();
    if (reason === 'code_required') return 'کد تخفیف را وارد کنید.';
    if (reason === 'offer_not_found' || reason === 'not_found') return 'کد تخفیف معتبر نیست.';
    if (reason === 'inactive') return 'این کد تخفیف فعال نیست.';
    if (reason === 'expired') return 'مهلت استفاده از کد تخفیف تمام شده است.';
    if (reason === 'not_started') return 'زمان استفاده از این کد تخفیف هنوز شروع نشده است.';
    if (reason === 'usage_limit_reached') return 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.';
    if (reason === 'user_limit_reached') return 'شما قبلاً از این کد تخفیف استفاده کرده‌اید.';
    if (reason === 'minimum_subtotal_not_met') return 'حداقل مبلغ لازم برای اعمال کد تخفیف رعایت نشده است.';
    if (reason === 'user_required') return 'برای استفاده از کد تخفیف ابتدا وارد حساب کاربری شوید.';
    return 'کد تخفیف معتبر نیست.';
  }
  if (lower.startsWith('transport quote failed:')) {
    const reason = lower.split(':')[1]?.trim();
    if (reason === 'transport_not_found' || reason === 'not_found') return 'روش ارسال انتخاب‌شده معتبر نیست.';
    if (reason === 'inactive') return 'روش ارسال انتخاب‌شده در حال حاضر فعال نیست.';
    if (reason === 'out_of_range') return 'برای این آدرس، روش ارسال انتخاب‌شده قابل استفاده نیست.';
    return 'محاسبه هزینه ارسال با خطا مواجه شد.';
  }
  if (lower.includes('invoice creation failed')) {
    return 'ثبت سفارش با خطا مواجه شد.';
  }
  if (lower.includes('zarinpal_merchant_id is not configured')) {
    return 'تنظیمات درگاه پرداخت کامل نیست. لطفاً با پشتیبانی تماس بگیرید.';
  }
  if (lower.includes('torobpay credentials are not configured')) {
    return 'تنظیمات درگاه ترب‌پی کامل نیست. لطفاً با پشتیبانی تماس بگیرید.';
  }
  if (lower.includes('azkivam credentials are not configured')) {
    return 'تنظیمات درگاه ازکی‌وام کامل نیست. لطفاً با پشتیبانی تماس بگیرید.';
  }
  if (lower.includes('digipay credentials are not configured')) {
    return 'تنظیمات درگاه دیجی‌پی کامل نیست. لطفاً با پشتیبانی تماس بگیرید.';
  }
  if (lower.includes('snapppay credentials are not configured')) {
    return 'تنظیمات درگاه اسنپ‌پی کامل نیست. لطفاً با پشتیبانی تماس بگیرید.';
  }
  if (lower.includes('bajetpay credentials are not configured')) {
    return 'تنظیمات درگاه باجت‌پی کامل نیست. لطفاً با پشتیبانی تماس بگیرید.';
  }
  if (lower.includes('payment_gateway_unavailable')) {
    return 'این روش پرداخت فعلاً در دسترس نیست. لطفاً روش دیگری را انتخاب کنید.';
  }
  if (lower.includes('invoice_not_found')) {
    return 'سفارش یافت نشد.';
  }
  if (lower.includes('invoice_already_paid')) {
    return 'این سفارش قبلاً پرداخت شده است.';
  }
  if (lower.includes('invoice_amount_mismatch')) {
    return 'مبلغ سفارش تغییر کرده است. لطفاً دوباره تلاش کنید.';
  }
  if (lower.includes('invoice_user_mismatch')) {
    return 'این سفارش متعلق به حساب کاربری شما نیست.';
  }
  if (lower.includes('invoice_status_update_failed')) {
    return 'پرداخت انجام شد اما بروزرسانی وضعیت سفارش ناموفق بود. لطفاً با پشتیبانی تماس بگیرید.';
  }
  if (lower.includes('transaction_not_found') || lower.includes('transaction_')) {
    return 'تراکنش پرداخت با خطا مواجه شد. لطفاً دوباره تلاش کنید.';
  }
  if (lower.includes('azkivam_verification_failed_')) {
    return 'تایید پرداخت ازکی‌وام ناموفق بود. در صورت کسر مبلغ با پشتیبانی تماس بگیرید.';
  }
  if (lower.includes('digipay_verification_failed_') || lower.includes('digipay_')) {
    return 'تایید پرداخت دیجی‌پی ناموفق بود. در صورت کسر مبلغ با پشتیبانی تماس بگیرید.';
  }
  if (lower.includes('snapppay_settle_failed')) {
    return 'پرداخت اسنپ‌پی تایید شد اما نهایی‌سازی آن ناموفق بود. لطفاً با پشتیبانی تماس بگیرید.';
  }
  if (lower.includes('snapppay_verify_failed') || lower.includes('snapppay_')) {
    return 'تایید پرداخت اسنپ‌پی ناموفق بود. در صورت کسر مبلغ با پشتیبانی تماس بگیرید.';
  }
  if (lower.includes('verification_failed_') || lower.includes('verify_failed')) {
    return 'تایید پرداخت ناموفق بود. در صورت کسر مبلغ با پشتیبانی تماس بگیرید.';
  }

  return fallback;
}

function computeEstimate(lines: CartStateInput['lines']): Estimate {
  return lines.reduce(
    (acc, line) => {
      const quantity =
        line.priceModel === 'per_unit'
          ? Math.max(0, line.requestedQty ?? 0)
          : Math.max(0, Math.floor(line.qty ?? 0));
      const base = (line.unitPriceBase ?? 0) * quantity;
      const discount = (line.variantOfferAmount ?? 0) * quantity;
      acc.subtotal += base - discount;
      acc.discount += discount;
      return acc;
    },
    { subtotal: 0, discount: 0 },
  );
}

function normalizeLines(lines: CartStateInput['lines']) {
  return lines
    .map((line) => {
      if (line.priceModel === 'per_unit') {
        const qty = line.requestedQty ?? 0;
        if (qty <= 0) return null;
        return {
          productId: line.productId,
          variantId: line.variantId,
          requestedQty: qty,
          requestedUnit: line.requestedUnit ?? line.unitOfMeasure,
        };
      }
      const qty = Math.floor(line.qty ?? 0);
      if (qty <= 0) return null;
      return {
        productId: line.productId,
        variantId: line.variantId,
        qty,
      };
    })
    .filter(Boolean) as Array<{ productId: string; variantId: string; qty?: number; requestedQty?: number; requestedUnit?: string }>;
}

function isAddressComplete(address: CartStateInput['address']): address is {
  fname: string;
  lname: string;
  phone: string;
  state?: string;
  city?: string;
  address?: string;
  postalCode?: string;
} {
  if (!address) return false;
  const { fname, lname, phone } = address;
  return Boolean(fname && fname.trim() && lname && lname.trim() && phone && phone.trim());
}

function normalizeAddress(address: CartStateInput['address']) {
  if (!address) return undefined;
  const { fname, lname, phone, state, city, address: addr, postalCode } = address;
  return {
    fname: fname?.trim() ?? '',
    lname: lname?.trim() ?? '',
    phone: phone?.trim() ?? '',
    state: state?.trim() || undefined,
    city: city?.trim() || undefined,
    address: addr?.trim() || undefined,
    postalCode: postalCode?.trim() || undefined,
  };
}

async function getAuthUserId(): Promise<string | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = verifyJwt(token);
    return payload.sub;
  } catch {
    return null;
  }
}

async function resolveCheckoutUser(address: CartStateInput['address']): Promise<{ userId: string; guest: boolean }> {
  const authUserId = await getAuthUserId();
  if (authUserId) return { userId: authUserId, guest: false };

  const guestPhone = normalizeGuestCheckoutPhone(address?.phone);
  if (!guestPhone) throw new Error('guest_phone_invalid');

  const fname = address?.fname?.trim() || undefined;
  const lname = address?.lname?.trim() || undefined;
  const state = address?.state?.trim() || undefined;
  const city = address?.city?.trim() || undefined;
  const customerAddress = address?.address?.trim() || undefined;

  const user = await UserModel.findOneAndUpdate(
    { phone: guestPhone },
    {
      $setOnInsert: {
        phone: guestPhone,
        fname,
        lname,
        state,
        city,
        address: customerAddress,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  if (!user) throw new Error('guest_user_create_failed');

  const patch: Record<string, string> = {};
  if (fname && !user.fname) patch.fname = fname;
  if (lname && !user.lname) patch.lname = lname;
  if (state && !user.state) patch.state = state;
  if (city && !user.city) patch.city = city;
  if (customerAddress && !user.address) patch.address = customerAddress;
  if (Object.keys(patch).length > 0) {
    await UserModel.updateOne({ _id: user._id }, { $set: patch }).exec();
  }

  return { userId: user._id.toString(), guest: true };
}

export type CartAvailabilityResult = CartAvailabilityRow[];

export async function loadCartAvailabilityAction(variantIds: string[]): Promise<CartAvailabilityResult> {
  const ids = normalizeCartVariantIds(variantIds);
  if (ids.length === 0) return [];
  try {
    await connectMongoose();
    return await getCartVariantAvailability(ids);
  } catch (error) {
    console.error('loadCartAvailabilityAction failed', error);
    return [];
  }
}

export async function reconcileCartAvailabilityAction(
  variantIds: string[],
): Promise<{ ok: boolean; unavailableVariantIds: string[] }> {
  const ids = normalizeCartVariantIds(variantIds);
  if (ids.length === 0) return { ok: true, unavailableVariantIds: [] };
  try {
    await connectMongoose();
    const rows = await getCartVariantAvailability(ids);
    return { ok: true, unavailableVariantIds: getUnavailableVariantIds(ids, rows) };
  } catch (error) {
    console.error('reconcileCartAvailabilityAction failed', error);
    return { ok: false, unavailableVariantIds: [] };
  }
}

export async function loadSavedAddressAction(): Promise<CartStateInput['address'] | null> {
  const userId = await getAuthUserId();
  if (!userId) return null;

  try {
    await connectMongoose();
    const invoice = await InvoiceModel.findOne(
      { userId, 'addressSnapshot.phone': { $nin: [null, ''] } },
      { addressSnapshot: 1 },
    ).sort({ createdAt: -1 }).lean();
    if (!invoice?.addressSnapshot) return null;
    return {
      fname: invoice.addressSnapshot.fname ?? undefined,
      lname: invoice.addressSnapshot.lname ?? undefined,
      phone: invoice.addressSnapshot.phone ?? undefined,
      state: invoice.addressSnapshot.state ?? undefined,
      city: invoice.addressSnapshot.city ?? undefined,
      address: invoice.addressSnapshot.address ?? undefined,
      postalCode: invoice.addressSnapshot.postalCode ?? undefined,
    };
  } catch (error) {
    console.error('loadSavedAddressAction failed', error);
    return null;
  }
}

export type CheckoutInventoryPreflightResult =
  | { ok: true }
  | { ok: false; error: string; issues?: ReturnType<typeof buildCartAvailabilityIssues> };

export async function preflightCheckoutInventoryAction(
  rawState: CartStateInput,
): Promise<CheckoutInventoryPreflightResult> {
  const parsed = cartStateSchema.parse(rawState);
  if (parsed.lines.length === 0) return { ok: false, error: 'سبد خرید شما خالی است.' };

  try {
    await connectMongoose();
    const rows = await getCartVariantAvailability(parsed.lines.map((line) => line.variantId));
    const issues = buildCartAvailabilityIssues(parsed.lines as CartAvailabilityLine[], rows);
    if (issues.length === 0) return { ok: true };
    return {
      ok: false,
      error: issues.length > 1
        ? `${issues.length.toLocaleString('fa-IR')} قلم از کالاهای سبد خرید موجودی کافی ندارد. لطفاً تعداد را اصلاح کنید.`
        : issues[0].message,
      issues,
    };
  } catch (error) {
    console.error('preflightCheckoutInventoryAction failed', error);
    return { ok: false, error: 'بررسی موجودی سفارش انجام نشد. لطفاً دوباره تلاش کنید.' };
  }
}

export async function priceCartAction(rawState: CartStateInput): Promise<PriceCartResult> {
  const parsed = cartStateSchema.parse(rawState);

  const estimate = computeEstimate(parsed.lines);

  if (parsed.lines.length === 0) {
    return { status: 'empty', estimate };
  }

  const normalizedLines = normalizeLines(parsed.lines);
  if (normalizedLines.length === 0) {
    return { status: 'empty', estimate };
  }

  const addressComplete = isAddressComplete(parsed.address);
  if (!parsed.transportId || !addressComplete) {
    return {
      status: 'incomplete',
      estimate,
      message: 'برای محاسبه هزینه ارسال، روش ارسال و آدرس را تکمیل کنید.',
    };
  }

  const userId = await getAuthUserId();

  const invoiceInput: InvoicePricingInput = {
    userId: userId ?? undefined,
    lines: normalizedLines,
    transportId: parsed.transportId,
    address: normalizeAddress(parsed.address)!,
    offerCode: parsed.offerCode?.trim() ? parsed.offerCode.trim().toUpperCase() : undefined,
    shippingPaymentMethod: parsed.shippingPaymentMethod,
  };

  try {
    await connectMongoose();
    const pricing = await previewInvoice(invoiceInput);
    return {
      status: 'success',
      estimate,
      totals: {
        subtotal: pricing.subtotal,
        discountTotal: pricing.discountTotal,
        shippingTotal: pricing.shippingTotal,
        grandTotal: pricing.grandTotal,
      },
      offer: pricing.offer
        ? {
          code: pricing.offer.code,
          discount: pricing.offer.discount,
        }
        : undefined,
      shipping: {
        transportId: pricing.shipping.transportId.toString(),
        transportName: pricing.shipping.transportName,
        price: pricing.shipping.price,
        chargedPrice: pricing.shipping.chargedPrice,
        deferredPrice: pricing.shipping.deferredPrice,
        paymentMethod: pricing.shipping.paymentMethod,
        rowLabel: pricing.shipping.rowLabel,
      },
    } satisfies PriceCartSuccess;
  } catch (error) {
    console.error('priceCartAction failed', error);
    const message = translateCartError(error instanceof Error ? error.message : null, 'خطا در محاسبه مبلغ سفارش');
    return {
      status: 'error',
      estimate,
      message,
    };
  }
}

/**
 * Separate server action to check SnappPay eligibility.
 * Runs independently AFTER priceCartAction so it doesn't block pricing display.
 */
export async function checkSnappPayEligibilityAction(
  amountToman: number,
): Promise<SnappPayEligibilityResult> {
  try {
    await connectMongoose();
    const result = await checkSnappPayEligibilityForAmount(amountToman);
    if (result.enabled) {
      return {
        enabled: true,
        title: result.title,
        description: result.description,
      };
    }
    return { enabled: false, reason: result.reason };
  } catch (error) {
    console.error('checkSnappPayEligibilityAction failed', error);
    return { enabled: false, reason: 'eligibility_failed' };
  }
}

export async function getAvailablePaymentGatewaysAction(): Promise<PaymentGateway[]> {
  try {
    return await getVisiblePaymentGateways();
  } catch (error) {
    console.error('getAvailablePaymentGatewaysAction failed', error);
    return [];
  }
}

export async function checkoutAndPayAction(
  rawState: CartStateInput,
  gateway: PaymentGateway = 'zarinpal',
  checkoutAttemptKey?: string,
): Promise<CheckoutResult> {
  const parsed = cartStateSchema.parse(rawState);

  if (parsed.lines.length === 0) {
    return { ok: false, error: 'سبد خرید شما خالی است.' };
  }

  const normalizedLines = normalizeLines(parsed.lines);
  if (normalizedLines.length === 0) {
    return { ok: false, error: 'تعداد اقلام سبد خرید نامعتبر است.' };
  }

  if (!parsed.transportId) {
    return { ok: false, error: 'لطفاً روش ارسال را انتخاب کنید.' };
  }

  if (!isAddressComplete(parsed.address)) {
    return { ok: false, error: 'لطفاً اطلاعات آدرس را تکمیل کنید.' };
  }

  const preflight = await preflightCheckoutInventoryAction(parsed);
  if (!preflight.ok) return { ok: false, error: preflight.error };

  let userId: string;
  try {
    await connectMongoose();
    userId = (await resolveCheckoutUser(parsed.address)).userId;
  } catch (error) {
    return {
      ok: false,
      error: translateCartError(error instanceof Error ? error.message : null, 'خطا در آماده‌سازی سفارش'),
    };
  }

  const invoiceInput: InvoicePricingInput = {
    userId,
    lines: normalizedLines,
    transportId: parsed.transportId,
    address: normalizeAddress(parsed.address)!,
    offerCode: parsed.offerCode?.trim() ? parsed.offerCode.trim().toUpperCase() : undefined,
    shippingPaymentMethod: parsed.shippingPaymentMethod,
    checkoutAttemptKey: checkoutAttemptKey?.trim() || undefined,
    paymentMethod: gateway,
  };

  try {
    await connectMongoose();
    const pricing = await previewInvoice(invoiceInput);
    if (pricing.grandTotal <= 0) {
      return { ok: false, error: 'مبلغ سفارش نامعتبر است.' };
    }
    if (gateway === 'snapppay') {
      const snapppayEligibility = await checkSnappPayEligibilityForAmount(pricing.grandTotal);
      if (!snapppayEligibility.enabled) {
        return { ok: false, error: 'در حال حاضر پرداخت با اسنپ‌پی برای این سفارش فعال نیست.' };
      }
    }

    const invoice = await createInvoice(invoiceInput);
    let payment;
    try {
      payment = await createPaymentForInvoice({
        invoiceId: invoice._id.toString(),
        userId,
        amount: invoice.grandTotal,
        description: `پرداخت سفارش ${invoice.number ?? invoice._id.toString()}`,
        mobile: invoice.addressSnapshot?.phone,
        gateway,
        requestKey: checkoutAttemptKey,
      });
    } catch (error) {
      await updateInvoiceStatus(invoice._id.toString(), 'canceled');
      throw error;
    }

    return {
      ok: true,
      redirectTo: payment.gatewayUrl,
      redirectDelayMs: gateway === 'azkivam' ? 5_000 : undefined,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    // Expected business rejections (out of stock, invalid input) are not system
    // failures — log them at warn so real errors aren't buried under them.
    const expected =
      (error instanceof Error && error.name === 'InventoryAdjustmentError') ||
      msg === 'User data not valid!' ||
      /insufficient inventory/i.test(msg);
    if (expected) {
      console.warn('checkoutAndPayAction rejected:', msg);
    } else {
      console.error('checkoutAndPayAction failed', error);
    }
    const message = translateCartError(msg || null, 'خطا در ثبت سفارش و پرداخت');
    return { ok: false, error: message };
  }
}
