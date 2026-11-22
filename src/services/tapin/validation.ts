import { z } from 'zod';
import { normalizeIranMobile } from '@/utils/iran-mobile';

const numericCode = z.coerce.number().int().nonnegative();
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const tapinMobile = z.preprocess(
  (value) => (typeof value === 'string' ? (normalizeIranMobile(value) ?? value) : value),
  z
    .string()
    .trim()
    .regex(/^09\d{9}$/, 'شماره موبایل معتبر نیست.'),
);

export const tapinProductSchema = z.object({
  count: z.coerce.number().int().positive(),
  discount: z.coerce.number().int().nonnegative().default(0),
  price: z.coerce.number().int().nonnegative(),
  title: requiredText(100),
  weight: z.coerce.number().int().nonnegative(),
  product_id: z.coerce.number().int().positive().nullish(),
});

export const tapinShipmentSchema = z.object({
  shop_id: z.string().uuid().optional(),
  address: requiredText(300),
  city_code: numericCode,
  province_code: numericCode,
  description: z.string().trim().max(250).nullish(),
  email: z.string().email().nullish().or(z.literal('')),
  employee_code: z.coerce.number().int().default(-1),
  first_name: requiredText(30),
  last_name: requiredText(40),
  mobile: tapinMobile,
  phone: z.string().trim().max(20).nullish(),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'کد پستی باید ۱۰ رقم باشد.'),
  pay_type: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  order_type: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(5)]),
  box_id: z.coerce.number().int().positive(),
  packet_type: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  pre_paid_price: z.coerce.number().int().nonnegative().default(0),
  packaging_price: z.coerce.number().int().nonnegative().default(0),
  package_weight: z.coerce.number().int().nonnegative(),
  has_insurance: z.boolean().default(true),
  content_type: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(1),
  kiosk_id: z.coerce.number().int().positive().optional(),
  duration: z.coerce.number().int().positive().optional(),
  parcel_turning: z.boolean().optional(),
  products: z.array(tapinProductSchema).min(1),
});

export const tapinRegisterSchema = tapinShipmentSchema.extend({
  register_type: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
  manual_id: z.string().trim().min(1).max(128),
  presenter_code: z.coerce.number().int().positive().optional(),
});

export const tapinInvoiceRequestSchema = z
  .object({
    invoiceId: z.string().trim().min(1),
    shopId: z.string().uuid().optional(),
    provinceCode: z.coerce.number().int().positive(),
    cityCode: z.coerce.number().int().positive(),
    boxId: z.coerce.number().int().positive(),
    packetType: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
    packageWeight: z.coerce.number().int().nonnegative().default(0),
    orderType: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(5)]).default(1),
    registerType: z.union([z.literal(0), z.literal(1), z.literal(2)]).default(0),
    contentType: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(1),
    hasInsurance: z.boolean().default(true),
    payType: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
    employeeCode: z.coerce.number().int().default(-1),
    prePaidPrice: z.coerce.number().int().nonnegative().default(0),
    packagingPrice: z.coerce.number().int().nonnegative().default(0),
    presenterCode: z.coerce.number().int().positive().optional(),
    kioskId: z.coerce.number().int().positive().optional(),
    duration: z.coerce.number().int().positive().max(48).optional(),
    parcelTurning: z.boolean().optional(),
    itemWeights: z
      .array(
        z.object({
          variantId: z.string().trim().min(1),
          weightGrams: z.coerce.number().int().nonnegative(),
        }),
      )
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.kioskId && value.duration !== 48) {
      context.addIssue({
        code: 'custom',
        path: ['duration'],
        message: 'مدت نگهداری لاکر باید ۴۸ ساعت باشد.',
      });
    }
    if (!value.kioskId && value.duration !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['duration'],
        message: 'مدت نگهداری فقط برای لاکر قابل ارسال است.',
      });
    }
  });
