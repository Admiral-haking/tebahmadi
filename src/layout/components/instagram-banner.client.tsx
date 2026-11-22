'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getImageProps } from 'next/image';
import Link from 'next/link';
import useSWR from 'swr';
import { Box, Container, IconButton, Skeleton, Stack } from '@mui/material';

type SlideItem = {
  id: string;
  href?: string;
  mediaId?: string;
  mediaDesktopId?: string;
  mediaMobileId?: string;
};

type SlideResponse = {
  data?: SlideItem[];
};

const FALLBACK_SRC = '/tebahmadi-hero-botanical.webp';
const FALLBACK_ID = 'tebahmadi-fallback';
const DESKTOP_BREAKPOINT = '(min-width: 900px)';

function normalizeMediaId(id?: string): string | undefined {
  const value = id?.trim();
  return value && !/^(?:undefined|null)$/i.test(value) ? value : undefined;
}

const fetcher = async (url: string): Promise<SlideResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    const message = (await response.text().catch(() => '')) || response.statusText;
    throw new Error(message || 'Failed to load slides');
  }
  return response.json();
};

export default function InstagramBannerCarousel({ initialSlides }: { initialSlides?: SlideItem[] }) {
  const { data, isLoading } = useSWR('/api/slides', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    fallbackData: initialSlides ? { data: initialSlides } : undefined,
  });
  const [index, setIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const items = useMemo<SlideItem[]>(() => {
    const list = data?.data ?? [];
    const valid = list.filter((slide) => {
      return Boolean(
        normalizeMediaId(slide.mediaDesktopId)
        || normalizeMediaId(slide.mediaMobileId)
        || normalizeMediaId(slide.mediaId),
      );
    });
    return valid.length > 0
      ? valid
      : [{ id: FALLBACK_ID, href: '/store', mediaDesktopId: '', mediaMobileId: '' }];
  }, [data?.data]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    if (index >= items.length) {
      setIndex(0);
    }
  }, [index, items.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || items.length <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    // In RTL layout: dragging left (diff > 50) moves to next slide
    if (diff > 50) {
      setIndex((prev) => (prev + 1) % items.length);
    } else if (diff < -50) {
      // dragging right (diff < -50) moves to previous slide
      setIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
    }
    setTouchStartX(null);
  };

  const active = items[index] ?? null;
  const desktopId = normalizeMediaId(active?.mediaDesktopId)
    || normalizeMediaId(active?.mediaId)
    || normalizeMediaId(active?.mediaMobileId)
    || '';
  const mobileId = normalizeMediaId(active?.mediaMobileId)
    || normalizeMediaId(active?.mediaDesktopId)
    || normalizeMediaId(active?.mediaId)
    || '';
  const desktopSrc = desktopId ? '/api/media/' + desktopId + '?type=original' : FALLBACK_SRC;
  const mobileSrc = mobileId ? '/api/media/' + mobileId + '?type=original' : desktopSrc;
  const href = active?.href && active.href.trim().length > 0 ? active.href.trim() : '/store';

  const common = {
    alt: active?.id === FALLBACK_ID ? 'محصولات طبیعی طب احمدی' : active ? 'slide-' + active.id : 'محصولات طبیعی طب احمدی',
    sizes: '100vw',
  };

  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    ...common,
    src: desktopSrc,
    width: 1920,
    height: 720,
    quality: 75,
  });

  const {
    props: { srcSet: mobileSrcSet, ...rest },
  } = getImageProps({
    ...common,
    src: mobileSrc,
    width: 1200,
    height: 675,
    quality: 75,
  });

  const hasDots = items.length > 1;

  return (
    <Box sx={{ width: '100%', py: { xs: 1.5, md: 2 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2 } }}>
        <Stack alignItems="center" sx={{ width: '100%', position: 'relative' }}>
          <Box
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            sx={{
              position: 'relative',
              width: '100%',
              aspectRatio: { xs: '16 / 9', sm: '16 / 8.5', md: '16 / 8', lg: '16 / 7.5' },
              minHeight: { xs: 180, sm: 240, md: 320, lg: 360 },
              maxHeight: { xs: 300, sm: 380, md: 460, lg: 520 },
              borderRadius: { xs: 3, sm: 4, md: 5 },
              overflow: 'hidden',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 10px 32px rgba(42, 90, 68, 0.08)',
              touchAction: 'pan-y pinch-zoom',
            }}
          >
            <Link href={href} style={{ textDecoration: 'none', display: 'block', width: '100%', height: '100%' }}>
              <picture>
                <source media={DESKTOP_BREAKPOINT} srcSet={desktopSrcSet} />
                <source media="(max-width: 899px)" srcSet={mobileSrcSet} />
                <img
                  {...rest}
                  alt={common.alt}
                  loading="eager"
                  fetchPriority="high"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: "cover",
                    objectPosition: "center",
                    display: 'block',
                    backgroundColor: 'transparent',
                  }}
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (desktopSrc && target.src !== desktopSrc) {
                      target.src = desktopSrc;
                    }
                  }}
                />
              </picture>
            </Link>

            {isLoading && !active && (
              <Skeleton
                variant="rectangular"
                sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(var(--mui-palette-common-backgroundChannel) / 0.2)' }}
              />
            )}

            {hasDots && (
              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                sx={{
                  position: 'absolute',
                  bottom: { xs: 10, sm: 14 },
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 2,
                  bgcolor: 'rgba(0, 0, 0, 0.35)',
                  backdropFilter: 'blur(8px)',
                  px: 1.25,
                  py: 0.5,
                  borderRadius: '10px',
                }}
              >
                {items.map((item, idx) => (
                  <Box
                    key={item.id}
                    component="button"
                    type="button"
                    aria-label={`نمایش بنر ${idx + 1}`}
                    aria-current={idx === index ? 'true' : undefined}
                    onClick={() => setIndex(idx)}
                    sx={{
                      width: idx === index ? 22 : 8,
                      height: 8,
                      p: 0,
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '10px',
                      bgcolor: idx === index ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)',
                      transition: 'all 200ms ease',
                      '&:hover': { bgcolor: '#FFFFFF' },
                      '&:focus-visible': { outline: '2px solid', outlineColor: '#FFFFFF', outlineOffset: 2 },
                    }}
                  />
                ))}
              </Stack>
            )}

            {items.length > 1 && (
              <>
                <IconButton
                  aria-label="banner-prev"
                  onClick={() => setIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1))}
                  sx={{
                    position: 'absolute',
                    right: { xs: 8, sm: 14 },
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(8px)',
                    color: 'primary.main',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                    width: { xs: 34, sm: 40 },
                    height: { xs: 34, sm: 40 },
                    transition: 'all 160ms ease',
                    '&:hover': {
                      bgcolor: '#FFFFFF',
                      transform: 'translateY(-50%) scale(1.08)',
                    },
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </IconButton>

                <IconButton
                  aria-label="banner-next"
                  onClick={() => setIndex((prev) => (prev + 1) % items.length)}
                  sx={{
                    position: 'absolute',
                    left: { xs: 8, sm: 14 },
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(8px)',
                    color: 'primary.main',
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                    width: { xs: 34, sm: 40 },
                    height: { xs: 34, sm: 40 },
                    transition: 'all 160ms ease',
                    '&:hover': {
                      bgcolor: '#FFFFFF',
                      transform: 'translateY(-50%) scale(1.08)',
                    },
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </IconButton>
              </>
            )}
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
