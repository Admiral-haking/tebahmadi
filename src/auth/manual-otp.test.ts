import { describe, expect, it } from 'vitest';
import { isManualOtpPhone } from './manual-otp';

describe('manual OTP fallback', () => {
  it('enables the fallback only for the configured normalized phone', () => {
    expect(isManualOtpPhone('+989120000000', '+989120000000')).toBe(true);
    expect(isManualOtpPhone('09120000000', '+989120000000')).toBe(false);
    expect(isManualOtpPhone('+989123456789', '+989120000000')).toBe(false);
    expect(isManualOtpPhone('+989120000000', undefined)).toBe(false);
  });

  it('accepts a phone from a comma-separated test fallback list', () => {
    expect(isManualOtpPhone('+989153685965', '+989120000000,+989153685965')).toBe(true);
  });
});
