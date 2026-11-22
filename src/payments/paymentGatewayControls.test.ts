import { describe, expect, it } from 'vitest';
import {
  PAYMENT_GATEWAY_META,
  buildPaymentGatewayControls,
  getVisiblePaymentGatewaysFromControls,
} from './paymentGatewayControls';

describe('payment gateway controls', () => {
  it('keeps Zarinpal disabled by default while exposing all six gateways', () => {
    const controls = buildPaymentGatewayControls(
      {
        zarinpal: true,
        torob: true,
        digipay: true,
        azkivam: true,
        snapppay: true,
        bajetpay: true,
      },
      {},
    );

    expect(PAYMENT_GATEWAY_META).toHaveLength(6);
    expect(controls.find((item) => item.gateway === 'zarinpal')).toMatchObject({
      configured: true,
      visible: false,
      enabled: false,
    });
    expect(getVisiblePaymentGatewaysFromControls(controls)).toEqual([
      'torob',
      'digipay',
      'azkivam',
      'snapppay',
      'bajetpay',
    ]);
  });

  it('never exposes an unconfigured gateway even when persisted flags are true', () => {
    const controls = buildPaymentGatewayControls(
      { torob: false, bajetpay: false },
      { torob: { visible: true, enabled: true }, bajetpay: { visible: true, enabled: true } },
    );

    expect(getVisiblePaymentGatewaysFromControls(controls)).toEqual([]);
    expect(controls.find((item) => item.gateway === 'torob')).toMatchObject({
      configured: false,
      visible: false,
      enabled: false,
    });
  });

  it('allows an administrator to explicitly enable Zarinpal later', () => {
    const controls = buildPaymentGatewayControls(
      { zarinpal: true },
      { zarinpal: { visible: true, enabled: true } },
    );

    expect(getVisiblePaymentGatewaysFromControls(controls)).toEqual(['zarinpal']);
  });
});
