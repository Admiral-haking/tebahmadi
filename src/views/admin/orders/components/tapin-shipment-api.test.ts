import { describe, expect, it } from 'vitest';

import { formatApiError } from './tapin-shipment-api';

describe('Tapin admin API errors', () => {
  it('surfaces zod field errors instead of falling back to a generic message', () => {
    expect(
      formatApiError(
        {
          formErrors: [],
          fieldErrors: {
            packageWeight: ['وزن بسته‌بندی الزامی است.'],
            boxId: ['جعبه را انتخاب کنید.'],
          },
        },
        'عملیات ناموفق بود.',
      ),
    ).toBe('وزن بسته‌بندی الزامی است.، جعبه را انتخاب کنید.');
  });
});
