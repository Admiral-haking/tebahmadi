import { z } from 'zod';

function optionalString() {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? '');
}

function optionalUrl(message: string) {
  return z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^https?:\/\/.+/i.test(value), { message })
    .transform((value) => value ?? '');
}

function numericString(message: string) {
  return z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), { message })
    .transform((value) => (value && value.length > 0 ? value : '5'));
}

function optionalIntegerString(message: string) {
  return z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), { message })
    .transform((value) => value ?? '');
}

function optionalChoice(values: string[], message: string) {
  return z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || values.includes(value), { message })
    .transform((value) => value ?? '');
}

const baseConfigFieldsSchema = z.object({
  smsSignature: optionalString(),
  marketingWhatsAppLink: optionalUrl('لینک واتساپ معتبر نیست'),
  lowStockThreshold: numericString('فقط عدد وارد کنید'),
  maintenanceMode: z.boolean(),
  torobOrderTrackingEnabled: z.boolean(),
  aiProvider: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === 'deepseek' ? 'deepseek' : 'openai')),
  tapinAutoRegisterEnabled: z.boolean(),
  tapinAutoRegisterShopId: optionalString(),
  tapinAutoRegisterBoxId: optionalIntegerString('شناسه جعبه باید عدد باشد'),
  tapinAutoRegisterPackageWeightGrams: optionalIntegerString('وزن بسته‌بندی باید عدد باشد'),
  tapinAutoRegisterOrderType: optionalChoice(['0', '1', '3', '5'], 'نوع سفارش معتبر نیست'),
  tapinAutoRegisterPacketType: optionalChoice(['1', '2', '3'], 'نوع بسته معتبر نیست'),
  tapinAutoRegisterContentType: optionalChoice(['1', '2', '3', '4'], 'نوع محتوا معتبر نیست'),
  tapinAutoRegisterPayType: optionalChoice(['0', '1', '2', '3'], 'نوع پرداخت معتبر نیست'),
  tapinAutoRegisterHasInsurance: z.boolean(),
  tapinAutoRegisterMaxAttempts: optionalIntegerString('تعداد تلاش باید عدد باشد'),
  tapinAutoRegisterRetryDelaySeconds: optionalIntegerString('فاصله تلاش باید عدد باشد'),
});

export const configFieldsSchema = baseConfigFieldsSchema.superRefine((value, context) => {
  if (!value.tapinAutoRegisterEnabled) return;

  const requiredKeys: Array<keyof typeof value> = [
    'tapinAutoRegisterShopId',
    'tapinAutoRegisterBoxId',
    'tapinAutoRegisterPackageWeightGrams',
    'tapinAutoRegisterOrderType',
    'tapinAutoRegisterPacketType',
    'tapinAutoRegisterContentType',
    'tapinAutoRegisterPayType',
    'tapinAutoRegisterMaxAttempts',
    'tapinAutoRegisterRetryDelaySeconds',
  ];
  requiredKeys.forEach((key) => {
    if (!value[key]) {
      context.addIssue({ code: 'custom', path: [key], message: 'برای فعال‌سازی باید تکمیل شود.' });
    }
  });
});

export type ConfigFieldValues = z.infer<typeof configFieldsSchema>;
export type ConfigFieldKey = keyof ConfigFieldValues;

export const CONFIG_FIELD_DEFAULTS: ConfigFieldValues = {
  smsSignature: '',
  marketingWhatsAppLink: '',
  lowStockThreshold: '5',
  maintenanceMode: false,
  torobOrderTrackingEnabled: false,
  aiProvider: 'openai',
  tapinAutoRegisterEnabled: false,
  tapinAutoRegisterShopId: '',
  tapinAutoRegisterBoxId: '',
  tapinAutoRegisterPackageWeightGrams: '',
  tapinAutoRegisterOrderType: '',
  tapinAutoRegisterPacketType: '',
  tapinAutoRegisterContentType: '',
  tapinAutoRegisterPayType: '',
  tapinAutoRegisterHasInsurance: false,
  tapinAutoRegisterMaxAttempts: '3',
  tapinAutoRegisterRetryDelaySeconds: '60',
};

export const REQUIRED_CONFIG_FIELD_KEYS: ConfigFieldKey[] = [];

export type ConfigFieldInputType = 'text' | 'textarea' | 'url' | 'switch' | 'tel' | 'select';

export interface ConfigFieldDefinition {
  key: ConfigFieldKey;
  label: string;
  helperText?: string;
  placeholder?: string;
  type?: ConfigFieldInputType;
  envKey?: string;
  required?: boolean;
  rows?: number;
  /** Options for type === 'select'. */
  options?: Array<{ value: string; label: string }>;
}

export interface ConfigSectionDefinition {
  id: string;
  title: string;
  subtitle: string;
  fields: ConfigFieldDefinition[];
}

export const CONFIG_SECTIONS: ConfigSectionDefinition[] = [
  {
    id: 'notifications',
    title: 'پیامک و مارکتینگ',
    subtitle: 'اطلاعاتی که به پیامک‌ها و کانال‌های ارتباطی اضافه می‌شود.',
    fields: [
      {
        key: 'smsSignature',
        label: 'امضای انتهای پیامک',
        helperText: 'در انتهای تمام پیامک‌ها اضافه می‌شود.',
        placeholder: 'فروشگاه قلب دوم',
      },
      {
        key: 'marketingWhatsAppLink',
        label: 'لینک واتساپ فروش',
        helperText: 'در صفحه تماس و پیامک‌های پیگیری استفاده خواهد شد.',
        placeholder: 'https://wa.me/98xxxxxxxxxx',
        type: 'url',
      },
      {
        key: 'lowStockThreshold',
        label: 'آستانه هشدار اتمام موجودی',
        helperText: 'وقتی موجودی محصول به این عدد برسد هشدار ارسال می‌شود.',
        placeholder: '5',
      },
    ],
  },
  {
    id: 'ops',
    title: 'عملیات و نگهداشت',
    subtitle: 'حالت تعمیر و نگهداشت سراسری فروشگاه.',
    fields: [
      {
        key: 'maintenanceMode',
        label: 'حالت تعمیرات',
        helperText: 'در حال حاضر فقط برای اطلاع داخلی استفاده می‌شود.',
        type: 'switch',
      },
    ],
  },
  {
    id: 'integrations',
    title: 'یکپارچه‌سازی‌ها',
    subtitle: 'اتصال به سرویس‌های بیرونی و رهگیری سفارش.',
    fields: [
      {
        key: 'torobOrderTrackingEnabled',
        label: 'رهگیری سفارشات ترب (Torob)',
        helperText: 'با فعال‌سازی این گزینه، ترب می‌تواند از طریق API از وضعیت سفارشات مطلع شود.',
        type: 'switch',
      },
    ],
  },
  {
    id: 'tapin',
    title: 'ارسال خودکار تاپین',
    subtitle: 'پس از پرداخت موفق، مرسوله را با اطلاعات صریح و قابل بررسی در تاپین ثبت می‌کند.',
    fields: [
      {
        key: 'tapinAutoRegisterEnabled',
        label: 'فعال‌سازی ثبت خودکار پس از پرداخت',
        helperText: 'بدون تکمیل همهٔ گزینه‌های زیر فعال نمی‌شود و وضعیت تاپین را خودکار به آمادهٔ ارسال تغییر نمی‌دهد.',
        type: 'switch',
      },
      {
        key: 'tapinAutoRegisterShopId',
        label: 'شناسه فروشگاه تاپین',
        helperText: 'UUID فروشگاه را دقیقاً از پنل تاپین وارد کنید.',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
      },
      {
        key: 'tapinAutoRegisterBoxId',
        label: 'شناسه جعبه تاپین',
        helperText: 'شناسه جعبه باید از فهرست رسمی تاپین انتخاب شود.',
        placeholder: 'مثلاً 12',
      },
      {
        key: 'tapinAutoRegisterPackageWeightGrams',
        label: 'وزن بسته‌بندی (گرم)',
        helperText: 'وزن بسته‌بندی را بدون حدس و برحسب گرم وارد کنید.',
        placeholder: 'مثلاً 180',
      },
      {
        key: 'tapinAutoRegisterOrderType',
        label: 'نوع سفارش تاپین',
        type: 'select',
        options: [
          { value: '0', label: 'نوع ۰' },
          { value: '1', label: 'نوع ۱' },
          { value: '3', label: 'نوع ۳' },
          { value: '5', label: 'نوع ۵' },
        ],
      },
      {
        key: 'tapinAutoRegisterPacketType',
        label: 'نوع بسته',
        type: 'select',
        options: [
          { value: '1', label: 'نوع ۱' },
          { value: '2', label: 'نوع ۲' },
          { value: '3', label: 'نوع ۳' },
        ],
      },
      {
        key: 'tapinAutoRegisterContentType',
        label: 'نوع محتوا',
        type: 'select',
        options: [
          { value: '1', label: 'نوع ۱' },
          { value: '2', label: 'نوع ۲' },
          { value: '3', label: 'نوع ۳' },
          { value: '4', label: 'نوع ۴' },
        ],
      },
      {
        key: 'tapinAutoRegisterPayType',
        label: 'نوع پرداخت تاپین',
        type: 'select',
        options: [
          { value: '0', label: 'نوع ۰' },
          { value: '1', label: 'نوع ۱' },
          { value: '2', label: 'نوع ۲' },
          { value: '3', label: 'نوع ۳' },
        ],
      },
      {
        key: 'tapinAutoRegisterHasInsurance',
        label: 'بیمهٔ مرسوله',
        helperText: 'مقدار خاموش نیز به‌صورت صریح ذخیره می‌شود.',
        type: 'switch',
      },
      {
        key: 'tapinAutoRegisterMaxAttempts',
        label: 'حداکثر تلاش مجدد',
        placeholder: '3',
      },
      {
        key: 'tapinAutoRegisterRetryDelaySeconds',
        label: 'فاصلهٔ تلاش مجدد (ثانیه)',
        placeholder: '60',
      },
    ],
  },
  {
    id: 'ai',
    title: 'هوش مصنوعی',
    subtitle: 'انتخاب موتور هوش مصنوعی برای تولید محصول و انتقال از دیجی‌کالا.',
    fields: [
      {
        key: 'aiProvider',
        label: 'موتور هوش مصنوعی',
        helperText:
          'OpenAI پایدار و در دسترس است. DeepSeek از برخی شبکه‌ها (از جمله سرور فعلی) قابل اتصال نیست؛ تا حل دسترسی شبکه، OpenAI را انتخاب کنید.',
        type: 'select',
        options: [
          { value: 'openai', label: 'OpenAI (پیشنهادی)' },
          { value: 'deepseek', label: 'DeepSeek' },
        ],
      },
    ],
  },
];
