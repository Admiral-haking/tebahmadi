import { describe, expect, it } from 'vitest';
import {
  PAYMENT_GATEWAY_META,
  buildPaymentGatewayControls,
  getVisiblePaymentGatewaysFromControls,
} from './paymentGatewayControls';

describe('payment gateway controls', () => {
  it('exposes only configured Zarinpal and forces every other gateway off', () => {
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
      visible: true,
      enabled: true,
    });
    expect(controls.filter((item) => item.gateway !== 'zarinpal').every((item) => !item.visible && !item.enabled)).toBe(true);
    expect(getVisiblePaymentGatewaysFromControls(controls)).toEqual([
      'zarinpal',
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

  it('ignores persisted enablement for disabled gateways', () => {
    const controls = buildPaymentGatewayControls(
      { torob: true, digipay: true, zarinpal: false },
      { torob: { visible: true, enabled: true }, digipay: { visible: true, enabled: true } },
    );

    expect(getVisiblePaymentGatewaysFromControls(controls)).toEqual([]);
    expect(controls.find((item) => item.gateway === 'torob')).toMatchObject({
      configured: true,
      visible: false,
      enabled: false,
    });
  });
});
