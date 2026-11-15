export type SmsEnvironment = { SMS_IR_API_KEY?: string; SMS_IR_TEMPLATE_ID?: string };

export async function sendOtpSms(env: SmsEnvironment, phone: string, code: string): Promise<void> {
  if (!env.SMS_IR_API_KEY || !env.SMS_IR_TEMPLATE_ID) throw new Error("sms_not_configured");
  const response = await fetch("https://api.sms.ir/v1/send/verify", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/plain", "X-API-KEY": env.SMS_IR_API_KEY }, body: JSON.stringify({ mobile: phone, templateId: Number(env.SMS_IR_TEMPLATE_ID), parameters: [{ name: "CODE", value: code }] }), signal: AbortSignal.timeout(8000) });
  const payload: any = response.ok ? await response.json().catch(() => null) : null;
  if (!payload || Number(payload.status) !== 1) throw new Error("sms_provider_failed");
}
