'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import useEmblaCarousel from 'embla-carousel-react';
import { Box, IconButton, Skeleton, Stack, Typography } from '@mui/material';

type SlideItem = {
  id: string;
  href: string;
  mediaId?: string;
  mediaDesktopId?: string;
  mediaMobileId?: string;
};

type SlideResponse = { data?: SlideItem[] };

const FALLBACK: SlideItem = {
  id: 'tebahmadi-fallback',
  href: '/store',
  mediaDesktopId: 'fallback',
  mediaMobileId: 'fallback',
};

const fetcher = async (url: string): Promise<SlideResponse> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to load slides');
  return response.json();
};

function sourceFor(id: string | undefined): string {
  if (!id || id === 'fallback') return '/tebahmadi-hero-botanical.webp';
  return `/api/media/${id}?type=original`;
}

export default function InstagramBannerCarousel({ initialSlides }: { initialSlides?: SlideItem[] }) {
  const { data, isLoading } = useSWR('/api/slides', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    fallbackData: initialSlides ? { data: initialSlides } : undefined,
  });
  const items = useMemo(() => {
    const valid = (data?.data ?? []).filter((slide) =>
      Boolean(slide.href && (slide.mediaDesktopId || slide.mediaMobileId || slide.mediaId)),
    );
    return valid.length > 0 ? valid : [FALLBACK];
  }, [data?.data]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ direction: 'rtl', loop: items.length > 1, align: 'center' });
  const [selected, setSelected] = useState(0);
  const syncSelected = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    syncSelected();
    emblaApi.on('select', syncSelected);
    emblaApi.on('reInit', syncSelected);
    return () => {
      emblaApi.off('select', syncSelected);
      emblaApi.off('reInit', syncSelected);
    };
  }, [emblaApi, syncSelected]);

  useEffect(() => {
    if (!emblaApi || items.length <= 1) return;
    const timer = window.setInterval(() => emblaApi.scrollNext(), 6500);
    return () => window.clearInterval(timer);
  }, [emblaApi, items.length]);

  return (
    <Box component="section" aria-label="پیشنهادهای ویژه" sx={{ py: { xs: 2, md: 4 }, overflow: 'hidden' }}>
      <Box ref={emblaRef} sx={{ overflow: 'visible', maxWidth: 1440, mx: 'auto', px: { xs: 0, md: 1 } }}>
        <Box sx={{ display: 'flex', touchAction: 'pan-y pinch-zoom', direction: 'rtl' }}>
          {items.map((slide, index) => {
            const desktopId = slide.mediaDesktopId || slide.mediaId || slide.mediaMobileId;
            const mobileId = slide.mediaMobileId || slide.mediaDesktopId || slide.mediaId;
            const fallback = slide.id === FALLBACK.id;
            return (
              <Box
                key={slide.id}
                sx={{
                  // A single fallback/managed banner is the primary hero and must
                  // use the full available width. The narrower basis is only useful
                  // when there are multiple slides and we intentionally show peeks.
                  flex: items.length === 1
                    ? '0 0 100%'
                    : { xs: '0 0 92%', sm: '0 0 78%', md: '0 0 66%' },
                  minWidth: 0,
                  px: { xs: 0.75, md: 1.25 },
                  opacity: selected === index ? 1 : 0.5,
                  transform: selected === index ? 'scale(1)' : 'scale(.955)',
                  transition: 'opacity .35s ease, transform .35s ease',
                }}
              >
                <Box
                  component={Link}
                  href={slide.href || '/store'}
                  sx={{
                    position: 'relative',
                    display: 'block',
                    overflow: 'hidden',
                    borderRadius: { xs: 5, md: 6 },
                    aspectRatio: { xs: '16 / 9', md: '16 / 8.8' },
                    bgcolor: '#f3eadb',
                  }}
                >
                  <picture>
                    <source media="(min-width: 900px)" srcSet={sourceFor(desktopId)} />
                    <img
                      src={sourceFor(mobileId)}
                      alt={fallback ? 'محصولات طبیعی طب احمدی' : `بنر ${index + 1}`}
                      fetchPriority={index === 0 ? 'high' : 'auto'}
                      loading={index === 0 ? 'eager' : 'lazy'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </picture>
                  {fallback ? (
                    <Stack
                      sx={{
                        position: 'absolute',
                        insetBlock: 0,
                        left: { xs: 18, sm: '7%' },
                        width: { xs: '48%', sm: '42%' },
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        textAlign: 'right',
                        direction: 'rtl',
                      }}
                    >
                      <Typography sx={{ color: '#2a5a44', fontSize: { xs: 11, sm: 16 }, fontWeight: 700 }}>
                        انتخابی از دل طبیعت
                      </Typography>
                      <Typography component="h1" sx={{ color: '#1f4635', fontSize: { xs: 21, sm: 36, md: 48 }, lineHeight: 1.35, fontWeight: 900, my: { xs: 0.5, sm: 1 } }}>
                        محصولات طبیعی طب احمدی
                      </Typography>
                      <Box sx={{ bgcolor: '#2a5a44', color: '#fff', borderRadius: 99, px: { xs: 1.5, sm: 2.5 }, py: { xs: 0.7, sm: 1.1 }, fontSize: { xs: 10, sm: 14 }, fontWeight: 700 }}>
                        مشاهده و خرید
                      </Box>
                    </Stack>
                  ) : null}
                  {isLoading && !data ? <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0 }} /> : null}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {items.length > 1 ? (
        <Stack direction="row" justifyContent="center" gap={0.75} sx={{ mt: 1.5 }}>
          {items.map((slide, index) => (
            <Box
              key={slide.id}
              component="button"
              type="button"
              aria-label={`نمایش بنر ${index + 1}`}
              onClick={() => emblaApi?.scrollTo(index)}
              sx={{ width: selected === index ? 22 : 7, height: 7, border: 0, p: 0, borderRadius: 99, bgcolor: selected === index ? 'primary.main' : 'primary.100', cursor: 'pointer', transition: 'width .2s ease' }}
            />
          ))}
        </Stack>
      ) : null}

      {items.length > 1 ? (
        <Stack direction="row" justifyContent="center" gap={1} sx={{ mt: 1 }}>
          <IconButton aria-label="بنر قبلی" onClick={() => emblaApi?.scrollPrev()} size="small">‹</IconButton>
          <IconButton aria-label="بنر بعدی" onClick={() => emblaApi?.scrollNext()} size="small">›</IconButton>
        </Stack>
      ) : null}
    </Box>
  );
}
