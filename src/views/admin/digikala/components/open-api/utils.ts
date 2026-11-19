import type { Method, BodyField, SpecField, EndpointGuide, Preferences } from "./types";
import { WRITE_METHODS } from "./constants";

export function actionVerb(method: Method): string {
    if (method === "GET") return "نمایش";
    if (method === "DELETE") return "حذف";
    if (method === "PATCH" || method === "PUT") return "ویرایش";
    return "ثبت";
}

export function persianActionTitle(title: string, path: string, method: Method): string {
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

export function splitPathAndQuery(value: string): { path: string; query: string } {
    const clean = value.trim().replace(/^\/+/, "").replace(/^open-api\/v1\/?/, "");
    const [path, query = ""] = clean.split("?");
    return { path, query };
}

export function extractPlaceholders(value: string): string[] {
    return Array.from(value.matchAll(/\{([^}]+)\}/g)).map((match) => match[1]);
}

export function fillPathParams(value: string, params: Record<string, string>): string {
    return value.replace(/\{([^}]+)\}/g, (_, key: string) => params[key]?.trim() || `{${key}}`);
}

export function stringifyTemplate(value: unknown): string {
    return JSON.stringify(value, null, 2);
}

export function needsFileUpload(path: string): boolean {
    return /upload|excel|import|image/i.test(path);
}

export function canReturnFile(path: string): boolean {
    return /excel|export|label|sample|pdf/i.test(path);
}

export function explainStatus(status: number): string {
    if (status === 401) return "توکن دیجیکالا منقضی یا نامعتبر است.";
    if (status === 403) return "این فروشنده دسترسی لازم به این عملیات را ندارد.";
    if (status === 404) return "شناسه یا مسیر در دیجیکالا پیدا نشد.";
    if (status === 429) return "محدودیت تعداد درخواست — کمی بعد دوباره تلاش کنید.";
    if (status >= 500) return "خطای سمت دیجیکالا رخ داده است.";
    return "درخواست دیجیکالا ناموفق بود.";
}

export function persianPlaceholderLabel(key: string): string {
    const labels: Record<string, string> = {
        variant_id: "شناسه تنوع",
        product_variant_id: "شناسه تنوع محصول",
        product_id: "شناسه کالا",
        category_id: "شناسه دسته‌بندی",
        client_code: "کد کلاینت",
        draft_product_id: "شناسه پیش‌نویس کالا",
        question_id: "شناسه پرسش",
        promotion_id: "شناسه کمپین",
        promotion_variant_id: "شناسه تنوع کمپین",
        voucher_id: "شناسه کد تخفیف",
        shipment_id: "شناسه مرسوله",
        warehouse_id: "شناسه انبار",
        package_id: "شناسه محموله",
        invoice_id: "شناسه فاکتور",
        transaction_id: "شناسه تراکنش",
        order_id: "شناسه سفارش",
        order_item_id: "شناسه آیتم سفارش",
        id: "شناسه رکورد",
        keyword: "کلمه کلیدی",
    };
    return labels[key] ?? key;
}

function inferRequiredBodyFields(method: Method, path: string): string[] {
    if (method === "GET") return [];
    if (path === "variants/selling-price") return ["variant_id", "selling_price"];
    if (path.endsWith("/seller-stock")) return ["seller_stock"];
    if (path.endsWith("/activation")) return ["active"];
    if (path.includes("questions/answer")) return ["question_id", "answer"];
    if (path.includes("tracking-code")) return ["shipment_id", "tracking_code"];
    if (path.includes("update-status")) return ["shipment_id", "status"];
    if (path.includes("cancel")) return ["shipment_id یا order_item_id", "reason_id"];
    if (path.includes("promotions") && path.includes("variants")) return ["promotion_id در مسیر", "variants"];
    if (path.includes("smart-discount")) return ["variants", "start_at", "end_at"];
    if (path.includes("webhook/subscription")) return ["event_types", "callback_url"];
    if (path.startsWith("batch/")) return ["items"];
    if (needsFileUpload(path)) return ["فایل", "فیلدهای تکمیلی طبق نمونه"];
    return ["فیلدهای لازم طبق مستندات دیجی‌کالا"];
}

export function endpointGuide(method: Method, path: string, group: string, title: string): EndpointGuide {
    const lowerPath = path.toLowerCase();
    let purpose = "اجرای یکی از APIهای Open API دیجی‌کالا.";
    let tip = "شناسه‌ها و اطلاعات فرم را با داده‌های واقعی پنل دیجی‌کالا کامل کنید.";

    if (lowerPath.includes("variants") || group === "Variants") {
        purpose = "مدیریت تنوع‌ها: مشاهده، تغییر قیمت، موجودی یا فعال/غیرفعال کردن.";
        tip = "شناسه تنوع همان شناسه در پنل دیجی‌کالاست، نه شناسه محصول داخل سایت.";
    } else if (lowerPath.includes("orders") || group === "Orders") {
        purpose = "مشاهده یا مدیریت سفارش‌های دیجی‌کالا.";
        tip = "برای لغو، ابتدا شناسه آیتم سفارش را از لیست بردارید.";
    } else if (lowerPath.includes("inventory") || group === "Inventory") {
        purpose = "بررسی موجودی و گزارش‌های انبار دیجی‌کالا.";
        tip = "برای تغییر موجودی روزمره از بخش «مقایسه موجودی» استفاده کنید.";
    } else if (lowerPath.includes("pricing") || group.includes("Pricing") || group.includes("Promotion")) {
        purpose = "مدیریت قیمت، تخفیف‌ها و کمپین‌های فروش.";
        tip = "مبالغ را مطابق واحد مورد انتظار دیجی‌کالا وارد کنید.";
    } else if (lowerPath.includes("product-creation")) {
        purpose = "ایجاد کالا، اعتبارسنجی اطلاعات و آپلود تصویر.";
        tip = "برای ایجاد کالا باید دسته‌بندی، ویژگی‌ها و تصاویر معتبر داشته باشید.";
    } else if (lowerPath.includes("webhook")) {
        purpose = "تنظیم وبهوک برای دریافت رویدادهای دیجی‌کالا.";
        tip = "آدرس دریافت وبهوک باید از اینترنت قابل دسترسی باشد.";
    } else if (lowerPath.includes("profile")) {
        purpose = "مشاهده یا ویرایش پروفایل فروشنده.";
    } else if (lowerPath.includes("shipping") || lowerPath.includes("ship")) {
        purpose = "مدیریت ارسال، مرسوله‌ها، برچسب‌ها و کدهای رهگیری.";
        tip = "برای برچسب یا اکسل، دانلود مستقیم را فعال کنید.";
    }

    return {
        purpose,
        tip,
        risk: WRITE_METHODS.has(method)
            ? "این عملیات می‌تواند اطلاعات واقعی پنل دیجی‌کالا را تغییر دهد."
            : "این عملیات فقط اطلاعات را می‌خواند.",
        requiredPath: extractPlaceholders(path).map(persianPlaceholderLabel),
        requiredBody: inferRequiredBodyFields(method, path),
        titleFa: title,
    };
}

export function validateJsonBody(value: string): boolean {
    try {
        JSON.parse(value.trim() || "{}");
        return true;
    } catch {
        return false;
    }
}

export function bodyFieldsFor(method: Method, path: string): BodyField[] {
    if (method === "GET") return [];

    if (path === "variants/selling-price") {
        return [
            { key: "variant_id", label: "شناسه تنوع", helper: "از پنل دیجی‌کالا یا لیست تنوع‌ها بردارید.", type: "number", required: true },
            { key: "selling_price", label: "قیمت فروش", helper: "قیمت نهایی به ریال.", type: "number", required: true },
            { key: "credit_increase_percentage", label: "درصد افزایش اعتباری", helper: "اختیاری.", type: "number" },
        ];
    }
    if (path.endsWith("/seller-stock") || path.startsWith("batch/variant/seller-stock")) {
        return path.startsWith("batch/")
            ? [{ key: "items", label: "لیست تنوع‌ها و موجودی", helper: 'نمونه: [{"variant_id":12345,"seller_stock":10}]', type: "json", required: true, defaultValue: '[{"variant_id":12345,"seller_stock":10}]' }]
            : [{ key: "seller_stock", label: "موجودی فروشنده", helper: "تعداد موجودی قابل فروش.", type: "number", required: true }];
    }
    if (path.endsWith("/activation") || path.startsWith("batch/variant/activation")) {
        return path.startsWith("batch/")
            ? [{ key: "items", label: "لیست فعال/غیرفعال‌سازی", helper: 'نمونه: [{"variant_id":12345,"active":true}]', type: "json", required: true, defaultValue: '[{"variant_id":12345,"active":true}]' }]
            : [{ key: "active", label: "فعال باشد؟", helper: "true = فعال، false = غیرفعال.", type: "boolean", required: true, defaultValue: "true" }];
    }
    if (path === "questions/answer") {
        return [
            { key: "question_id", label: "شناسه پرسش", helper: "از لیست پرسش‌های مشتری بردارید.", type: "number", required: true },
            { key: "answer", label: "متن پاسخ", helper: "پاسخی که در دیجی‌کالا نمایش داده می‌شود.", type: "text", required: true },
        ];
    }
    if (path === "ship-by-seller-orders/tracking-code") {
        return [
            { key: "shipment_id", label: "شناسه مرسوله", helper: "از سفارش‌های ارسال توسط فروشنده بردارید.", type: "number", required: true },
            { key: "tracking_code", label: "کد رهگیری", helper: "کد رهگیری پستی.", type: "text", required: true },
        ];
    }
    if (path === "ship-by-seller-orders/update-status") {
        return [
            { key: "shipment_id", label: "شناسه مرسوله", helper: "", type: "number", required: true },
            { key: "status", label: "وضعیت جدید", helper: "مثال: ready_to_ship", type: "text", required: true },
        ];
    }
    if (path.includes("cancel-item") || path.includes("cancel-shipment")) {
        return [
            { key: "shipment_id", label: "شناسه مرسوله", helper: "", type: "number", required: true },
            { key: "reason_id", label: "شناسه دلیل لغو", helper: "باید از دلایل مجاز دیجی‌کالا باشد.", type: "number", required: true },
        ];
    }
    if (path.includes("pricing/promotions") && path.includes("variants")) {
        return [{ key: "variants", label: "تنوع‌های کمپین", helper: 'نمونه: [{"variant_id":12345,"discount_percent":10,"promo_price":2200000,"order_limit":5}]', type: "json", required: true, defaultValue: '[{"variant_id":12345,"discount_percent":10,"promo_price":2200000,"order_limit":5}]' }];
    }
    if (path.includes("smart-discount")) {
        return [{ key: "variants", label: "تنوع‌های تخفیف هوشمند", helper: 'نمونه: [{"variant_id":12345,"start_at":"2026-06-06 00:00:00","end_at":"2026-06-10 23:59:59","selling_price":2200000}]', type: "json", required: true, defaultValue: '[{"variant_id":12345,"start_at":"2026-06-06 00:00:00","end_at":"2026-06-10 23:59:59","selling_price":2200000}]' }];
    }
    if (path === "webhook/subscription" || path === "webhook/unsubscription") {
        return [
            { key: "event_types", label: "نوع رویدادها", helper: 'نمونه: ["order.created"]', type: "json", required: true, defaultValue: '["order.created"]' },
            { key: "callback_url", label: "آدرس دریافت وبهوک", helper: "آدرس عمومی سایت شما.", type: "text", required: true },
        ];
    }
    if (path.startsWith("batch/variant/update")) {
        return [{ key: "items", label: "لیست تغییرات تنوع", helper: 'نمونه: [{"variant_id":12345,"lead_time":1}]', type: "json", required: true, defaultValue: '[{"variant_id":12345,"lead_time":1}]' }];
    }
    return [];
}

export function fieldsFromSpec(fields: SpecField[]): BodyField[] {
    return fields.map((field) => ({
        key: field.key,
        label: persianPlaceholderLabel(field.key),
        helper: field.description || "از مستندات رسمی دیجی‌کالا.",
        type: field.type === "integer" || field.type === "number"
            ? "number"
            : field.type === "boolean"
                ? "boolean"
                : field.type === "array" || field.type === "object"
                    ? "json"
                    : "text",
        required: field.required,
        defaultValue: field.example === undefined || field.example === null
            ? ""
            : typeof field.example === "object"
                ? JSON.stringify(field.example)
                : String(field.example),
    }));
}

export function defaultFieldValues(fields: BodyField[]): Record<string, string> {
    return fields.reduce<Record<string, string>>((acc, field) => {
        acc[field.key] = field.defaultValue ?? "";
        return acc;
    }, {});
}

export function applyPreferenceDefaults(fields: BodyField[], preferences: Preferences): Record<string, string> {
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

export function buildBodyFromFields(fields: BodyField[], values: Record<string, string>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    fields.forEach((field) => {
        const raw = values[field.key]?.trim() ?? "";
        if (!raw && !field.required) return;
        if (field.type === "number") { payload[field.key] = Number(raw || 0); return; }
        if (field.type === "boolean") { payload[field.key] = raw === "true"; return; }
        if (field.type === "json") { payload[field.key] = JSON.parse(raw || "null"); return; }
        payload[field.key] = raw;
    });
    return payload;
}

export function templateFor(method: Method, path: string): string {
    if (method === "GET") return "{}";
    if (path === "variants/selling-price") return stringifyTemplate({ variant_id: 12345, selling_price: 2500000, credit_increase_percentage: 25 });
    if (path.endsWith("/seller-stock")) return stringifyTemplate({ seller_stock: 10 });
    if (path.endsWith("/activation")) return stringifyTemplate({ active: true });
    if (path === "variants/b2b-activation") return stringifyTemplate({ variant_ids: [12345], active: true });
    if (path.includes("orders/")) return stringifyTemplate({ cancellation_reason_id: -1, count: 1 });
    if (path === "questions/answer") return stringifyTemplate({ question_id: 123, answer: "متن پاسخ" });
    if (path.includes("pricing/promotions") && path.endsWith("/variants")) return stringifyTemplate({ variants: [{ variant_id: 12345, discount_percent: 10, promo_price: 2200000, order_limit: 5 }] });
    if (path === "pricing/smart-discount/variants" || path === "pricing/smart-discount/variants/batch") return stringifyTemplate({ variants: [{ variant_id: 12345, start_at: "2026-06-06 00:00:00", end_at: "2026-06-10 23:59:59", selling_price: 2200000 }] });
    if (path === "pricing/plp") return stringifyTemplate({ title: "PLP Campaign", start_at: "2026-06-06 00:00:00", end_at: "2026-06-10 23:59:59", variants: [{ variant_id: 12345, selling_price: 2200000 }] });
    if (path === "pricing/vouchers") return stringifyTemplate({ title: "Voucher", start_at: "2026-06-06 00:00:00", end_at: "2026-06-10 23:59:59", discount_percent: 10, usage_limit: 100 });
    if (path === "ship-by-seller-orders/tracking-code") return stringifyTemplate({ shipment_id: 12345, tracking_code: "TRACKING_CODE" });
    if (path === "ship-by-seller-orders/update-status") return stringifyTemplate({ shipment_id: 12345, status: "ready_to_ship" });
    if (path.includes("cancel-item") || path.includes("cancel-shipment")) return stringifyTemplate({ shipment_id: 12345, reason_id: 1 });
    if (path === "ship-by-seller-orders/change-time-scope") return stringifyTemplate({ shipment_id: 12345, time_scope_id: 1 });
    if (path.includes("shipments/seller/new-settings")) return stringifyTemplate({ title: "SBS setting", city_ids: [1], time_scope_ids: [1], is_active: true });
    if (path.includes("shipping-services/parcels")) return stringifyTemplate({ parcels: [{ shipment_id: 12345, box_size_id: 1, weight: 1000 }] });
    if (path.includes("bulk-shipping-services")) return stringifyTemplate({ shipment_ids: [12345], box_size_id: 1 });
    if (path === "webhook/subscription" || path === "webhook/unsubscription") return stringifyTemplate({ event_types: ["order.created"], callback_url: "/api/digikala/webhook" });
    if (path === "webhook/subscription/change-activation") return stringifyTemplate({ event_type: "order.created", active: true });
    if (path.startsWith("batch/variant/seller-stock")) return stringifyTemplate({ items: [{ variant_id: 12345, seller_stock: 10 }] });
    if (path.startsWith("batch/variant/activation")) return stringifyTemplate({ items: [{ variant_id: 12345, active: true }] });
    if (path.startsWith("batch/variant/update")) return stringifyTemplate({ items: [{ variant_id: 12345, lead_time: 1 }] });
    return stringifyTemplate({});
}
