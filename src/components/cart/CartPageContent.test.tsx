import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('checkout shipping section integration', () => {
  it('does not wrap CarrierSelect with a duplicate shipping heading', () => {
    const source = readFileSync(new URL('./CartPageContent.tsx', import.meta.url), 'utf8');

    expect(source).not.toMatch(/<Typography variant="subtitle1"[^>]*>\s*روش ارسال\s*<\/Typography>/);
  });
});
