import { describe, expect, it } from 'vitest';

const genericRequestError = 'فعلاً امکان ورود نیست؛ لطفاً بعداً دوباره تلاش کنید.';

describe('login error messages', () => {
  it('hides SMS provider details from customers', async () => {
    const loginModule = (await import('./login-context')) as unknown as Record<string, unknown>;
    const translateError = loginModule.translateError as
      | ((raw: string | null | undefined, fallback: string) => string)
      | undefined;

    expect(translateError).toBeTypeOf('function');
    expect(translateError?.('sms_provider_insufficient_credit', genericRequestError)).toBe(genericRequestError);
    expect(translateError?.('sms_provider_auth_failed', genericRequestError)).toBe(genericRequestError);
    expect(translateError?.('sms_provider_failed_400', genericRequestError)).toBe(genericRequestError);
    expect(translateError?.('login_unavailable', genericRequestError)).toBe(genericRequestError);
  });
});
