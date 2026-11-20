/**
 * Manual OTP recovery is intentionally restricted to one server-configured,
 * normalized phone. It is used only when the SMS provider is unavailable.
 */
export function isManualOtpPhone(phone: string, configuredPhone: string | undefined): boolean {
  const configured = configuredPhone?.trim();
  return Boolean(configured && phone.trim() === configured);
}
