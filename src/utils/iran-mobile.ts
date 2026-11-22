export function normalizeIranMobile(value: string): string | null {
  const normalized = String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\s()-]/g, "");
  const mobile = normalized.startsWith("+98") ? `0${normalized.slice(3)}` : normalized;
  return /^09\d{9}$/.test(mobile) ? mobile : null;
}
