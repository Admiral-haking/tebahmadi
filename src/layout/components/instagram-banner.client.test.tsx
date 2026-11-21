import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('swr', () => ({
  default: () => ({ data: { data: [] }, error: undefined, isLoading: false }),
}));

import InstagramBannerCarousel from './instagram-banner.client';

describe('InstagramBannerCarousel', () => {
  it('renders one fallback banner when no slide is available', () => {
    const markup = renderToStaticMarkup(<InstagramBannerCarousel initialSlides={[]} />);

    expect((markup.match(/alt="home-banner"/g) ?? []).length).toBe(1);
  });
});
