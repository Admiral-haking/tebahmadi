import { describe, expect, it } from 'vitest';

import { InvoiceModel } from '@/orders/models/Invoice';
import {
  TAPIN_SHIPMENT_JOB_STATES,
  TapinShipmentJobModel,
} from './model/shipment-job';

describe('Tapin automation persistence contracts', () => {
  it('defines a durable one-job-per-invoice model with claim fields', () => {
    const invoiceId = TapinShipmentJobModel.schema.path('invoiceId');
    const state = TapinShipmentJobModel.schema.path('state');

    expect(invoiceId.options.unique).toBe(true);
    expect((state as unknown as { enumValues?: string[] }).enumValues).toEqual([
      ...TAPIN_SHIPMENT_JOB_STATES,
    ]);
    expect(TapinShipmentJobModel.schema.path('manualId')).toBeDefined();
    expect(TapinShipmentJobModel.schema.path('lockedAt')).toBeDefined();
    expect(TapinShipmentJobModel.schema.path('heartbeatAt')).toBeDefined();
    expect(TapinShipmentJobModel.schema.path('nextRunAt')).toBeDefined();
  });

  it('adds backward-compatible automation metadata to invoices', () => {
    expect(InvoiceModel.schema.path('tapinAutomation.state')).toBeDefined();
    expect(InvoiceModel.schema.path('tapinAutomation.manualId')).toBeDefined();
    expect(InvoiceModel.schema.path('tapinAutomation.lastErrorCode')).toBeDefined();
    expect(InvoiceModel.schema.path('tapinAutomation.readyToPrintAt')).toBeDefined();
  });
});
