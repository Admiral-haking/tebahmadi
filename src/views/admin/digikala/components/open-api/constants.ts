import type { Method, WorkflowKey } from "./types";

export const WRITE_METHODS = new Set<Method>(["POST", "PUT", "PATCH", "DELETE"]);

export const METHOD_LABELS: Record<Method, string> = {
    GET: "دریافت",
    POST: "ثبت",
    PUT: "ویرایش کامل",
    PATCH: "ویرایش جزئی",
    DELETE: "حذف",
};

export const METHOD_COLORS: Record<Method, "success" | "primary" | "warning" | "error" | "default"> = {
    GET: "success",
    POST: "primary",
    PUT: "warning",
    PATCH: "warning",
    DELETE: "error",
};

export const GROUP_LABELS: Record<string, string> = {
    All: "همه بخش‌ها",
    Core: "وضعیت اتصال",
    Authentication: "احراز هویت",
    "Product Creation": "ایجاد کالا",
    Products: "کالاها",
    Variants: "تنوع‌ها",
    "Variant Creation": "ایجاد تنوع",
    Orders: "سفارش‌ها",
    Inventory: "انبار",
    Packages: "محموله‌ها",
    "DK Shipments": "ارسال دیجی‌کالا",
    Profile: "پروفایل فروشنده",
    Questions: "پرسش مشتریان",
    Insight: "گزارش‌ها",
    "Lightening Deal": "فروش ویژه",
    Pricing: "قیمت‌گذاری",
    "Smart Discount": "تخفیف هوشمند",
    Promotions: "کمپین‌ها",
    PLP: "کمپین PLP",
    Vouchers: "کد تخفیف",
    Batch: "عملیات گروهی",
    "SBS Settings": "تنظیمات ارسال",
    "SBS Orders": "سفارش‌های ارسال فروشنده",
    Webhook: "وبهوک",
    Financial: "مالی",
    "Shipping Services": "سرویس‌های ارسال",
};

export const WORKFLOWS = [
    {
        key: "variant" as WorkflowKey,
        label: "تنوع و موجودی",
        icon: "📦",
        helper: "ایجاد تنوع، قیمت، موجودی، فعال‌سازی و عملیات گروهی",
        groups: ["Variants", "Variant Creation", "Batch", "Inventory"],
    },
    {
        key: "orders" as WorkflowKey,
        label: "سفارش‌ها",
        icon: "🛒",
        helper: "مشاهده، لغو آیتم سفارش و آمار سفارش‌های دیجی‌کالا",
        groups: ["Orders"],
    },
    {
        key: "product" as WorkflowKey,
        label: "کالا",
        icon: "🏷️",
        helper: "ساخت کالا، اعتبارسنجی، عکس و ویرایش اطلاعات کالا",
        groups: ["Product Creation", "Products"],
    },
    {
        key: "pricing" as WorkflowKey,
        label: "قیمت و تخفیف",
        icon: "💰",
        helper: "کمپین، تخفیف هوشمند، فروش ویژه، PLP و کد تخفیف",
        groups: ["Pricing", "Smart Discount", "Promotions", "PLP", "Vouchers", "Lightening Deal"],
    },
    {
        key: "shipping" as WorkflowKey,
        label: "ارسال",
        icon: "🚚",
        helper: "مرسوله‌ها، کد رهگیری، تنظیمات ارسال و برچسب‌ها",
        groups: ["Packages", "DK Shipments", "SBS Settings", "SBS Orders", "Shipping Services"],
    },
    {
        key: "qa" as WorkflowKey,
        label: "پرسش و پاسخ",
        icon: "💬",
        helper: "دیدن پرسش‌های مشتری و ثبت پاسخ",
        groups: ["Questions"],
    },
    {
        key: "profile" as WorkflowKey,
        label: "فروشنده",
        icon: "👤",
        helper: "پروفایل، مالی، گزارش‌ها، دسترسی‌ها و وبهوک",
        groups: ["Profile", "Financial", "Insight", "Webhook", "Authentication", "Core"],
    },
] as const;

export const WORKFLOW_STEPS: Record<WorkflowKey, string[]> = {
    variant: ["پیدا کردن شناسه تنوع", "بررسی موجودی/قیمت فعلی", "ثبت تغییر", "تأیید نتیجه"],
    orders: ["مشاهده سفارش‌ها", "برداشتن شناسه آیتم", "لغو یا بررسی وضعیت", "ثبت در پنل"],
    product: ["جستجو یا انتخاب دسته", "گرفتن ویژگی‌های لازم", "اعتبارسنجی و آپلود عکس", "ذخیره کالا"],
    qa: ["مشاهده پرسش‌ها", "انتخاب پرسش", "نوشتن پاسخ", "ثبت پاسخ"],
    pricing: ["انتخاب نوع تخفیف", "بررسی تنوع‌های مجاز", "ثبت قیمت/محدودیت", "تأیید نتیجه"],
    shipping: ["مشاهده مرسوله‌ها", "ثبت کد رهگیری", "دریافت برچسب", "به‌روزرسانی وضعیت"],
    profile: ["بررسی پروفایل", "تنظیم وبهوک", "مشاهده گزارش‌ها", "ذخیره تنظیمات"],
};

export const DEFAULT_PREFERENCES = {
    callbackUrl: "",
    defaultWarehouseId: "",
    defaultBoxSizeId: "",
    defaultCityIds: "",
    defaultTimeScopeIds: "",
    defaultCancellationReasonId: "",
    defaultLeadTime: "",
    questionAnswerTemplate: "",
};
