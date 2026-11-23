export type TransportOption = {
  id: string;
  name: string;
  description?: string;
};

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function normalizeTransportOptions(payload: unknown): TransportOption[] {
  if (!payload || typeof payload !== 'object') return [];

  const rawData = (payload as { data?: unknown }).data;
  if (!Array.isArray(rawData)) return [];

  return rawData
    .map((item): TransportOption | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as { id?: unknown; _id?: unknown; name?: unknown; description?: unknown };
      const id = readNonEmptyString(record.id) ?? readNonEmptyString(record._id);
      const name = readNonEmptyString(record.name);
      if (!id || !name) return null;

      const description = readNonEmptyString(record.description);
      return description ? { id, name, description } : { id, name };
    })
    .filter((item): item is TransportOption => item !== null);
}

export async function fetchTransportOptions(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ data: TransportOption[] }> {
  const response = await fetchImpl(url, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // The status code remains the source of truth when the server response is not JSON.
  }

  if (!response.ok) {
    const apiError =
      payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : undefined;
    throw new Error(apiError || `transport_request_failed_${response.status}`);
  }

  return { data: normalizeTransportOptions(payload) };
}
