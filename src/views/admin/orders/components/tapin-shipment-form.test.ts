import { describe, expect, it } from 'vitest';

import { buildManualTapinPayload } from './tapin-shipment-form';

describe('manual Tapin shipment form payload', () => {
  it('does not build a request while packaging choices are incomplete', () => {
    expect(
      buildManualTapinPayload({
        invoiceId: 'invoice-1',
        shopId: '',
        provinceCode: 1,
        cityCode: 2,
        boxId: 0,
        packetType: '',
        packageWeight: '',
        orderType: '',
        registerType: '',
        contentType: '',
        hasInsurance: null,
      }),
    ).toBeNull();
  });

  it('only sends the packaging values explicitly entered by the admin', () => {
    expect(
      buildManualTapinPayload({
        invoiceId: 'invoice-1',
        shopId: 'b3f8a6e5-4a0b-4e34-9a1b-1b5ef682b7dd',
        provinceCode: 1,
        cityCode: 2,
        boxId: 10,
        packetType: 3,
        packageWeight: 180,
        orderType: 5,
        registerType: 0,
        contentType: 3,
        hasInsurance: false,
        payType: 1,
        itemWeights: [{ variantId: 'variant-1', weightGrams: 250 }],
      }),
    ).toEqual({
      invoiceId: 'invoice-1',
      shopId: 'b3f8a6e5-4a0b-4e34-9a1b-1b5ef682b7dd',
      provinceCode: 1,
      cityCode: 2,
      boxId: 10,
      packetType: 3,
      packageWeight: 180,
      orderType: 5,
      registerType: 0,
      contentType: 3,
      hasInsurance: false,
      payType: 1,
      itemWeights: [{ variantId: 'variant-1', weightGrams: 250 }],
    });
  });
});
