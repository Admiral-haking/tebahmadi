"use server";

import { Container } from '@mui/material';
import { loadDiscount } from './loaders';
import DiscountClient from './discount-client';
import SectionHeading from './section-heading';

export default async function DiscountProducts() {
  const products = await loadDiscount();
  if (products.length === 0) return null;

  return (
    <Container component="section" maxWidth="lg" sx={{ my: { xs: 6, md: 9 }, px: { xs: 1.5, sm: 2 } }}>
      <SectionHeading title="پکیج‌های تخفیف‌دار" />
      <DiscountClient products={products} />
    </Container>
  );
}
