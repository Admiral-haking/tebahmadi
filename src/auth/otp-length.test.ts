import { describe, expect, it } from 'vitest';
import { verifyCodeSchema } from '../lib/schemas';

describe('OTP length', () => {
  it('accepts exactly four digits and rejects six digits', () => {
    const phone = '+989120000000';

    expect(verifyCodeSchema.safeParse({ phone, code: '2619' }).success).toBe(true);
    expect(verifyCodeSchema.safeParse({ phone, code: '261900' }).success).toBe(false);
  });
});
