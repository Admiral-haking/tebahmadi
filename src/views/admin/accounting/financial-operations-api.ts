import { axiosRequest } from '@/utils/axios-request';
import { buildOperationsUrl } from './financial-operations-utils';
import type { FinancialData } from './financial-operations-types';

export async function fetchFinancialOperations(from?: string, to?: string): Promise<FinancialData> {
  const response = await axiosRequest(buildOperationsUrl('json', from, to), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('financial_report_failed');
  return ((await response.json()) as { data: FinancialData }).data;
}

export async function postFinancialOperation(payload: Record<string, unknown>) {
  const response = await axiosRequest('/api/admin/accounting/operations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  });
  const body = (await response.json()) as { data?: unknown; error?: string };
  if (!response.ok) throw new Error(body.error || 'operation_failed');
  return body.data;
}
