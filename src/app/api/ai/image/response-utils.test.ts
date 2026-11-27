import { describe, expect, it } from 'vitest';
import { getImageBase64 } from './response-utils';

describe('getImageBase64', () => {
  it('returns undefined when the image service returns no image data', () => {
    expect(getImageBase64({ data: [] })).toBeUndefined();
  });

  it('returns the first image payload when it is present', () => {
    expect(getImageBase64({ data: [{ b64_json: 'encoded-image' }] })).toBe('encoded-image');
  });
});
