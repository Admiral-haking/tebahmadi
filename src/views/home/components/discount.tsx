"use server";

import { Box, Container, Stack, Typography } from '@mui/material';
import { loadDiscount } from './loaders';
import DiscountClient from './discount-client';
import MegaButton from './mega-button';

export default async function DiscountProducts() {
  const products = await loadDiscount();

  return (
    <Container component="section" maxWidth="lg" sx={{ my: { xs: 3, md: 5 }, px: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: { xs: 5, md: 8 }, py: { xs: 2.5, md: 4 }, overflow: 'hidden' }}>
      <Box sx={{ px: { xs: 2, md: 4 } }}>
        <Stack
          direction="row"
          gap={{ xs: 1.25, sm: 2 }}
          alignItems="center"
        >
          <Box
            component="svg"
            sx={{ color: 'secondary.main', width: { xs: 36, sm: 48 }, height: { xs: 36, sm: 48 }, flexShrink: 0 }}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
              <path d="M6 18L18 6"></path>
              <circle cx={16.5} cy={16.5} r={2.5}></circle>
              <circle cx={7.5} cy={7.5} r={2.5}></circle>
            </g>
          </Box>
          <Stack flex="1 1 auto">
            <Typography variant="h3" sx={{ fontSize: { xs: '1.25rem', md: '2rem' } }}>
              فروش ویژه
            </Typography>
            <Typography variant="body2" sx={{ opacity: .78, display: { xs: 'none', sm: 'block' } }}>
              پیشنهادهای محدود با قیمت بهتر
            </Typography>
          </Stack>
          <MegaButton color="secondary" sx={{ flexShrink: 0 }} />
        </Stack>
      </Box>
      {products.length > 0 ? (
        <DiscountClient products={products} />
      ) : (
        <Box
          sx={{
            mx: { xs: 2, md: 4 },
            mt: { xs: 2, md: 3 },
            px: 2,
            py: { xs: 2.5, md: 3 },
            border: '1px dashed rgba(255,255,255,.45)',
            borderRadius: { xs: 2, md: 3 },
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" sx={{ opacity: .86 }}>
            فعلاً محصول تخفیف‌دار فعالی ثبت نشده است.
          </Typography>
        </Box>
      )}
      </Box>
    </Container>
  );
}
