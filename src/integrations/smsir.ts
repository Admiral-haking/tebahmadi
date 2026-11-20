export interface SmsIrConfig {
  apiKey: string;
  templateId: number;
  parameterName?: string;
  timeoutMs?: number;
}

export interface SmsIrVerifyPayload {
  mobile: string;
  templateId: number;
  parameters: Array<{ name: string; value: string }>;
}

export function mapSmsIrProviderError(status: number, message?: string): string {
  const normalized = (message ?? '').toLocaleLowerCase('fa-IR');
  if (/(اعتبار|credit|balance)/i.test(normalized)) {
    return 'sms_provider_insufficient_credit';
  }
  if (status === 401 || status === 403) {
    return 'sms_provider_auth_failed';
  }
  if (status === 429) {
    return 'sms_provider_rate_limited';
  }
  if (status === 400) {
    return 'sms_provider_invalid_request';
  }
  return `sms_provider_failed_${status}`;
}

export function buildSmsIrVerifyPayload(
  mobile: string,
  templateId: number,
  code: string,
  parameterName = 'CODE',
): SmsIrVerifyPayload {
  if (!Number.isSafeInteger(templateId) || templateId <= 0) {
    throw new Error('sms_template_not_configured');
  }
  const normalizedMobile = mobile.trim();
  if (!/^09\d{9}$/.test(normalizedMobile)) {
    throw new Error('sms_mobile_invalid');
  }
  return {
    mobile: normalizedMobile,
    templateId,
    parameters: [{ name: parameterName.trim() || 'CODE', value: String(code).trim() }],
  };
}

export async function sendSmsIrVerifyCode(
  config: SmsIrConfig,
  mobile: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!config.apiKey.trim()) throw new Error('sms_not_configured');
  const payload = buildSmsIrVerifyPayload(mobile, config.templateId, code, config.parameterName);
  const response = await fetchImpl('https://api.sms.ir/v1/send/verify', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-API-KEY': config.apiKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(config.timeoutMs ?? 8000),
  });
  const body = await response.json().catch(() => null) as { status?: number; message?: string } | null;
  if (!response.ok || Number(body?.status) !== 1) {
    throw new Error(mapSmsIrProviderError(response.status, body?.message));
  }
}
