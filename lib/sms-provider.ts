export type SmsEnvironment = {
  SMS_IR_API_KEY?: string;
  SMS_IR_OTP_TEMPLATE_ID?: string;
  SMS_IR_TEMPLATE_ID?: string;
};

export function resolveSmsOtpTemplateId(env: SmsEnvironment): string | undefined {
  const templateId = String(env.SMS_IR_OTP_TEMPLATE_ID || env.SMS_IR_TEMPLATE_ID || "").trim();
  return templateId || undefined;
}

export function isValidSmsOtpTemplateId(templateId: string | undefined): boolean {
  const numericTemplateId = Number(String(templateId || "").trim());
  return Number.isSafeInteger(numericTemplateId) && numericTemplateId > 0;
}

export function buildSmsVerifyPayload(mobile: string, templateId: string, code: string) {
  const numericTemplateId = Number(String(templateId).trim());
  if (!isValidSmsOtpTemplateId(templateId)) throw new Error("sms_template_not_configured");
  return { mobile, templateId: numericTemplateId, parameters: [{ name: "CODE", value: code }] };
}

export async function sendOtpSms(env: SmsEnvironment, phone: string, code: string): Promise<void> {
  const templateId = resolveSmsOtpTemplateId(env);
  if (!env.SMS_IR_API_KEY || !templateId) throw new Error("sms_not_configured");
  const response = await fetch("https://api.sms.ir/v1/send/verify", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/plain", "X-API-KEY": env.SMS_IR_API_KEY }, body: JSON.stringify(buildSmsVerifyPayload(phone, templateId, code)), signal: AbortSignal.timeout(8000) });
  const payload: any = response.ok ? await response.json().catch(() => null) : null;
  if (!payload || Number(payload.status) !== 1) throw new Error("sms_provider_failed");
}
