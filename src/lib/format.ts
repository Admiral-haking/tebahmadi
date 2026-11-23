export function formatFaNumber(value: number): string {
    const safe = Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(safe);
}

export function formatToman(value: number): string {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    return `${formatFaNumber(normalized)} تومان`;
}

export function formatPriceDigits(value: number): string {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    return formatFaNumber(normalized);
}

export function calculateDiscountPercent(
    originalPrice?: number,
    finalPrice?: number,
): number | undefined {
    if (
        typeof originalPrice !== "number" ||
        typeof finalPrice !== "number" ||
        !Number.isFinite(originalPrice) ||
        !Number.isFinite(finalPrice) ||
        originalPrice <= 0 ||
        finalPrice >= originalPrice
    ) {
        return undefined;
    }
    const percent = Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
    return percent > 0 ? percent : undefined;
}

export function formatPersianDate(iso?: string | null): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    try {
        return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
            year: "numeric",
            month: "long",
            day: "numeric",
        }).format(date);
    } catch {
        return null;
    }
}

export function normalizeDigits(input: string): string {
    return input
        .replace(/[۰-۹]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
        .replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));
}

export function normalizeIranPhone(input: string): string {
    const digits = normalizeDigits(input).replace(/\D/g, "");
    if (digits.startsWith("98") && digits.length === 12) {
        return `0${digits.slice(2)}`;
    }
    if (digits.startsWith("9") && digits.length === 10) {
        return `0${digits}`;
    }
    return digits;
}

export function isValidIranMobile(input: string): boolean {
    return /^09\d{9}$/.test(normalizeIranPhone(input));
}

export function isValidIranPostalCode(input: string): boolean {
    return /^\d{10}$/.test(normalizeDigits(input).replace(/\D/g, ""));
}
