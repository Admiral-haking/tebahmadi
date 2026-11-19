'use client';

import { useEffect, useMemo, useState } from 'react';
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
    <Box sx={{ width: '100%', py: { xs: 1, md: 1.5 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 0, sm: 2 } }}>
        <Stack alignItems="center" gap={1.25} sx={{ width: '100%', position: 'relative', overflow: 'hidden' }}>
          <Link href={href} style={{ textDecoration: 'none', display: 'block', width: '100%' }}>
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                aspectRatio: { xs: '16 / 9', sm: '16 / 6.2', md: '16 / 6', lg: '16 / 5.8' },
                minHeight: { xs: 168, sm: 188, md: 250, lg: 285 },
                maxHeight: { xs: 260, sm: 320, md: 420, lg: 460 },
                borderRadius: 0,
                overflow: 'hidden',
                bgcolor: 'background.default',
              }}
            >
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
                    objectFit: "contain",
                    display: 'block',
                    backgroundColor: 'transparent',
                  }}
                />
              </picture>

              {!active && !isLoading && (
                <Box
                  component="img"
                  src={FALLBACK_SRC}
                  alt="home-banner"
                  sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: "contain" }}
                />
              )}

              {isLoading && !active && (
                <Skeleton
                  variant="rectangular"
                  sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(var(--mui-palette-common-backgroundChannel) / 0.2)' }}
                />
              )}
            </Box>
          </Link>

          {hasDots && (
            <Stack direction="row" spacing={1}>
              {items.map((item, idx) => (
                <Box
                  key={item.id}
                  onClick={() => setIndex(idx)}
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    cursor: 'pointer',
                    transition: 'opacity 150ms ease',
                    opacity: idx === index ? 1 : 0.35,
                  }}
                />
              ))}
            </Stack>
          )}

          {items.length > 1 && (
            <>
              <Stack
                alignItems="center"
                justifyContent="center"
                sx={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 18,
                  zIndex: 2,
                }}
              >
                <IconButton
                  aria-label="banner-prev"
                  sx={{ bgcolor: 'background.paper' }}
                  onClick={() => setIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1))}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width={28} height={28} viewBox="0 0 16 16">
                    <path fill="currentColor" fillRule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5"></path>
                  </svg>
                </IconButton>
              </Stack>

              <Stack
                alignItems="center"
                justifyContent="center"
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 18,
                  zIndex: 2,
                }}
              >
                <IconButton
                  aria-label="banner-next"
                  sx={{ bgcolor: 'background.paper' }}
                  onClick={() => setIndex((prev) => (prev + 1) % items.length)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width={28} height={28} viewBox="0 0 16 16">
                    <path fill="currentColor" fillRule="evenodd" d="M4 8a.5.5 0 0 1 .5-.5h5.793L8.146 5.354a.5.5 0 1 1 .708-.708l3 3a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708-.708L10.293 8.5H4.5A.5.5 0 0 1 4 8"></path>
                  </svg>
                </IconButton>
              </Stack>
            </>
          )}

          {error && (
            <Skeleton
              variant="text"
              width={180}
              sx={{ bgcolor: 'rgba(var(--mui-palette-common-backgroundChannel) / 0.5)', fontSize: 12, textAlign: 'center' }}
            />
          )}
        </Stack>
      </Container>
    </Box>
  );
}
