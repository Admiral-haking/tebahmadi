"use server";

import { Box, Container, Stack, Typography } from '@mui/material';
import { loadPopular } from './loaders';
import DiscountClient from './discount-client';
import MegaButton from './mega-button';

export default async function PopularProducts() {
  const products = await loadPopular();

  return (
    <Box
      sx={{
        width: '100%',
        my: { xs: 3, md: 4 },
        py: { xs: 2, md: 2.5 },
        minHeight: 250,
      }}
    >
      <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 2 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          gap={{ xs: 1.5, sm: 2 }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <Box component="svg" sx={{ width: { xs: 42, sm: 56, md: 64 }, height: { xs: 42, sm: 56, md: 64 } }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
              <path d="M3 20h18"></path>
              <rect width={13} height={4} x={6} y={17} fill="currentColor" rx={2} transform="rotate(-90 6 17)"></rect>
              <rect width={9} height={4} x={14} y={17} fill="currentColor" rx={2} transform="rotate(-90 14 17)"></rect>
            </g>
          </Box>
          <Stack flex="1 1 auto">
            <Typography variant="h4" sx={{ fontSize: { xs: '1.2rem', md: '2rem' } }}>
              پرفروش ترین
            </Typography>
            <Typography variant="subtitle1" sx={{ fontSize: { xs: '0.85rem', md: '1rem' } }}>
              از بازار جا نمونی!
            </Typography>
          </Stack>
          <MegaButton color="primary" sx={{ width: { xs: '100%', sm: 'auto' } }} />
        </Stack>
      </Container>
      <DiscountClient products={products} />
    </Box>
  );
}
