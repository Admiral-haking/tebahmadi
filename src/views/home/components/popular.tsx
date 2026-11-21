"use server";

import { Box, Container } from '@mui/material';
import { loadPopular } from './loaders';
import DiscountClient from './discount-client';
import SectionHeading from './section-heading';

export default async function PopularProducts() {
  const products = await loadPopular();
  if (products.length === 0) return null;

  return (
    <Box component="section" sx={{ width: '100%', my: { xs: 6, md: 9 } }}>
      <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 2 } }}>
        <SectionHeading title="پرفروش‌ترین محصولات" />
      </Container>
      <DiscountClient products={products} />
    </Box>
  );
}
