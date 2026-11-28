import { describe, expect, it } from 'vitest';

import {
  mergeAndParseTapinAutomationSettings,
  parseTapinAutomationSettings,
  type TapinAutomationConfigValues,
} from './automation-config';
import {
  CONFIG_FIELD_DEFAULTS,
  configFieldsSchema,
} from '@/views/admin/site-settings/site-config/config-field-presets';

const validValues: TapinAutomationConfigValues = {
  tapinAutoRegisterEnabled: true,
  tapinAutoRegisterShopId: '550e8400-e29b-41d4-a716-446655440000',
  tapinAutoRegisterBoxId: '12',
  tapinAutoRegisterPackageWeightGrams: '180',
  tapinAutoRegisterOrderType: '1',
  tapinAutoRegisterPacketType: '2',
  tapinAutoRegisterContentType: '1',
  tapinAutoRegisterPayType: '1',
  tapinAutoRegisterHasInsurance: true,
  tapinAutoRegisterMaxAttempts: '3',
  tapinAutoRegisterRetryDelaySeconds: '60',
};

describe('Tapin automatic registration settings', () => {
  it('does not enable automation when the switch is off', () => {
    const result = parseTapinAutomationSettings({
      ...validValues,
      tapinAutoRegisterEnabled: false,
      tapinAutoRegisterShopId: '',
      tapinAutoRegisterBoxId: '',
      tapinAutoRegisterPackageWeightGrams: '',
      tapinAutoRegisterOrderType: '',
      tapinAutoRegisterPacketType: '',
      tapinAutoRegisterContentType: '',
      tapinAutoRegisterPayType: '',
    });

    expect(result).toEqual({ enabled: false });
  });

  it('rejects enabled automation when a provider field is missing', () => {
    try {
      parseTapinAutomationSettings({
        ...validValues,
        tapinAutoRegisterBoxId: '',
      });
      throw new Error('expected configuration parsing to fail');
    } catch (error) {
      expect(error).toMatchObject({
        issues: [
          expect.objectContaining({ key: 'tapinAutoRegisterBoxId' }),
        ],
      });
    }
  });

  it('normalizes explicit values without inventing shipment defaults', () => {
    expect(parseTapinAutomationSettings(validValues)).toEqual({
      enabled: true,
      shopId: '550e8400-e29b-41d4-a716-446655440000',
      boxId: 12,
      packageWeightGrams: 180,
      orderType: 1,
      packetType: 2,
      contentType: 1,
      payType: 1,
      hasInsurance: true,
      maxAttempts: 3,
      retryDelaySeconds: 60,
    });
  });

  it('validates the admin form when automation is enabled', () => {
    const result = configFieldsSchema.safeParse({
      ...CONFIG_FIELD_DEFAULTS,
      ...validValues,
    });

    expect(result.success).toBe(true);
  });

  it('validates a partial admin update against the persisted values', () => {
    expect(() =>
      mergeAndParseTapinAutomationSettings(
        { ...validValues, tapinAutoRegisterEnabled: false },
        { tapinAutoRegisterEnabled: true, tapinAutoRegisterBoxId: '' },
      ),
    ).toThrow();

    expect(
      mergeAndParseTapinAutomationSettings(
        { ...validValues, tapinAutoRegisterEnabled: false },
        { tapinAutoRegisterEnabled: true },
      ),
    ).toMatchObject({ enabled: true, boxId: 12 });
  });
});
