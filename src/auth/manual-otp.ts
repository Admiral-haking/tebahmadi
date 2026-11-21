/**
 * Manual OTP recovery is intentionally restricted to server-configured,
 * normalized phone(s). A comma-separated value supports a small local/test
 * allow-list without making the fallback available to every customer.
 */
export function isManualOtpPhone(phone: string, configuredPhone: string | undefined): boolean {
  const configured = configuredPhone
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) ?? [];
  return configured.includes(phone.trim());
}
