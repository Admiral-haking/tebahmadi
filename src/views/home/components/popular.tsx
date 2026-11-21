"use server";

import { Box, Container, Stack, Typography } from '@mui/material';
import { loadPopular } from './loaders';
import DiscountClient from './discount-client';
import MegaButton from './mega-button';

export default async function PopularProducts() {
  const products = await loadPopular();

  return (
    <Box component="section"
      sx={{
        width: '100%',
        my: { xs: 3, md: 5 },
        py: { xs: 2.5, md: 4 },
        minHeight: 250,
        bgcolor: 'rgba(42, 90, 68, .055)',
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2 } }}>
        <Stack
          direction="row"
          gap={{ xs: 1.5, sm: 2 }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <Box component="svg" sx={{ color: 'secondary.main', width: { xs: 36, sm: 48 }, height: { xs: 36, sm: 48 }, flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
              <path d="M3 20h18"></path>
              <rect width={13} height={4} x={6} y={17} fill="currentColor" rx={2} transform="rotate(-90 6 17)"></rect>
              <rect width={9} height={4} x={14} y={17} fill="currentColor" rx={2} transform="rotate(-90 14 17)"></rect>
            </g>
          </Box>
          <Stack flex="1 1 auto">
            <Typography variant="h3" sx={{ fontSize: { xs: '1.25rem', md: '2rem' } }}>
              پرفروش‌ترین محصولات
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              انتخاب‌های محبوب مشتریان طب احمدی
            </Typography>
          </Stack>
          <MegaButton color="primary" sx={{ flexShrink: 0 }} />
        </Stack>
      </Container>
      <DiscountClient products={products} />
    </Box>
  );
}
