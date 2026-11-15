const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeDigits(value: unknown): string {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

export function normalizePhone(value: unknown): string {
  let digits = normalizeDigits(value).replace(/\D/g, "");
  if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.startsWith("98")) digits = digits.slice(2);
  if (digits.startsWith("9") && digits.length === 10) digits = `0${digits}`;
  return digits.slice(0, 11);
}

export function isValidPhone(value: unknown): boolean {
  return /^09\d{9}$/.test(normalizePhone(value));
}

export function normalizeOtp(value: unknown): string {
  return normalizeDigits(value).replace(/\D/g, "").slice(0, 4);
}

export function normalizePostalCode(value: unknown): string {
  return normalizeDigits(value).replace(/\D/g, "").slice(0, 10);
}
