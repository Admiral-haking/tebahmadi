import { Box, Grid, Stack, Typography } from '@mui/material';
import { loadNewest } from './loaders';
import Link from 'next/link';
import type { ProductCardProps } from '@/components/product';
import MegaButton from './mega-button';

export default async function NewestProducts() {
  const products = await loadNewest();

  return (
    <Box component="section" sx={{ my: { xs: 4, md: 7 } }}>
      <Stack gap={2} alignItems="center" direction="row" justifyContent="space-between">
        <Box>
          <Typography variant="h3" sx={{ fontSize: { xs: '1.35rem', md: '2rem' } }}>
            جدیدترین محصولات
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            تازه‌ترین انتخاب‌های طبیعی فروشگاه
          </Typography>
        </Box>
        <MegaButton variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
      </Stack>

      <ProductGrid products={products} />

      <Stack alignItems="center" justifyContent="center" sx={{ display: { xs: 'flex', sm: 'none' }, mt: 2 }}>
        <MegaButton variant="outlined" fullWidth />
      </Stack>
    </Box>
  );
}

async function ProductGrid({ products }: { products: ProductCardProps[] }) {
  return (
    <Grid container spacing={{ xs: 1.25, sm: 2, md: 2.5 }} sx={{ my: { xs: 2.5, md: 4 } }}>
      {products?.map((item, index) => (
        <Grid key={item.id} size={{ xs: 6, sm: 4, md: 3 }}>
          <Link href={`/product/${item.slug}`} style={{ display: 'block', height: '100%', color: 'inherit' }}>
            <Box sx={{ height: '100%', overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: { xs: 3, md: 4 }, bgcolor: 'background.paper', transition: 'transform .2s ease, box-shadow .2s ease', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 14px 30px rgba(42,90,68,.12)' } }}>
              <Box component="img" src={item.imageUrl ?? '/product-placeholder.svg'} alt={item.title} loading={index < 2 ? 'eager' : 'lazy'} sx={{ display: 'block', width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', bgcolor: 'rgba(42,90,68,.06)' }} />
              <Box sx={{ p: { xs: 1.25, md: 1.75 } }}>
                <Typography sx={{ fontWeight: 700, lineHeight: 1.7, minHeight: { xs: 44, md: 52 } }}>{item.title}</Typography>
                <Typography color="primary.main" sx={{ mt: 1, fontWeight: 800 }}>{new Intl.NumberFormat('fa-IR').format(item.finalPrice)} تومان</Typography>
              </Box>
            </Box>
          </Link>
        </Grid>
      ))}
    </Grid>
  );
}
