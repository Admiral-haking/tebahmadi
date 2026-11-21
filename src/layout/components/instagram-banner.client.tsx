'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getImageProps } from 'next/image';
import Link from 'next/link';
import useSWR from 'swr';
import { Box, Container, IconButton, Skeleton, Stack } from '@mui/material';

type SlideItem = {
  id: string;
  href: string;
  mediaId?: string;
  mediaDesktopId?: string;
  mediaMobileId?: string;
};

type SlideResponse = {
  data?: SlideItem[];
};

const FALLBACK_SRC = '/banner.png';
const DESKTOP_BREAKPOINT = '(min-width: 900px)';

const fetcher = async (url: string): Promise<SlideResponse> => {
  const response = await fetch(url);
  if (!response.ok) {
    const message = (await response.text().catch(() => '')) || response.statusText;
    throw new Error(message || 'Failed to load slides');
  }
  return response.json();
};

export default function InstagramBannerCarousel({ initialSlides }: { initialSlides?: SlideItem[] }) {
  const { data, error, isLoading } = useSWR('/api/slides', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    fallbackData: initialSlides ? { data: initialSlides } : undefined,
  });
  const [index, setIndex] = useState(0);

  const items = useMemo<SlideItem[]>(() => {
    const list = data?.data ?? [];
    return list.filter((slide) => {
      const hasMedia = Boolean(slide.mediaDesktopId || slide.mediaMobileId || slide.mediaId);
      return hasMedia && Boolean(slide.href);
    });
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

  const active = items[index] ?? null;
  const desktopId = active?.mediaDesktopId || active?.mediaId || active?.mediaMobileId || '';
  const mobileId = active?.mediaMobileId || active?.mediaDesktopId || active?.mediaId || '';
  const desktopSrc = desktopId ? '/api/media/' + desktopId + '?type=original' : FALLBACK_SRC;
  const mobileSrc = mobileId ? '/api/media/' + mobileId + '?type=original' : desktopSrc;
  const href = active?.href || '/store';

  const common = {
    alt: active ? 'slide-' + active.id : 'home-banner',
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
            sx={{
              position: 'relative',
              width: '100%',
              aspectRatio: { xs: '16 / 9', sm: '16 / 7.5', md: '21 / 9', lg: '2.4 / 1' },
              minHeight: { xs: 180, sm: 220, md: 280, lg: 320 },
              maxHeight: { xs: 280, sm: 360, md: 440, lg: 480 },
              borderRadius: { xs: 3, sm: 4, md: 5 },
              overflow: 'hidden',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 10px 32px rgba(42, 90, 68, 0.08)',
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
                    display: 'block',
                    backgroundColor: 'transparent',
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
                  bgcolor: 'rgba(0, 0, 0, 0.3)',
                  backdropFilter: 'blur(8px)',
                  px: 1.25,
                  py: 0.5,
                  borderRadius: '9999px',
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
                      borderRadius: '9999px',
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
                    bgcolor: 'rgba(255, 255, 255, 0.88)',
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
                  <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 16 16">
                    <path fill="currentColor" fillRule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5"></path>
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
                    bgcolor: 'rgba(255, 255, 255, 0.88)',
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
                  <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 16 16">
                    <path fill="currentColor" fillRule="evenodd" d="M4 8a.5.5 0 0 1 .5-.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5A.5.5 0 0 1 4 8"></path>
                  </svg>
                </IconButton>
              </>
            )}
          </Box>

          {error && (
            <Skeleton
              variant="text"
              width={180}
              sx={{ bgcolor: 'rgba(var(--mui-palette-common-backgroundChannel) / 0.5)', fontSize: 12, textAlign: 'center', mt: 1 }}
            />
          )}
        </Stack>
      </Container>
    </Box>
  );
}
