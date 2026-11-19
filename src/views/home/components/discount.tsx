"use server";

import { Box, Container, Stack, Typography } from '@mui/material';
import { loadDiscount } from './loaders';
import DiscountClient from './discount-client';
import MegaButton from './mega-button';

export default async function DiscountProducts() {
  const products = await loadDiscount();

  return (
    <Box
      sx={{
        bgcolor: 'secondary.main',
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
          <Box
            component="svg"
            sx={{ color: 'secondary.contrastText', width: { xs: 42, sm: 56, md: 64 }, height: { xs: 42, sm: 56, md: 64 } }}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
              <path d="M6 18L18 6"></path>
              <circle cx={16.5} cy={16.5} r={2.5}></circle>
              <circle cx={7.5} cy={7.5} r={2.5}></circle>
            </g>
          </Box>
          <Stack flex="1 1 auto" sx={{ color: 'secondary.contrastText' }}>
            <Typography variant="h4" sx={{ fontSize: { xs: '1.2rem', md: '2rem' } }}>
              فروش ویژه
            </Typography>
            <Typography variant="subtitle1" sx={{ fontSize: { xs: '0.85rem', md: '1rem' } }}>
              فرصت رو از دست نده! از تخفیف های ما استفاده کن.
            </Typography>
          </Stack>
          <MegaButton color="primary" sx={{ width: { xs: '100%', sm: 'auto' } }} />
        </Stack>
      </Container>
      <DiscountClient products={products} />
    </Box>
  );
}
