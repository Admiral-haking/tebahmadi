import type { InvoiceDocument } from '@/orders/models/Invoice';
import { normalizeIranMobile } from '@/utils/iran-mobile';
import type { TapinRegisterInput } from './types';

type TapinInvoiceOptions = {
  provinceCode: number;
  cityCode: number;
  boxId: number;
  packetType: number;
  packageWeight: number;
  orderType: 0 | 1 | 3 | 5;
  registerType: 0 | 1 | 2;
  contentType: 1 | 2 | 3 | 4;
  hasInsurance: boolean;
  itemWeights?: Array<{ variantId: string; weightGrams: number }>;
};

/**
 * A persisted shipment may legitimately use Tapin's documented order_type=0.
 * Keep the edit-route guard in one tested place so a falsy enum value is not
 * confused with missing configuration.
 */
export function hasTapinShipmentEditConfiguration(config: {
  provinceCode?: unknown;
  cityCode?: unknown;
  boxId?: unknown;
  orderType?: unknown;
}): config is {
  provinceCode: number;
  cityCode: number;
  boxId: number;
  orderType: 0 | 1 | 3 | 5;
} {
  return (
    Boolean(config.provinceCode && config.cityCode && config.boxId) &&
    config.orderType !== null &&
    config.orderType !== undefined
  );
}

const rial = (toman: number | undefined | null) => Math.max(0, Math.round((toman ?? 0) * 10));

function normalizeDigits(value: unknown): string {
  return String(value ?? '')
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

function itemWeightOverrides(options: TapinInvoiceOptions): Map<string, number> {
  return new Map(
    (options.itemWeights ?? [])
      .map((item) => [String(item.variantId), Math.max(0, Math.round(item.weightGrams))] as const)
      .filter(([variantId]) => variantId.length > 0),
  );
}

export function invoiceTapinWeight(
  invoice: InvoiceDocument | Record<string, any>,
  options: Pick<TapinInvoiceOptions, 'itemWeights'> = {},
): number {
  const overrides = itemWeightOverrides(options as TapinInvoiceOptions);
  return (invoice.lines || []).reduce((total: number, line: Record<string, any>) => {
    const variantId = String(line.variantId ?? '');
    const weight = overrides.has(variantId) ? overrides.get(variantId) : line.weightGrams;
    return (
      total +
      Math.max(0, Math.round(weight ?? 0)) *
        Math.max(1, Math.round(line.qty ?? line.requestedQty ?? 1))
    );
  }, 0);
}

export function invoiceToTapin(
  invoice: InvoiceDocument | Record<string, any>,
  options: TapinInvoiceOptions,
): TapinRegisterInput {
  const address = invoice.addressSnapshot;
  if (!address) throw new Error('نشانی گیرنده روی سفارش ثبت نشده است.');
  const productWeight = invoiceTapinWeight(invoice, options);
  const totalWeight = productWeight + options.packageWeight;
  if (productWeight <= 0) {
    throw new Error('وزن اقلام سفارش مشخص نیست؛ ابتدا وزن محصولات را در کاتالوگ ثبت کنید.');
  }
  if (totalWeight < 50 || totalWeight > 30_000) {
    throw new Error('وزن کل مرسوله تاپین باید بین ۵۰ تا ۳۰٬۰۰۰ گرم باشد.');
  }

  const overrides = itemWeightOverrides(options);
  const mobile = normalizeIranMobile(String(address.phone ?? ''));
  if (!mobile) throw new Error('شماره موبایل گیرنده معتبر نیست.');

  return {
    register_type: options.registerType,
    manual_id: String(invoice.number || invoice._id),
    address: String(address.address || '').trim(),
    city_code: options.cityCode,
    province_code: options.provinceCode,
    description: `سفارش ${invoice.number}`,
    email: null,
    employee_code: -1,
    first_name: String(address.fname || '').trim(),
    last_name: String(address.lname || '').trim(),
    mobile,
    phone: null,
    postal_code: normalizeDigits(address.postalCode).replace(/\D/g, ''),
    pay_type: invoice.shippingPaymentMethod === 'on_delivery' ? 2 : 1,
    order_type: options.orderType,
    box_id: options.boxId,
    packet_type: options.packetType,
    pre_paid_price: 0,
    packaging_price: 0,
    package_weight: options.packageWeight,
    has_insurance: options.hasInsurance,
    content_type: options.contentType,
    products: (invoice.lines || []).map((line: Record<string, any>) => {
      const variantId = String(line.variantId ?? '');
      const weight = overrides.has(variantId) ? overrides.get(variantId) : line.weightGrams;
      return {
        count: Math.max(1, Math.round(line.qty ?? line.requestedQty ?? 1)),
        discount: 0,
        price: rial(line.unitPriceEffective),
        title: String(line.title || line.sku || 'کالا').slice(0, 100),
        // Tapin expects per-unit product weight; package weight is sent separately.
        weight: Math.max(0, Math.round(weight ?? 0)),
        product_id: null,
      };
    }),
  };
}
