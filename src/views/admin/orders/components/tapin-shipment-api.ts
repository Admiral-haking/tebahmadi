import { axiosRequest, safeJson } from '@/utils/axios-request';

function formatApiError(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
    if (typeof record.formErrors === 'object' && record.formErrors !== null) {
      const formErrors = record.formErrors as Record<string, unknown>;
      const messages = Array.isArray(formErrors.formErrors)
        ? formErrors.formErrors.filter((item): item is string => typeof item === 'string')
        : [];
      if (messages.length) return messages.join('، ');
    }
  }
  return fallback;
}

export async function requestTapin<T extends object>(url: string, init?: RequestInit): Promise<T> {
  const response = await axiosRequest(url, { credentials: 'include', ...init });
  const data = await safeJson<T>(response);
  if (!response.ok || data.error) {
    throw new Error(formatApiError(data.error, 'عملیات تاپین ناموفق بود.'));
  }
  return data;
}
