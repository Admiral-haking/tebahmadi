import { describe, expect, it } from 'vitest';

import { invoiceToTapin } from './invoice';
import { tapinManualInvoiceRequestSchema } from './validation';

const invoice = {
  _id: 'invoice-1',
  number: 'INV-1',
  shippingPaymentMethod: 'online',
  addressSnapshot: {
    fname: 'علی',
    lname: 'احمدی',
    phone: '09121234567',
    state: 'تهران',
    city: 'تهران',
    address: 'نشانی مشتری',
    postalCode: '1234567890',
  },
  lines: [
    {
      variantId: '507f1f77bcf86cd799439011',
      title: 'کالای واقعی',
      sku: 'SKU-1',
      qty: 1,
      weightGrams: 250,
      unitPriceEffective: 120_000,
    },
  ],
};

describe('manual Tapin registration contract', () => {
  it('rejects a request when the admin has not entered packaging details', () => {
    const result = tapinManualInvoiceRequestSchema.safeParse({
      invoiceId: '507f1f77bcf86cd799439011',
      provinceCode: 1,
      cityCode: 2,
      boxId: 3,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toEqual(
        expect.arrayContaining([
          'packetType',
          'packageWeight',
          'orderType',
          'registerType',
          'contentType',
          'hasInsurance',
        ]),
      );
    }
  });

  it('keeps every explicit packaging choice in the Tapin payload', () => {
    const parsed = tapinManualInvoiceRequestSchema.parse({
      invoiceId: '507f1f77bcf86cd799439011',
      provinceCode: 11,
      cityCode: 22,
      boxId: 33,
      packetType: 3,
      packageWeight: 180,
      orderType: 5,
      registerType: 0,
      contentType: 3,
      hasInsurance: false,
      payType: 1,
      itemWeights: [{ variantId: '507f1f77bcf86cd799439011', weightGrams: 260 }],
    });

    const payload = invoiceToTapin(invoice, parsed);

    expect(payload).toMatchObject({
      province_code: 11,
      city_code: 22,
      box_id: 33,
      packet_type: 3,
      package_weight: 180,
      order_type: 5,
      register_type: 0,
      content_type: 3,
      has_insurance: false,
      products: [{ weight: 260 }],
    });
  });
});
