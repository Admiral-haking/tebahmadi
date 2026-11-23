import { describe, expect, it, vi } from 'vitest';

import { fetchTransportOptions, normalizeTransportOptions } from './transport-options';

describe('transport options client', () => {
  it('normalizes only usable carrier records from the API response', () => {
    expect(
      normalizeTransportOptions({
        data: [
          { _id: 'carrier-1', name: 'پست پیشتاز', description: 'ارسال سریع' },
          { id: 'carrier-2', name: 'تیپاکس' },
          { _id: 'missing-name' },
          { name: 'missing-id' },
          null,
        ],
      }),
    ).toEqual([
      { id: 'carrier-1', name: 'پست پیشتاز', description: 'ارسال سریع' },
      { id: 'carrier-2', name: 'تیپاکس' },
    ]);
  });

  it('requests fresh JSON and exposes a stable error when the service is unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ error: 'transport_unavailable' }),
    });

    await expect(fetchTransportOptions('/api/transport?isActive=true', fetchMock)).rejects.toThrow(
      'transport_unavailable',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/transport?isActive=true',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }),
    );
  });
});
