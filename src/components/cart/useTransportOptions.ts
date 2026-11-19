'use client';

import useSWR from 'swr';

export type TransportOption = {
  id: string;
  name: string;
  description?: string;
};

type TransportApiResponse = {
  data?: Array<{
    _id?: string;
    id?: string;
    name?: string;
    description?: string;
  }>;
};

async function fetcher(url: string): Promise<{ data: TransportOption[] }> {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || response.statusText || 'Failed to load carriers');
  }

  const json = (await response.json()) as TransportApiResponse;
  const carriers = Array.isArray(json?.data)
    ? json.data
      .map((item) => {
        const id = item.id ?? item._id ?? '';
        const name = item.name ?? '';
        if (!id || !name) {
          return null;
        }
        return {
          id,
          name,
          description: item.description ?? undefined,
        } satisfies TransportOption;
      })
      .filter((item) => item !== null)
    : [];

  return { data: carriers as TransportOption[] };
}

export function useTransportOptions() {
  const { data, error, isLoading } = useSWR('/api/transport?isActive=true', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  return {
    options: data?.data ?? [],
    isLoading,
    error: error instanceof Error ? error : null,
  };
}
