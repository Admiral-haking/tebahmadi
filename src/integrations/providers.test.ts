import { describe, expect, it } from 'vitest';
import { buildSmsIrVerifyPayload } from './smsir';
import { mapTapinStatus, registerTapin } from './tapin';

describe('SMS.ir integration contract', () => {
  it('builds the verify payload with the configured template parameter', () => {
    expect(buildSmsIrVerifyPayload('09123456789', 712555, '2619')).toEqual({
      mobile: '09123456789',
      templateId: 712555,
      parameters: [{ name: 'CODE', value: '2619' }],
    });
  });
});

describe('Tapin integration contract', () => {
  it('rejects incomplete recipient data before any provider request', async () => {
    await expect(registerTapin({ token: 'token', shopId: 'shop' }, {
      manualId: 'order-1', provinceCode: 1, cityCode: 2, weightGrams: 100,
      recipient: { name: 'علی', mobile: '09123456789', address: '', postalCode: '' }, items: [],
    }, async () => new Response('{}'))).rejects.toMatchObject({ message: 'tapin_recipient_details_required' });
  });

  it('maps provider status codes to stable shipment states', () => {
    expect(mapTapinStatus('7')).toBe('delivered');
    expect(mapTapinStatus('15')).toBe('in_transit');
    expect(mapTapinStatus('3')).toBe('failed');
  });
});
