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

export const configFieldsSchema = z.object({
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
