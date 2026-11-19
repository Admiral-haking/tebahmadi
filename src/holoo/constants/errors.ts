/**
 * Holoo error-code table (from the web service guide) plus a small HolooError
 * type used throughout the integration so callers get a stable shape:
 *   { message, holooCode?, status, data? }
 */

export const HOLOO_ERRORS: Record<string, string> = {
    // Login / connection
    "1": "عدم برقراری ارتباط با بانک اطلاعاتی (نام کاربری یا رمز عبور نادرست)",
    "3": "فایل Config در مسیر مورد نظر کپی نشده است",
    "4": "لطفا ابتدا نسخه هلو را اجرا نمایید",
    "5": "اتصال به اینترنت برقرار نمی‌باشد",
    "6": "شما دسترسی استفاده از وب سرویس را ندارید",
    "27": "شما دسترسی استفاده از وب سرویس را ندارید",

    // Customer
    "7": "نام طرف حساب خالی می‌باشد",
    "8": "نام طرف حساب تکراری می‌باشد",
    "9": "کد طرف حساب تکراری می‌باشد",
    "10": "شماره موبایل تکراری می‌باشد",
    "11": "پکیج ارسالی اشتباه می‌باشد",
    "12": "کد حساب تکراری می‌باشد",
    "13": "کد حساب معتبر نمی‌باشد",
    "14": "کد طرف حساب معتبر نمی‌باشد",
    "21": "نوع (بدهکار/بستانکار) به درستی مشخص نشده است",
    "22": "کد واسطه (ErpCode) معتبر نمی‌باشد",
    "23": "کد ملی تکراری می‌باشد",
    "24": "کد اقتصادی تکراری می‌باشد",
    "25": "کد پستی معتبر نمی‌باشد",
    "26": "سرفصل طرف حساب / مالیات و عوارض معتبر نمی‌باشد",

    // Invoice
    "15": "کد کالا معتبر نمی‌باشد",
    "16": "کد واحد معتبر نمی‌باشد",
    "17": "تاریخ معتبر نمی‌باشد",
    "18": "ساعت معتبر نمی‌باشد",
    "19": "تعداد کالا معتبر نمی‌باشد",
    "20": "قیمت کالا معتبر نمی‌باشد",
    "28": "کالاهای زیر فاقد موجودی می‌باشد",
    "29": "سرفصل صندوق معتبر نمی‌باشد",
    "30": "مبلغ صندوق معتبر نمی‌باشد",
    "31": "نوع فاکتور معتبر نمی‌باشد",
    "32": "سرفصل کارت خوان معتبر نمی‌باشد",
    "33": "مبلغ کارت خوان معتبر نمی‌باشد",
    "34": "مبلغ نسیه معتبر نمی‌باشد",
    "35": "مبلغ تخفیف معتبر نمی‌باشد",
    "36": "مبلغ تسویه فاکتور با جمع فاکتور برابر نمی‌باشد",

    // Product
    "37": "کد کالا تکراری می‌باشد",
    "38": "نام کالا تکراری می‌باشد",
    "39": "نام کالا خالی می‌باشد",
    "40": "ErpCode کالا معتبر نمی‌باشد",
    "41": "ظرفیت این طبقه جهت اضافه نمودن کالا تکمیل شده است",
    "42": "ErpCode گروه اصلی معتبر نمی‌باشد",
    "43": "ErpCode گروه فرعی معتبر نمی‌باشد",
    "44": "شناسه معتبر نمی‌باشد",
    "46": "مبلغ مشخص نشده است",
};

type HolooErrorInit = {
    code?: string | number | null;
    status?: number;
    data?: unknown;
};

export class HolooError extends Error {
    readonly holooCode?: string;
    readonly status: number;
    readonly data?: unknown;
    /** Marker so the request wrapper doesn't re-wrap an already-mapped error. */
    readonly isHolooError = true as const;

    constructor(message: string, init: HolooErrorInit = {}) {
        super(message);
        this.name = "HolooError";
        this.holooCode = init.code != null && init.code !== "" ? String(init.code) : undefined;
        this.status = init.status ?? 502;
        this.data = init.data;
    }
}

/**
 * Build a HolooError, preferring the documented Persian message for a known
 * error code and falling back to whatever message the service returned.
 */
export function holooError(
    code: string | number | null | undefined,
    message?: string,
    init: { status?: number; data?: unknown } = {},
): HolooError {
    const key = code != null ? String(code) : "";
    const known = key ? HOLOO_ERRORS[key] : undefined;
    const text =
        known ||
        (message && message.trim()) ||
        (key ? `خطای هلو (کد ${key})` : "خطای نامشخص در ارتباط با هلو");
    return new HolooError(text, { code, status: init.status, data: init.data });
}

export function isHolooError(value: unknown): value is HolooError {
    return Boolean(value && typeof value === "object" && (value as any).isHolooError);
}
