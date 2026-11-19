"use client";

import { dgkOpenApiCatalog } from "@/digikala/constants/open-api-catalog";
import { Alert, Box, Button, Chip, Divider, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type BodyField = {
    key: string;
    label: string;
    helper: string;
    type: "text" | "number" | "boolean" | "json" | "datetime";
    required?: boolean;
    defaultValue?: string;
};
type Preferences = {
    callbackUrl: string;
    defaultWarehouseId: string;
    defaultBoxSizeId: string;
    defaultCityIds: string;
    defaultTimeScopeIds: string;
    defaultCancellationReasonId: string;
    defaultLeadTime: string;
    questionAnswerTemplate: string;
};
type SpecField = {
    key: string;
    type?: string | null;
    description?: string;
    example?: unknown;
    required?: boolean;
};

const methods: Method[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const writeMethods = new Set<Method>(["POST", "PUT", "PATCH", "DELETE"]);
const methodLabels: Record<Method, string> = {
    GET: "دریافت اطلاعات",
    POST: "ثبت اطلاعات جدید",
    PUT: "ویرایش کامل",
    PATCH: "ویرایش جزئی",
    DELETE: "حذف",
};
const groupLabels: Record<string, string> = {
    All: "همه بخش‌ها",
    Core: "وضعیت اتصال",
    Authentication: "احراز هویت و دسترسی",
    "Product Creation": "ایجاد کالا",
    Products: "کالاها",
    Variants: "تنوع‌ها",
    "Variant Creation": "ایجاد تنوع",
    Orders: "سفارش‌ها",
    Inventory: "انبار و موجودی",
    Packages: "محموله‌ها",
    "DK Shipments": "ارسال با دیجی‌کالا",
    Profile: "پروفایل فروشنده",
    Questions: "پرسش مشتریان",
    Insight: "گزارش‌ها و تحلیل",
    "Lightening Deal": "فروش ویژه",
    Pricing: "قیمت‌گذاری",
    "Smart Discount": "تخفیف هوشمند",
    Promotions: "کمپین‌ها",
    PLP: "کمپین PLP",
    Vouchers: "کد تخفیف",
    Batch: "عملیات گروهی",
    "SBS Settings": "تنظیمات ارسال فروشنده",
    "SBS Orders": "سفارش‌های ارسال توسط فروشنده",
    Webhook: "وبهوک",
    Financial: "مالی",
    "Shipping Services": "سرویس‌های ارسال",
};

const workflows = [
    {
        key: "product",
        label: "کالا",
        helper: "ساخت کالا، اعتبارسنجی، عکس و ویرایش اطلاعات کالا",
        groups: ["Product Creation", "Products"],
    },
    {
        key: "variant",
        label: "تنوع و موجودی",
        helper: "ایجاد تنوع، قیمت، موجودی، فعال‌سازی و عملیات گروهی",
        groups: ["Variants", "Variant Creation", "Batch", "Inventory"],
    },
    {
        key: "orders",
        label: "سفارش‌ها",
        helper: "مشاهده، لغو آیتم سفارش و آمار سفارش‌های دیجی‌کالا",
        groups: ["Orders"],
    },
    {
        key: "qa",
        label: "سوالات و پاسخ‌ها",
        helper: "دیدن پرسش‌های مشتری و ثبت پاسخ",
        groups: ["Questions"],
    },
    {
        key: "pricing",
        label: "قیمت و تخفیف",
        helper: "کمپین، تخفیف هوشمند، فروش ویژه، PLP و کد تخفیف",
        groups: ["Pricing", "Smart Discount", "Promotions", "PLP", "Vouchers", "Lightening Deal"],
    },
    {
        key: "shipping",
        label: "ارسال",
        helper: "مرسوله‌ها، کد رهگیری، تنظیمات ارسال و برچسب‌ها",
        groups: ["Packages", "DK Shipments", "SBS Settings", "SBS Orders", "Shipping Services"],
    },
    {
        key: "profile",
        label: "فروشنده",
        helper: "پروفایل، مالی، گزارش‌ها، دسترسی‌ها و وبهوک",
        groups: ["Profile", "Financial", "Insight", "Webhook", "Authentication", "Core"],
    },
] as const;

type WorkflowKey = typeof workflows[number]["key"];

const workflowSteps: Record<WorkflowKey, string[]> = {
    product: ["جستجو یا انتخاب دسته کالا", "گرفتن ویژگی‌های لازم از دیجی‌کالا", "اعتبارسنجی اطلاعات کالا", "آپلود عکس یا لوگو", "ذخیره یا انتشار کالا"],
    variant: ["پیدا کردن شناسه تنوع", "بررسی موجودی/قیمت فعلی", "ثبت تغییر موجودی یا قیمت", "فعال یا غیرفعال‌سازی", "بررسی نتیجه در لیست تنوع‌ها"],
    orders: ["دیدن سفارش‌ها", "برداشتن شناسه آیتم سفارش", "لغو یا بررسی وضعیت", "ثبت پیگیری در پنل داخلی"],
    qa: ["دیدن پرسش‌های مشتری", "برداشتن شناسه پرسش", "نوشتن پاسخ", "ثبت پاسخ در دیجی‌کالا"],
    pricing: ["انتخاب کمپین یا نوع تخفیف", "بررسی تنوع‌های مجاز", "ثبت قیمت/محدودیت", "بررسی تایید یا رد شدن"],
    shipping: ["دیدن مرسوله‌ها", "ثبت تنظیمات ارسال یا کد رهگیری", "دریافت برچسب یا خروجی", "به‌روزرسانی وضعیت ارسال"],
    profile: ["بررسی دسترسی‌ها و پروفایل", "تنظیم وبهوک", "دیدن گزارش‌ها و مالی", "ذخیره پیش‌فرض‌های فروشنده"],
};

function actionVerb(method: Method) {
    if (method === "GET") return "نمایش";
    if (method === "DELETE") return "حذف";
    if (method === "PATCH" || method === "PUT") return "ویرایش";
    return "ثبت";
}

function persianActionTitle(title: string, path: string, method: Method) {
    const p = path.toLowerCase();
    if (p.includes("product-creation/search")) return "جستجوی کالاهای موجود در دیجی‌کالا";
    if (p.includes("categories/tree")) return "نمایش درخت دسته‌بندی‌ها";
    if (p.includes("attributes")) return "دریافت ویژگی‌های لازم دسته‌بندی";
    if (p.includes("product/detail/validation")) return "اعتبارسنجی اطلاعات کالا";
    if (p.includes("product-creation/save")) return "ذخیره کالای جدید";
    if (p.includes("product-edit") && method === "GET") return "نمایش اطلاعات ویرایش کالا";
    if (p.includes("product-edit") && method !== "GET") return "ویرایش اطلاعات کالا";
    if (p === "variants") return "لیست تنوع‌های فروشنده";
    if (p.includes("seller-stock")) return method === "GET" ? "نمایش موجودی تنوع" : "تغییر موجودی تنوع";
    if (p.includes("selling-price")) return "تغییر قیمت فروش تنوع";
    if (p.includes("activation")) return "فعال یا غیرفعال کردن تنوع";
    if (p.includes("questions/answer")) return "ثبت پاسخ به پرسش مشتری";
    if (p === "questions") return "لیست پرسش‌های مشتریان";
    if (p.includes("orders/history")) return "تاریخچه سفارش‌ها";
    if (p === "orders") return "سفارش‌های فعال دیجی‌کالا";
    if (p.includes("tracking-code")) return "ثبت کد رهگیری مرسوله";
    if (p.includes("update-status")) return "تغییر وضعیت مرسوله";
    if (p.includes("cancel")) return "لغو آیتم یا مرسوله";
    if (p.includes("webhook/subscription")) return "فعال‌سازی وبهوک";
    if (p.includes("webhook/event-types")) return "نمایش رویدادهای وبهوک";
    if (p.includes("pricing/promotions")) return "مدیریت کمپین‌های فروش";
    if (p.includes("smart-discount")) return "مدیریت تخفیف هوشمند";
    if (p.includes("pricing/vouchers")) return "مدیریت کدهای تخفیف";
    if (p.includes("profile")) return "اطلاعات فروشنده";
    if (p.includes("invoices")) return "گزارش‌های مالی و فاکتورها";
    if (p.includes("shipping-services/label")) return "دریافت برچسب ارسال";
    if (p.includes("shipping-services")) return "سرویس‌های ارسال";
    return title || `${actionVerb(method)} عملیات دیجی‌کالا`;
}

function splitPathAndQuery(value: string) {
    const clean = value.trim().replace(/^\/+/, "").replace(/^open-api\/v1\/?/, "");
    const [path, query = ""] = clean.split("?");
    return { path, query };
}

function extractPlaceholders(value: string) {
    return Array.from(value.matchAll(/\{([^}]+)\}/g)).map((match) => match[1]);
}

function fillPathParams(value: string, params: Record<string, string>) {
    return value.replace(/\{([^}]+)\}/g, (_, key: string) => params[key]?.trim() || `{${key}}`);
}

function stringifyTemplate(value: unknown) {
    return JSON.stringify(value, null, 2);
}

function needsFileUpload(path: string) {
    return /upload|excel|import|image/i.test(path);
}

function canReturnFile(path: string) {
    return /excel|export|label|sample|pdf/i.test(path);
}

function explainStatus(status: number) {
    if (status === 401) return "توکن دیجیکالا منقضی یا نامعتبر است. اعتبارسنجی فروشنده را بررسی کنید.";
    if (status === 403) return "این فروشنده یا برنامه دسترسی لازم به این عملیات را ندارد.";
    if (status === 404) return "شناسه یا مسیر در دیجیکالا پیدا نشد.";
    if (status === 429) return "محدودیت تعداد درخواست دیجیکالا فعال شده؛ کمی بعد دوباره تلاش کنید.";
    if (status >= 500) return "خطای سمت دیجیکالا رخ داده است.";
    return "درخواست دیجیکالا ناموفق بود.";
}

function persianPlaceholderLabel(key: string) {
    const labels: Record<string, string> = {
        variant_id: "شناسه تنوع در دیجی‌کالا",
        product_variant_id: "شناسه تنوع محصول",
        product_id: "شناسه کالا در دیجی‌کالا",
        category_id: "شناسه دسته‌بندی",
        client_code: "کد کلاینت/اپلیکیشن",
        draft_product_id: "شناسه پیش‌نویس کالا",
        question_id: "شناسه پرسش مشتری",
        promotion_id: "شناسه کمپین",
        promotion_variant_id: "شناسه تنوع داخل کمپین",
        voucher_id: "شناسه کد تخفیف",
        shipment_id: "شناسه مرسوله",
        warehouse_id: "شناسه انبار",
        package_id: "شناسه محموله",
        invoice_id: "شناسه فاکتور مالی",
        transaction_id: "شناسه تراکنش",
        order_id: "شناسه سفارش",
        order_item_id: "شناسه آیتم سفارش",
        id: "شناسه رکورد",
    };

    return labels[key] ?? key;
}

function inferRequiredBodyFields(method: Method, path: string) {
    if (method === "GET") return [];
    if (path === "variants/selling-price") return ["variant_id", "selling_price"];
    if (path.endsWith("/seller-stock")) return ["seller_stock"];
    if (path.endsWith("/activation")) return ["active"];
    if (path.includes("questions/answer")) return ["question_id", "answer"];
    if (path.includes("tracking-code")) return ["shipment_id", "tracking_code"];
    if (path.includes("update-status")) return ["shipment_id", "status"];
    if (path.includes("cancel")) return ["shipment_id یا order_item_id", "reason_id یا cancellation_reason_id"];
    if (path.includes("promotions") && path.includes("variants")) return ["promotion_id در مسیر", "variants"];
    if (path.includes("smart-discount")) return ["variants", "start_at", "end_at"];
    if (path.includes("webhook/subscription")) return ["event_types", "callback_url"];
    if (path.startsWith("batch/")) return ["items"];
    if (needsFileUpload(path)) return ["فایل", "فیلدهای تکمیلی طبق نمونه"];
    return ["فیلدهای لازم طبق مستندات دیجی‌کالا"];
}

function endpointGuide(method: Method, path: string, group: string, title: string) {
    const lowerPath = path.toLowerCase();
    let purpose = "اجرای یکی از APIهای Open API دیجی‌کالا برای همین فروشنده.";
    let tip = "قبل از ارسال، شناسه‌ها و اطلاعات فرم را با اطلاعات واقعی پنل دیجی‌کالا کامل کنید.";

    if (lowerPath.includes("variants") || group === "Variants") {
        purpose = "مدیریت تنوع‌های دیجی‌کالا؛ مثل مشاهده تنوع، تغییر قیمت، موجودی یا فعال/غیرفعال کردن.";
        tip = "شناسه تنوع همان شناسه تنوع در پنل دیجی‌کالا است، نه شناسه محصول داخل سایت.";
    } else if (lowerPath.includes("orders") || group === "Orders") {
        purpose = "مشاهده یا مدیریت سفارش‌های دیجی‌کالا برای همین فروشنده.";
        tip = "برای عملیات حذف/لغو، ابتدا شناسه آیتم سفارش را از لیست سفارش‌ها بردارید.";
    } else if (lowerPath.includes("inventory") || group === "Inventory") {
        purpose = "بررسی خروجی انبار، موجودی و گزارش‌های مرتبط با موجودی دیجی‌کالا.";
        tip = "برای تغییر موجودی روزمره بهتر است از بخش «مقایسه موجودی» استفاده شود؛ این بخش برای کنترل دقیق API است.";
    } else if (lowerPath.includes("pricing") || group.includes("Pricing") || group.includes("Promotion")) {
        purpose = "مدیریت قیمت، پیشنهاد قیمت، تخفیف‌ها و کمپین‌های فروش.";
        tip = "مبالغ را مطابق واحد مورد انتظار دیجی‌کالا وارد کنید و قبل از ارسال، تاریخ شروع/پایان را بررسی کنید.";
    } else if (lowerPath.includes("product-creation")) {
        purpose = "ایجاد کالا، اعتبارسنجی اطلاعات کالا، آپلود تصویر یا اتصال کالا به فروشنده.";
        tip = "برای ایجاد کالا معمولاً باید دسته‌بندی، ویژگی‌ها و تصاویر معتبر از مراحل قبلی همین API گرفته شود.";
    } else if (lowerPath.includes("webhook")) {
        purpose = "تنظیم وبهوک برای دریافت رویدادهای دیجی‌کالا مثل سفارش جدید.";
        tip = "آدرس دریافت وبهوک باید از اینترنت قابل دسترسی باشد. مسیر داخلی فعلی سایت برای دریافت وبهوک آماده شده است.";
    } else if (lowerPath.includes("profile")) {
        purpose = "مشاهده یا ویرایش اطلاعات پروفایل فروشنده در دیجی‌کالا.";
    } else if (lowerPath.includes("shipping") || lowerPath.includes("ship")) {
        purpose = "مدیریت تنظیمات ارسال، مرسوله‌ها، برچسب‌ها و کدهای رهگیری.";
        tip = "برای برچسب یا خروجی اکسل، گزینه دانلود مستقیم را فعال کنید.";
    }

    return {
        purpose,
        tip,
        risk: writeMethods.has(method)
            ? "این عملیات می‌تواند اطلاعات واقعی پنل دیجی‌کالا را تغییر دهد."
            : "این عملیات فقط اطلاعات را از دیجی‌کالا می‌خواند.",
        requiredPath: extractPlaceholders(path).map(persianPlaceholderLabel),
        requiredBody: inferRequiredBodyFields(method, path),
        titleFa: title,
    };
}

function validateJsonBody(value: string) {
    try {
        JSON.parse(value.trim() || "{}");
        return true;
    } catch {
        return false;
    }
}

function bodyFieldsFor(method: Method, path: string): BodyField[] {
    if (method === "GET") return [];

    if (path === "variants/selling-price") {
        return [
            {
                key: "variant_id",
                label: "شناسه تنوع دیجی‌کالا",
                helper: "از تب کالاها/تنوع‌های دیجی‌کالا بردارید؛ این شناسه با شناسه سایت فرق دارد.",
                type: "number",
                required: true,
            },
            {
                key: "selling_price",
                label: "قیمت فروش",
                helper: "قیمت نهایی مورد انتظار دیجی‌کالا را وارد کنید.",
                type: "number",
                required: true,
            },
            {
                key: "credit_increase_percentage",
                label: "درصد افزایش اعتباری",
                helper: "اختیاری است. اگر مطمئن نیستید خالی بگذارید.",
                type: "number",
                defaultValue: "",
            },
        ];
    }

    if (path.endsWith("/seller-stock") || path.startsWith("batch/variant/seller-stock")) {
        return path.startsWith("batch/")
            ? [
                {
                    key: "items",
                    label: "لیست تنوع‌ها و موجودی",
                    helper: "نمونه: [{\"variant_id\":12345,\"seller_stock\":10}]",
                    type: "json",
                    required: true,
                    defaultValue: '[{"variant_id":12345,"seller_stock":10}]',
                },
            ]
            : [
                {
                    key: "seller_stock",
                    label: "موجودی فروشنده",
                    helper: "تعداد موجودی قابل فروش در پنل دیجی‌کالا.",
                    type: "number",
                    required: true,
                },
            ];
    }

    if (path.endsWith("/activation") || path.startsWith("batch/variant/activation")) {
        return path.startsWith("batch/")
            ? [
                {
                    key: "items",
                    label: "لیست فعال/غیرفعال‌سازی",
                    helper: "نمونه: [{\"variant_id\":12345,\"active\":true}]",
                    type: "json",
                    required: true,
                    defaultValue: '[{"variant_id":12345,"active":true}]',
                },
            ]
            : [
                {
                    key: "active",
                    label: "فعال باشد؟",
                    helper: "true یعنی فعال، false یعنی غیرفعال.",
                    type: "boolean",
                    required: true,
                    defaultValue: "true",
                },
            ];
    }

    if (path === "questions/answer") {
        return [
            { key: "question_id", label: "شناسه پرسش", helper: "از لیست پرسش‌های مشتری بردارید.", type: "number", required: true },
            { key: "answer", label: "متن پاسخ", helper: "پاسخی که برای مشتری در دیجی‌کالا ثبت می‌شود.", type: "text", required: true },
        ];
    }

    if (path === "ship-by-seller-orders/tracking-code") {
        return [
            { key: "shipment_id", label: "شناسه مرسوله", helper: "از سفارش‌های ارسال توسط فروشنده بردارید.", type: "number", required: true },
            { key: "tracking_code", label: "کد رهگیری", helper: "کد رهگیری پستی/ارسال.", type: "text", required: true },
        ];
    }

    if (path === "ship-by-seller-orders/update-status") {
        return [
            { key: "shipment_id", label: "شناسه مرسوله", helper: "از سفارش‌های فعال/ارسال فروشنده بردارید.", type: "number", required: true },
            { key: "status", label: "وضعیت جدید", helper: "مثال: ready_to_ship. مقدار دقیق باید طبق وضعیت‌های مجاز دیجی‌کالا باشد.", type: "text", required: true },
        ];
    }

    if (path.includes("cancel-item") || path.includes("cancel-shipment")) {
        return [
            { key: "shipment_id", label: "شناسه مرسوله", helper: "برای لغو ارسال توسط فروشنده.", type: "number", required: true },
            { key: "reason_id", label: "شناسه دلیل لغو", helper: "باید از دلایل مجاز دیجی‌کالا باشد.", type: "number", required: true },
        ];
    }

    if (path.includes("pricing/promotions") && path.includes("variants")) {
        return [
            {
                key: "variants",
                label: "تنوع‌های کمپین",
                helper: "نمونه: [{\"variant_id\":12345,\"discount_percent\":10,\"promo_price\":2200000,\"order_limit\":5}]",
                type: "json",
                required: true,
                defaultValue: '[{"variant_id":12345,"discount_percent":10,"promo_price":2200000,"order_limit":5}]',
            },
        ];
    }

    if (path.includes("smart-discount")) {
        return [
            {
                key: "variants",
                label: "تنوع‌های تخفیف هوشمند",
                helper: "نمونه: [{\"variant_id\":12345,\"start_at\":\"2026-06-06 00:00:00\",\"end_at\":\"2026-06-10 23:59:59\",\"selling_price\":2200000}]",
                type: "json",
                required: true,
                defaultValue: '[{"variant_id":12345,"start_at":"2026-06-06 00:00:00","end_at":"2026-06-10 23:59:59","selling_price":2200000}]',
            },
        ];
    }

    if (path === "webhook/subscription" || path === "webhook/unsubscription") {
        return [
            {
                key: "event_types",
                label: "نوع رویدادها",
                helper: "نمونه: [\"order.created\"]. از API نوع رویدادها می‌توانید لیست مجاز را ببینید.",
                type: "json",
                required: true,
                defaultValue: '["order.created"]',
            },
            {
                key: "callback_url",
                label: "آدرس دریافت وبهوک",
                helper: "اگر آدرس اصلی سایت تنظیم باشد، دامنه سایت + /api/digikala/webhook را وارد کنید.",
                type: "text",
                required: true,
                defaultValue: "/api/digikala/webhook",
            },
        ];
    }

    if (path.startsWith("batch/variant/update")) {
        return [
            {
                key: "items",
                label: "لیست تغییرات تنوع",
                helper: "نمونه: [{\"variant_id\":12345,\"lead_time\":1}]",
                type: "json",
                required: true,
                defaultValue: '[{"variant_id":12345,"lead_time":1}]',
            },
        ];
    }

    return [];
}

function fieldsFromSpec(fields: SpecField[]): BodyField[] {
    return fields.map((field) => ({
        key: field.key,
        label: persianPlaceholderLabel(field.key),
        helper: field.description || "این فیلد از مستندات رسمی دیجی‌کالا خوانده شده است.",
        type: field.type === "integer" || field.type === "number" ? "number" : field.type === "boolean" ? "boolean" : field.type === "array" || field.type === "object" ? "json" : "text",
        required: field.required,
        defaultValue: field.example === undefined || field.example === null
            ? ""
            : typeof field.example === "object"
                ? JSON.stringify(field.example)
                : String(field.example),
    }));
}

function defaultFieldValues(fields: BodyField[]) {
    return fields.reduce<Record<string, string>>((acc, field) => {
        acc[field.key] = field.defaultValue ?? "";
        return acc;
    }, {});
}

function applyPreferenceDefaults(fields: BodyField[], preferences: Preferences) {
    const values = defaultFieldValues(fields);

    fields.forEach((field) => {
        if (field.key === "callback_url" && preferences.callbackUrl) values[field.key] = preferences.callbackUrl;
        if (field.key === "warehouse_id" && preferences.defaultWarehouseId) values[field.key] = preferences.defaultWarehouseId;
        if (field.key === "box_size_id" && preferences.defaultBoxSizeId) values[field.key] = preferences.defaultBoxSizeId;
        if (field.key === "reason_id" && preferences.defaultCancellationReasonId) values[field.key] = preferences.defaultCancellationReasonId;
        if (field.key === "lead_time" && preferences.defaultLeadTime) values[field.key] = preferences.defaultLeadTime;
        if (field.key === "answer" && preferences.questionAnswerTemplate) values[field.key] = preferences.questionAnswerTemplate;
        if (field.key === "city_ids" && preferences.defaultCityIds) values[field.key] = `[${preferences.defaultCityIds}]`;
        if (field.key === "time_scope_ids" && preferences.defaultTimeScopeIds) values[field.key] = `[${preferences.defaultTimeScopeIds}]`;
    });

    return values;
}

function buildBodyFromFields(fields: BodyField[], values: Record<string, string>) {
    const payload: Record<string, unknown> = {};

    fields.forEach((field) => {
        const raw = values[field.key]?.trim() ?? "";
        if (!raw && !field.required) return;

        if (field.type === "number") {
            payload[field.key] = Number(raw || 0);
            return;
        }
        if (field.type === "boolean") {
            payload[field.key] = raw === "true";
            return;
        }
        if (field.type === "json") {
            payload[field.key] = JSON.parse(raw || "null");
            return;
        }
        payload[field.key] = raw;
    });

    return payload;
}

function templateFor(method: Method, path: string) {
    if (method === "GET") return "{}";

    if (path === "variants/selling-price") {
        return stringifyTemplate({
            variant_id: 12345,
            selling_price: 2500000,
            credit_increase_percentage: 25,
        });
    }

    if (path.endsWith("/seller-stock")) {
        return stringifyTemplate({ seller_stock: 10 });
    }

    if (path.endsWith("/activation")) {
        return stringifyTemplate({ active: true });
    }

    if (path === "variants/b2b-activation") {
        return stringifyTemplate({ variant_ids: [12345], active: true });
    }

    if (path.includes("orders/")) {
        return stringifyTemplate({ cancellation_reason_id: -1, count: 1 });
    }

    if (path === "questions/answer") {
        return stringifyTemplate({ question_id: 123, answer: "متن پاسخ" });
    }

    if (path.includes("pricing/promotions") && path.endsWith("/variants")) {
        return stringifyTemplate({
            variants: [
                {
                    variant_id: 12345,
                    discount_percent: 10,
                    promo_price: 2200000,
                    order_limit: 5,
                },
            ],
        });
    }

    if (path === "pricing/smart-discount/variants" || path === "pricing/smart-discount/variants/batch") {
        return stringifyTemplate({
            variants: [
                {
                    variant_id: 12345,
                    start_at: "2026-06-06 00:00:00",
                    end_at: "2026-06-10 23:59:59",
                    selling_price: 2200000,
                },
            ],
        });
    }

    if (path === "pricing/plp") {
        return stringifyTemplate({
            title: "PLP Campaign",
            start_at: "2026-06-06 00:00:00",
            end_at: "2026-06-10 23:59:59",
            variants: [{ variant_id: 12345, selling_price: 2200000 }],
        });
    }

    if (path === "pricing/vouchers") {
        return stringifyTemplate({
            title: "Voucher",
            start_at: "2026-06-06 00:00:00",
            end_at: "2026-06-10 23:59:59",
            discount_percent: 10,
            usage_limit: 100,
        });
    }

    if (path === "ship-by-seller-orders/tracking-code") {
        return stringifyTemplate({ shipment_id: 12345, tracking_code: "TRACKING_CODE" });
    }

    if (path === "ship-by-seller-orders/update-status") {
        return stringifyTemplate({ shipment_id: 12345, status: "ready_to_ship" });
    }

    if (path === "ship-by-seller-orders/cancel-item" || path === "ship-by-seller-orders/cancel-shipment") {
        return stringifyTemplate({ shipment_id: 12345, reason_id: 1 });
    }

    if (path === "ship-by-seller-orders/change-time-scope") {
        return stringifyTemplate({ shipment_id: 12345, time_scope_id: 1 });
    }

    if (path === "shipments/seller/new-settings" || path.includes("shipments/seller/new-settings")) {
        return stringifyTemplate({
            title: "SBS setting",
            city_ids: [1],
            time_scope_ids: [1],
            is_active: true,
        });
    }

    if (path.includes("shipping-services/parcels")) {
        return stringifyTemplate({
            parcels: [
                {
                    shipment_id: 12345,
                    box_size_id: 1,
                    weight: 1000,
                },
            ],
        });
    }

    if (path.includes("bulk-shipping-services")) {
        return stringifyTemplate({
            shipment_ids: [12345],
            box_size_id: 1,
        });
    }

    if (path === "webhook/subscription" || path === "webhook/unsubscription") {
        return stringifyTemplate({ event_types: ["order.created"], callback_url: "/api/digikala/webhook" });
    }

    if (path === "webhook/subscription/change-activation") {
        return stringifyTemplate({ event_type: "order.created", active: true });
    }

    if (path.startsWith("batch/variant/seller-stock")) {
        return stringifyTemplate({ items: [{ variant_id: 12345, seller_stock: 10 }] });
    }

    if (path.startsWith("batch/variant/activation")) {
        return stringifyTemplate({ items: [{ variant_id: 12345, active: true }] });
    }

    if (path.startsWith("batch/variant/update")) {
        return stringifyTemplate({ items: [{ variant_id: 12345, lead_time: 1 }] });
    }

    if (path.includes("{")) {
        return stringifyTemplate({
            _note: "Replace placeholders like {variant_id}, {shipment_id}, {promotion_id} in the path before sending.",
        });
    }

    return stringifyTemplate({});
}

export default function DigikalaOpenApiExplorer({ vendorId }: { vendorId: string }) {
    const [method, setMethod] = useState<Method>("GET");
    const [path, setPath] = useState("variants?page=1&size=50");
    const [body, setBody] = useState("{}");
    const [bodyFieldValues, setBodyFieldValues] = useState<Record<string, string>>({});
    const [activeWorkflow, setActiveWorkflow] = useState<WorkflowKey>("variant");
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedEndpointKey, setSelectedEndpointKey] = useState("");
    const [pathParams, setPathParams] = useState<Record<string, string>>({});
    const [fileFieldName, setFileFieldName] = useState("file");
    const [file, setFile] = useState<File | null>(null);
    const [rawDownload, setRawDownload] = useState(false);
    const [loading, setLoading] = useState(false);
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [specFields, setSpecFields] = useState<SpecField[]>([]);
    const [preferences, setPreferences] = useState<Preferences>({
        callbackUrl: "",
        defaultWarehouseId: "",
        defaultBoxSizeId: "",
        defaultCityIds: "",
        defaultTimeScopeIds: "",
        defaultCancellationReasonId: "",
        defaultLeadTime: "",
        questionAnswerTemplate: "",
    });
    const [savingPreferences, setSavingPreferences] = useState(false);
    const [response, setResponse] = useState("");

    const resolvedPath = useMemo(() => fillPathParams(path, pathParams), [path, pathParams]);
    const placeholders = useMemo(() => extractPlaceholders(path), [path]);
    const fileUpload = useMemo(() => needsFileUpload(path), [path]);
    const downloadable = useMemo(() => canReturnFile(path), [path]);
    const hasMissingPathParam = useMemo(
        () => placeholders.some((item) => !pathParams[item]?.trim()),
        [pathParams, placeholders],
    );

    const url = useMemo(() => {
        const { path: cleanPath, query } = splitPathAndQuery(resolvedPath);
        const params = new URLSearchParams(query);
        params.set("vendorId", vendorId);
        if (rawDownload) params.set("raw", "1");
        return `/api/digikala/open-api/${cleanPath}?${params.toString()}`;
    }, [rawDownload, resolvedPath, vendorId]);

    const filteredCatalog = useMemo(() => {
        const cleanQuery = query.trim().toLowerCase();
        const workflow = workflows.find((item) => item.key === activeWorkflow) ?? workflows[0];

        return dgkOpenApiCatalog.filter((item) => {
            const groupMatch = (workflow.groups as readonly string[]).includes(item.group);
            const queryMatch = !cleanQuery
                || item.title.toLowerCase().includes(cleanQuery)
                || (groupLabels[item.group] ?? "").includes(query.trim())
                || item.path.toLowerCase().includes(cleanQuery)
                || item.method.toLowerCase().includes(cleanQuery);

            return groupMatch && queryMatch;
        });
    }, [activeWorkflow, query]);

    const selectedEndpoint = useMemo(() => {
        if (selectedEndpointKey === "") return null;
        return filteredCatalog[Number(selectedEndpointKey)] ?? null;
    }, [filteredCatalog, selectedEndpointKey]);
    const guide = useMemo(
        () => endpointGuide(method, path, selectedEndpoint?.group ?? "", selectedEndpoint?.title ?? "عملیات انتخاب‌شده"),
        [method, path, selectedEndpoint?.group, selectedEndpoint?.title],
    );
    const customBodyFields = useMemo(() => bodyFieldsFor(method, path), [method, path]);
    const bodyFields = useMemo(
        () => customBodyFields.length ? customBodyFields : fieldsFromSpec(specFields),
        [customBodyFields, specFields],
    );

    const selectedValue = filteredCatalog[Number(selectedEndpointKey)] ? selectedEndpointKey : "";

    useEffect(() => {
        let ignore = false;
        fetch(`/api/digikala/open-api/preferences?vendorId=${encodeURIComponent(vendorId)}`)
            .then((res) => res.json())
            .then((payload) => {
                if (ignore) return;
                setPreferences((current) => ({ ...current, ...(payload?.data ?? {}) }));
            })
            .catch(() => undefined);

        return () => {
            ignore = true;
        };
    }, [vendorId]);

    useEffect(() => {
        if (!selectedEndpoint || method === "GET") {
            setSpecFields([]);
            return;
        }

        let ignore = false;
        const params = new URLSearchParams({ method, path });
        fetch(`/api/digikala/open-api/spec?${params.toString()}`)
            .then((res) => res.json())
            .then((payload) => {
                if (ignore) return;
                setSpecFields(Array.isArray(payload?.data?.body?.properties) ? payload.data.body.properties : []);
            })
            .catch(() => {
                if (!ignore) setSpecFields([]);
            });

        return () => {
            ignore = true;
        };
    }, [method, path, selectedEndpoint]);

    useEffect(() => {
        if (!selectedEndpoint || method === "GET" || customBodyFields.length > 0 || specFields.length === 0) return;
        setBodyFieldValues((current) => ({
            ...applyPreferenceDefaults(fieldsFromSpec(specFields), preferences),
            ...current,
        }));
    }, [customBodyFields.length, method, preferences, selectedEndpoint, specFields]);

    function applyEndpoint(index: string) {
        const endpoint = filteredCatalog[Number(index)];
        if (!endpoint) return;

        setSelectedEndpointKey(index);
        setMethod(endpoint.method);
        setPath(endpoint.path);
        setBody(templateFor(endpoint.method, endpoint.path));
        setBodyFieldValues(applyPreferenceDefaults(bodyFieldsFor(endpoint.method, endpoint.path), preferences));
        setPathParams({});
        setFile(null);
        setRawDownload(canReturnFile(endpoint.path));
        setResponse("");
    }

    async function handleSavePreferences() {
        setSavingPreferences(true);
        try {
            const res = await fetch("/api/digikala/open-api/preferences", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vendorId, ...preferences }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload?.error || "save_preferences_failed");
            toast.success("تنظیمات این پنل دیجی‌کالا ذخیره شد.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "ذخیره تنظیمات ناموفق بود.");
        } finally {
            setSavingPreferences(false);
        }
    }

    function resetToWorkflow(nextWorkflow: WorkflowKey) {
        setActiveWorkflow(nextWorkflow);
        setSelectedEndpointKey("");
        setPathParams({});
        setBody("{}");
        setBodyFieldValues({});
        setResponse("");
        setFile(null);
    }

    function handleBuildBodyFromForm() {
        try {
            const missing = bodyFields.filter((field) => field.required && !bodyFieldValues[field.key]?.trim());
            if (missing.length) {
                toast.error(`این فیلدها لازم هستند: ${missing.map((item) => item.label).join("، ")}`);
                return;
            }
            setBody(stringifyTemplate(buildBodyFromFields(bodyFields, bodyFieldValues)));
            toast.success("اطلاعات درخواست از روی فرم ساخته شد");
        } catch {
            toast.error("یکی از فیلدهای چندمقداری فرم معتبر نیست.");
        }
    }

    async function handleAiFill() {
        if (!selectedEndpoint) {
            toast.error("اول یک عملیات انتخاب کنید.");
            return;
        }
        if (!aiPrompt.trim()) {
            toast.error("در کادر هوش مصنوعی بگویید چه کاری می‌خواهید انجام شود.");
            return;
        }

        setAiLoading(true);
        try {
            const res = await fetch("/api/digikala/open-api/assist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    method,
                    path,
                    title: selectedEndpoint.title,
                    adminText: aiPrompt,
                    currentPathParams: pathParams,
                    currentBodyFields: bodyFieldValues,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload?.error || "ai_fill_failed");

            const data = payload?.data ?? {};
            if (data.pathParams && typeof data.pathParams === "object") {
                setPathParams((current) => ({ ...current, ...data.pathParams }));
            }
            if (data.bodyFieldValues && typeof data.bodyFieldValues === "object") {
                setBodyFieldValues((current) => ({ ...current, ...data.bodyFieldValues }));
            }
            if (Array.isArray(data.warningsFa) && data.warningsFa.length) {
                toast.warning(data.warningsFa.join(" | "));
            } else {
                toast.success(data.explanationFa || "فیلدها با هوش مصنوعی پر شدند.");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "پر کردن با هوش مصنوعی ناموفق بود.");
        } finally {
            setAiLoading(false);
        }
    }

    async function handleSend() {
        const unresolved = extractPlaceholders(resolvedPath);
        if (unresolved.length) {
            toast.error(`شناسه‌های مسیر کامل نیست: ${unresolved.join(", ")}`);
            return;
        }

        let nextBody = body;
        if (method !== "GET" && bodyFields.length > 0) {
            const missing = bodyFields.filter((field) => field.required && !bodyFieldValues[field.key]?.trim());
            if (missing.length) {
                toast.error(`این فیلدها لازم هستند: ${missing.map((item) => item.label).join("، ")}`);
                return;
            }
            try {
                nextBody = stringifyTemplate(buildBodyFromFields(bodyFields, bodyFieldValues));
                setBody(nextBody);
            } catch {
                toast.error("یکی از فیلدهای فرم معتبر نیست.");
                return;
            }
        }

        if (method !== "GET" && !fileUpload && !validateJsonBody(nextBody)) {
            toast.error("اطلاعات درخواست معتبر نیست. فرم را کامل کنید یا حالت پیشرفته را بررسی کنید.");
            return;
        }

        if (method !== "GET" && fileUpload && !file) {
            toast.error("برای این عملیات باید فایل انتخاب شود.");
            return;
        }

        if (writeMethods.has(method)) {
            const confirmed = window.confirm("این عملیات می‌تواند اطلاعات دیجیکالا را تغییر دهد. ادامه می‌دهید؟");
            if (!confirmed) return;
        }

        setLoading(true);
        setResponse("");

        try {
            const init: RequestInit = { method };
            if (method !== "GET" && fileUpload && file) {
                const form = new FormData();
                form.append(fileFieldName.trim() || "file", file);

                try {
                    const extra = JSON.parse(nextBody.trim() || "{}") as Record<string, unknown>;
                    Object.entries(extra).forEach(([key, value]) => {
                        if (value === undefined || value === null) return;
                        form.append(key, typeof value === "string" ? value : JSON.stringify(value));
                    });
                } catch {
                    toast.error("اطلاعات درخواست معتبر نیست");
                    return;
                }

                init.body = form;
            } else if (method !== "GET") {
                init.headers = { "Content-Type": "application/json" };
                init.body = nextBody.trim() || "{}";
            }

            const res = await fetch(url, init);
            if (rawDownload && res.ok) {
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = objectUrl;
                a.download = "digikala-export";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(objectUrl);
                setResponse(JSON.stringify({ ok: true, status: res.status, downloaded: true }, null, 2));
                toast.success("فایل دریافت شد");
                return;
            }

            const payload = await res.json().catch(() => null);
            setResponse(JSON.stringify(payload, null, 2));

            if (!res.ok) {
                toast.error(explainStatus(res.status));
            } else {
                toast.success("پاسخ دیجیکالا دریافت شد");
            }
        } catch (error) {
            setResponse(JSON.stringify({ error: error instanceof Error ? error.message : error }, null, 2));
            toast.error("خطا در ارسال درخواست");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Stack spacing={2.5} sx={{ mt: 3 }}>
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
                <Stack spacing={1.5}>
                    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1.5}>
                        <Box>
                            <Typography variant="h6" fontWeight={950}>
                                ابزارهای آماده دیجی‌کالا
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                اول نوع کار را انتخاب کنید، بعد عملیات را بزنید و فرم فارسی را کامل کنید. درخواست به صورت خودکار ساخته می‌شود.
                            </Typography>
                        </Box>
                        <TextField
                            label="جستجو در همین بخش"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            sx={{ minWidth: { xs: "100%", md: 260 } }}
                        />
                    </Stack>
                    <Tabs
                        value={activeWorkflow}
                        onChange={(_, value) => resetToWorkflow(value)}
                        variant="scrollable"
                        scrollButtons="auto"
                    >
                        {workflows.map((item) => (
                            <Tab key={item.key} value={item.key} label={item.label} />
                        ))}
                    </Tabs>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={`فروشنده: ${vendorId}`} color="primary" variant="outlined" />
                        <Chip size="small" label={`${filteredCatalog.length} عملیات در این بخش`} />
                        <Chip
                            size="small"
                            label={showAdvanced ? "حالت پیشرفته روشن" : "حالت ساده"}
                            color={showAdvanced ? "warning" : "default"}
                            onClick={() => setShowAdvanced((value) => !value)}
                        />
                        {downloadable && (
                            <Chip
                                size="small"
                                color={rawDownload ? "success" : "default"}
                                label={rawDownload ? "دانلود مستقیم فعال" : "نمایش نتیجه در صفحه"}
                                onClick={() => setRawDownload((value) => !value)}
                            />
                        )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        {workflows.find((item) => item.key === activeWorkflow)?.helper}
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {workflowSteps[activeWorkflow].map((step, index) => (
                            <Chip key={step} size="small" label={`${index + 1}. ${step}`} variant="outlined" />
                        ))}
                    </Stack>
                </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
                <Stack spacing={1.5}>
                    <Typography variant="subtitle2" fontWeight={950}>
                        تنظیمات ذخیره‌شده این پنل
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        این مقدارها در دیتابیس برای همین فروشنده ذخیره می‌شوند و هنگام اجرای عملیات‌ها به‌صورت خودکار در فرم‌ها قرار می‌گیرند.
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 1 }}>
                        <TextField label="آدرس وبهوک" value={preferences.callbackUrl} onChange={(event) => setPreferences((current) => ({ ...current, callbackUrl: event.target.value }))} />
                        <TextField label="شناسه انبار پیش‌فرض" value={preferences.defaultWarehouseId} onChange={(event) => setPreferences((current) => ({ ...current, defaultWarehouseId: event.target.value }))} />
                        <TextField label="شناسه جعبه پیش‌فرض" value={preferences.defaultBoxSizeId} onChange={(event) => setPreferences((current) => ({ ...current, defaultBoxSizeId: event.target.value }))} />
                        <TextField label="دلیل لغو پیش‌فرض" value={preferences.defaultCancellationReasonId} onChange={(event) => setPreferences((current) => ({ ...current, defaultCancellationReasonId: event.target.value }))} />
                        <TextField label="شناسه شهرها، با ویرگول" value={preferences.defaultCityIds} onChange={(event) => setPreferences((current) => ({ ...current, defaultCityIds: event.target.value }))} />
                        <TextField label="شناسه بازه‌های زمانی، با ویرگول" value={preferences.defaultTimeScopeIds} onChange={(event) => setPreferences((current) => ({ ...current, defaultTimeScopeIds: event.target.value }))} />
                        <TextField label="زمان آماده‌سازی پیش‌فرض" value={preferences.defaultLeadTime} onChange={(event) => setPreferences((current) => ({ ...current, defaultLeadTime: event.target.value }))} />
                        <TextField label="متن آماده پاسخ سوالات" value={preferences.questionAnswerTemplate} onChange={(event) => setPreferences((current) => ({ ...current, questionAnswerTemplate: event.target.value }))} />
                    </Box>
                    <Button variant="outlined" onClick={handleSavePreferences} disabled={savingPreferences} sx={{ alignSelf: "flex-start" }}>
                        {savingPreferences ? "در حال ذخیره..." : "ذخیره تنظیمات"}
                    </Button>
                </Stack>
            </Paper>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(380px, 0.9fr)" },
                    gap: 2,
                    alignItems: "start",
                }}
            >
                <Stack spacing={1.5}>
                    <Typography variant="subtitle2" fontWeight={900}>
                        عملیات این بخش
                    </Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                            gap: 1,
                        }}
                    >
                        {filteredCatalog.map((item, index) => {
                            const selected = selectedValue === String(index);
                            return (
                                <Paper
                                    key={`${item.method}:${item.path}:${index}`}
                                    elevation={0}
                                    sx={{
                                        p: 1.5,
                                        border: 1,
                                        borderColor: selected ? "primary.main" : "divider",
                                        borderRadius: 2,
                                        bgcolor: selected ? "action.selected" : "background.paper",
                                    }}
                                >
                                    <Stack spacing={1}>
                                        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                            <Chip size="small" label={actionVerb(item.method)} color={writeMethods.has(item.method) ? "primary" : "default"} />
                                            <Chip size="small" label={groupLabels[item.group] ?? item.group} variant="outlined" />
                                        </Stack>
                                        <Typography variant="body2" fontWeight={900}>
                                            {persianActionTitle(item.title, item.path, item.method)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {endpointGuide(item.method, item.path, item.group, item.title).purpose}
                                        </Typography>
                                        <Button size="small" variant={selected ? "contained" : "outlined"} onClick={() => applyEndpoint(String(index))}>
                                            {selected ? "انتخاب شده" : "انتخاب عملیات"}
                                        </Button>
                                    </Stack>
                                </Paper>
                            );
                        })}
                    </Box>
                </Stack>

                <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
                    <Stack spacing={2}>
                        <Box>
                            <Typography variant="subtitle1" fontWeight={950}>
                                {selectedEndpoint ? persianActionTitle(selectedEndpoint.title, selectedEndpoint.path, selectedEndpoint.method) : "یک عملیات انتخاب کنید"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                {selectedEndpoint ? guide.purpose : "از کارت‌های سمت راست/بالا یک کار را انتخاب کنید تا فرم مخصوص همان کار نمایش داده شود."}
                            </Typography>
                        </Box>

                        {selectedEndpoint ? (
                            <>
                                <Alert severity={writeMethods.has(method) ? "warning" : "info"} sx={{ borderRadius: 2 }}>
                                    {guide.risk} {guide.tip}
                                </Alert>

                                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                    <Chip size="small" label={methodLabels[method]} color={writeMethods.has(method) ? "primary" : "default"} />
                                    <Chip size="small" label={groupLabels[selectedEndpoint.group] ?? selectedEndpoint.group} variant="outlined" />
                                    {fileUpload && <Chip size="small" label="نیازمند فایل" color="secondary" />}
                                </Stack>

                                {placeholders.length > 0 && (
                                    <Stack spacing={1}>
                                        <Typography variant="subtitle2" fontWeight={900}>
                                            شناسه‌های لازم
                                        </Typography>
                                        {placeholders.map((item) => (
                                            <TextField
                                                key={item}
                                                label={persianPlaceholderLabel(item)}
                                                helperText={`این مقدار معمولاً از پنل دیجی‌کالا یا نتیجه لیست همین بخش برداشته می‌شود. نام فنی: ${item}`}
                                                value={pathParams[item] ?? ""}
                                                onChange={(event) =>
                                                    setPathParams((current) => ({
                                                        ...current,
                                                        [item]: event.target.value,
                                                    }))
                                                }
                                                fullWidth
                                                dir="ltr"
                                            />
                                        ))}
                                    </Stack>
                                )}

                                {(placeholders.length > 0 || method !== "GET") && (
                                    <Paper elevation={0} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "action.hover" }}>
                                        <Stack spacing={1}>
                                            <Typography variant="subtitle2" fontWeight={900}>
                                                پر کردن با هوش مصنوعی
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                توضیح ساده بنویسید؛ هوش مصنوعی با استفاده از قوانین رسمی دیجی‌کالا فیلدها را پر می‌کند. شناسه‌هایی که ندارید را حدس نمی‌زند.
                                            </Typography>
                                            <TextField
                                                label="مثال: موجودی تنوع 12345 را 8 کن، یا برای مرسوله 987 کد رهگیری 111 را ثبت کن"
                                                value={aiPrompt}
                                                onChange={(event) => setAiPrompt(event.target.value)}
                                                multiline
                                                minRows={2}
                                                fullWidth
                                            />
                                            <Button variant="outlined" onClick={handleAiFill} disabled={aiLoading}>
                                                {aiLoading ? "در حال پر کردن..." : "پر کردن فرم با هوش مصنوعی"}
                                            </Button>
                                        </Stack>
                                    </Paper>
                                )}

                                {method !== "GET" && bodyFields.length > 0 && (
                                    <Stack spacing={1}>
                                        <Typography variant="subtitle2" fontWeight={900}>
                                            اطلاعات لازم برای انجام کار
                                        </Typography>
                                        {bodyFields.map((field) => (
                                            <TextField
                                                key={field.key}
                                                select={field.type === "boolean"}
                                                label={`${field.label}${field.required ? " *" : ""}`}
                                                helperText={field.helper}
                                                value={bodyFieldValues[field.key] ?? ""}
                                                onChange={(event) =>
                                                    setBodyFieldValues((current) => ({
                                                        ...current,
                                                        [field.key]: event.target.value,
                                                    }))
                                                }
                                                multiline={field.type === "json"}
                                                minRows={field.type === "json" ? 3 : undefined}
                                                type={field.type === "number" ? "number" : "text"}
                                                dir={field.type === "text" ? "rtl" : "ltr"}
                                                fullWidth
                                            >
                                                {field.type === "boolean" ? [
                                                    <MenuItem key="true" value="true">بله / فعال</MenuItem>,
                                                    <MenuItem key="false" value="false">خیر / غیرفعال</MenuItem>,
                                                ] : null}
                                            </TextField>
                                        ))}
                                    </Stack>
                                )}

                                {method !== "GET" && bodyFields.length === 0 && !fileUpload && (
                                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                                        این عملیات فرم آماده ندارد و با مقدار پیش‌فرض امن ارسال می‌شود. برای تغییر جزئیات، حالت پیشرفته را روشن کنید.
                                    </Alert>
                                )}

                                {fileUpload && (
                                    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
                                        <TextField
                                            label="نام فیلد فایل"
                                            value={fileFieldName}
                                            onChange={(event) => setFileFieldName(event.target.value)}
                                            sx={{ minWidth: 180 }}
                                            dir="ltr"
                                        />
                                        <Button variant="outlined" component="label">
                                            انتخاب فایل
                                            <input
                                                type="file"
                                                hidden
                                                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                                            />
                                        </Button>
                                        {file && <Chip label={file.name} onDelete={() => setFile(null)} />}
                                    </Stack>
                                )}

                                {showAdvanced && (
                                    <Stack spacing={1}>
                                        <Divider />
                                        <Typography variant="caption" dir="ltr" sx={{ overflowWrap: "anywhere" }}>
                                            {url}
                                        </Typography>
                                        {method !== "GET" && (
                                            <TextField
                                                label="اطلاعات فنی ساخته‌شده"
                                                value={body}
                                                onChange={(event) => setBody(event.target.value)}
                                                multiline
                                                minRows={5}
                                                fullWidth
                                                dir="ltr"
                                            />
                                        )}
                                    </Stack>
                                )}

                                <Button variant="contained" size="large" onClick={handleSend} disabled={loading || hasMissingPathParam}>
                                    {loading ? "در حال ارسال..." : `${actionVerb(method)} در دیجی‌کالا`}
                                </Button>
                            </>
                        ) : null}
                    </Stack>
                </Paper>
            </Box>

            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
                <Stack spacing={1}>
                    <Typography variant="subtitle2" fontWeight={900}>
                        نتیجه عملیات
                    </Typography>
                    <Box
                        component="pre"
                        dir="ltr"
                        sx={{
                            bgcolor: "grey.950",
                            color: "grey.100",
                            p: 2,
                            borderRadius: 1,
                            minHeight: 180,
                            maxHeight: 520,
                            overflow: "auto",
                            fontSize: 13,
                        }}
                    >
                        {response || "هنوز عملیاتی اجرا نشده است."}
                    </Box>
                </Stack>
            </Paper>
        </Stack>
    );
}
