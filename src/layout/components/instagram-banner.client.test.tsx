import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('swr', () => ({
  default: (_key: string, _fetcher: unknown, options?: { fallbackData?: unknown }) => ({
    data: (options?.fallbackData as { data?: unknown[] } | undefined) ?? { data: [] },
    error: undefined,
    isLoading: false,
  }),
}));

import InstagramBannerCarousel from './instagram-banner.client';

describe('InstagramBannerCarousel', () => {
  it('renders one fallback banner when no slide is available', () => {
    const markup = renderToStaticMarkup(<InstagramBannerCarousel initialSlides={[]} />);

    expect((markup.match(/alt="home-banner"/g) ?? []).length).toBe(1);
  });

  it('renders slide image and navigation controls when slides are provided', () => {
    const markup = renderToStaticMarkup(
      <InstagramBannerCarousel
        initialSlides={[
          { id: '1', mediaDesktopId: 'media-1', href: '/special' },
          { id: '2', mediaDesktopId: 'media-2', href: '/new' },
        ]}
      />
    );

    expect(markup).toContain('alt="slide-1"');
    expect(markup).toContain('aria-label="banner-prev"');
    expect(markup).toContain('aria-label="banner-next"');
  });

  it('falls back to /store when slide has no href', () => {
    const markup = renderToStaticMarkup(
      <InstagramBannerCarousel
        initialSlides={[
          { id: 'no-href', mediaDesktopId: 'media-xyz', href: '' },
        ]}
      />
    );

    expect(markup).toContain('alt="slide-no-href"');
    expect(markup).toContain('href="/store"');
  });
});
