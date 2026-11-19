import type { SmsTemplateKind } from '../hooks';

export interface SmsTemplateFieldDefinition {
  key: string;
  label: string;
  description?: string;
  sample?: string;
  optional?: boolean;
}

export interface SmsTemplatePreset {
  kind: SmsTemplateKind;
  title: string;
  summary: string;
  helperText?: string;
  docAnchor?: string;
  comingSoon?: boolean;
  fields: SmsTemplateFieldDefinition[];
  recommendedOrder?: string[];
}

export const SMS_TEMPLATE_PRESETS: SmsTemplatePreset[] = [
  {
    kind: 'loginCode',
    title: 'ورود با کد یکبار مصرف',
    summary: 'در فرآیند ورود/ثبت‌نام مشتری ارسال می‌شود.',
    helperText: 'در SMS.ir یک قالب Verify بسازید؛ مقدار پارامتر آن باید CODE باشد و شناسه عددی در SMS_IR_OTP_TEMPLATE_ID تنظیم شود.',
    docAnchor: '#VerificationOldBox',
    fields: [
      {
        key: 'code',
        label: 'code',
        description: 'کد تایید ۴ یا ۵ رقمی تولید شده توسط سیستم',
        sample: '742195',
      },
    ],
    recommendedOrder: ['code'],
  },
  {
    kind: 'orderConfirmation',
    title: 'تایید ثبت سفارش',
    summary: 'بعد از ایجاد فاکتور پرداخت‌شده برای کاربر ارسال می‌شود.',
    helperText: 'مقادیر از تابع buildInvoiceSmsData استخراج می‌شوند.',
    docAnchor: '#SendOtpWithParams',
    fields: [
      {
        key: 'name',
        label: 'name',
        description: 'نام کامل خریدار (fname + lname)',
        sample: 'علی رضایی',
      },
      {
        key: 'fname',
        label: 'fname',
        description: 'نام کوچک خریدار',
        sample: 'علی',
        optional: true,
      },
      {
        key: 'lname',
        label: 'lname',
        description: 'نام خانوادگی خریدار',
        sample: 'رضایی',
        optional: true,
      },
      {
        key: 'order',
        label: 'order',
        description: 'شماره سفارش/فاکتور',
        sample: 'INV-1458',
      },
      {
        key: 'invoice',
        label: 'invoice',
        description: 'همان شماره فاکتور (alias فیلد order)',
        sample: 'INV-1458',
        optional: true,
      },
      {
        key: 'total',
        label: 'total',
        description: 'مبلغ کل پرداختی (به ریال)',
        sample: '1850000',
      },
      {
        key: 'subtotal',
        label: 'subtotal',
        description: 'جمع جزء قبل از تخفیف',
        sample: '1900000',
        optional: true,
      },
      {
        key: 'discount',
        label: 'discount',
        description: 'مجموع تخفیف اعمال شده',
        sample: '50000',
        optional: true,
      },
      {
        key: 'shipping',
        label: 'shipping',
        description: 'هزینه ارسال',
        sample: '25000',
        optional: true,
      },
      {
        key: 'transport',
        label: 'transport',
        description: 'روش ارسال/پیک انتخابی',
        sample: 'پست پیشتاز',
        optional: true,
      },
    ],
    recommendedOrder: ['name', 'order', 'total', 'transport'],
  },
  {
    kind: 'paymentReceipt',
    title: 'رسید پرداخت',
    summary: 'پس از تایید تراکنش بانکی برای مشتری ارسال خواهد شد.',
    helperText: 'این قالب به زودی از سرویس پرداخت مقداردهی می‌شود؛ می‌توانید از حالا قالب را آماده کنید.',
    docAnchor: '#SendOtpWithParams',
    comingSoon: true,
    fields: [
      {
        key: 'amount',
        label: 'amount',
        description: 'مبلغ پرداخت',
        sample: '250000',
      },
      {
        key: 'orderNumber',
        label: 'orderNumber',
        description: 'شماره سفارش مرتبط',
        sample: 'INV-2734',
      },
      {
        key: 'referenceId',
        label: 'referenceId',
        description: 'کد پیگیری درگاه',
        sample: '1234567890',
      },
      {
        key: 'gateway',
        label: 'gateway',
        description: 'نام درگاه یا بانک',
        sample: 'زرین‌پال',
        optional: true,
      },
      {
        key: 'paidAt',
        label: 'paidAt',
        description: 'تاریخ/زمان پرداخت',
        sample: '1403/02/12 18:24',
        optional: true,
      },
    ],
    recommendedOrder: ['amount', 'referenceId', 'orderNumber'],
  },
  {
    kind: 'shipmentTracking',
    title: 'رهگیری ارسال',
    summary: 'وقتی سفارش به وضعیت «ارسال شد» می‌رسد به کاربر پیامک می‌شود.',
    helperText: 'در آپدیت مرحله بسته‌بندی/پست مقداردهی می‌گردد.',
    docAnchor: '#SendOtpWithParams',
    fields: [
      {
        key: 'trackingCode',
        label: 'trackingCode',
        description: 'کد رهگیری شرکت حمل‌ونقل',
        sample: 'PX458795621IR',
      },
      {
        key: 'orderNumber',
        label: 'orderNumber',
        description: 'شماره سفارش',
        sample: 'INV-1520',
      },
      {
        key: 'transportName',
        label: 'transportName',
        description: 'نام سرویس ارسال',
        sample: 'تیپاکس',
        optional: true,
      },
    ],
    recommendedOrder: ['trackingCode', 'orderNumber', 'transportName'],
  },
  {
    kind: 'reviewRequest',
    title: 'دعوت به ثبت نظر',
    summary: 'پس از اتمام سفارش لینک فرم نظرسنجی برای خریدار ارسال می‌شود.',
    helperText: 'کد تایید و لینک فرم به ترتیب در پارامترهای code و link قرار می‌گیرد.',
    docAnchor: '#SendOtpWithParams',
    fields: [
      {
        key: 'code',
        label: 'code',
        description: 'کد یکبار مصرف تایید فرم',
        sample: '482915',
      },
      {
        key: 'order',
        label: 'order',
        description: 'شماره سفارش/فاکتور',
        sample: 'INV-2048',
        optional: true,
      },
      {
        key: 'link',
        label: 'link',
        description: 'لینک مستقیم فرم نظرسنجی',
        sample: 'https://example.com/review/abc123?code=482915',
      },
      {
        key: 'name',
        label: 'name',
        description: 'نام خریدار در صورت ثبت در فاکتور',
        sample: 'مریم اکبری',
        optional: true,
      },
    ],
    recommendedOrder: ['code', 'link', 'order'],
  },
];

export const SMS_TEMPLATE_KINDS = SMS_TEMPLATE_PRESETS.map((preset) => preset.kind) as SmsTemplateKind[];

export const SMS_TEMPLATE_PRESET_MAP = SMS_TEMPLATE_PRESETS.reduce((acc, preset) => {
  acc[preset.kind] = preset;
  return acc;
}, {} as Record<SmsTemplateKind, SmsTemplatePreset>);
