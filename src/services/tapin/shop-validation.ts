import { z } from 'zod';

const required = z.string().trim().min(1).max(300);
const image = z
  .string()
  .startsWith('data:image/')
  .max(1_400_000, 'حجم تصویر نباید بیشتر از یک مگابایت باشد.');

export const tapinShopInputSchema = z
  .object({
    shop_name: required.max(100),
    first_name: required.max(100),
    last_name: required.max(100),
    email: z.string().trim().email().max(200),
    father_name: required.max(100),
    phone: z.string().trim().max(20).optional(),
    mobile: z
      .string()
      .trim()
      .regex(/^09\d{9}$/),
    birth_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/),
    certificate_code: required.max(30),
    certificate_serial_number: required.max(30),
    birthday_location: required.max(100),
    national_code: z
      .string()
      .trim()
      .regex(/^\d{10}$/),
    address: required.max(500),
    province: z.coerce.number().int().positive(),
    city: z.coerce.number().int().positive(),
    postal_code: z
      .string()
      .trim()
      .regex(/^\d{10}$/),
    unit: required.max(20),
    floor: required.max(20),
    plaque: required.max(20),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    website: required.max(200),
    available_hours: required.max(100),
    instagram_id: required.max(100),
    shop_description: z.string().trim().max(1000).optional(),
    logo_image: image,
    id_cart_image: image,
    is_legal_shop: z.boolean(),
    company_name: z.string().trim().max(200).optional(),
    economic_code: z.string().trim().max(50).optional(),
    company_national_code: z.string().trim().max(50).optional(),
    register_code: z.string().trim().max(50).optional(),
  })
  .superRefine((value, context) => {
    if (!value.is_legal_shop) return;
    for (const key of [
      'company_name',
      'economic_code',
      'company_national_code',
      'register_code',
    ] as const) {
      if (!value[key]) context.addIssue({ code: 'custom', path: [key], message: 'الزامی است.' });
    }
  });
