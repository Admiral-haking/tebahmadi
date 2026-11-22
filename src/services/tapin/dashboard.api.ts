import { axiosRequest, safeJson } from '@/utils/axios-request';

export async function fetchTapinOverview<T>(query: URLSearchParams) {
  const response = await axiosRequest(`/api/admin/tapin/overview?${query}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const result = await safeJson<{ data?: T }>(response);
  return { response, result };
}

export async function fetchTapinTask<T>(id: string) {
  const response = await axiosRequest(`/api/admin/tapin/tasks/${encodeURIComponent(id)}`, {
    credentials: 'include',
  });
  const result = await safeJson<{ data?: T }>(response);
  return { response, result };
}

export async function fetchTapinStatusReport<T>(query: URLSearchParams) {
  const response = await axiosRequest(`/api/admin/tapin/status-report?${query}`, {
    credentials: 'include',
  });
  const result = await safeJson<{ data?: T }>(response);
  return { response, result };
}

export async function runTapinSync<T>(action?: 'retry-failed') {
  const response = await axiosRequest('/api/admin/tapin/sync', {
    method: 'POST',
    credentials: 'include',
    ...(action
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }
      : {}),
  });
  const result = await safeJson<{ data?: T }>(response);
  return { response, result };
}
