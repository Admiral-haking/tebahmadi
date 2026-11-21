import { Box, Grid, Stack, Typography } from '@mui/material';
import { loadNewest } from './loaders';
import ProductCard, { ProductCardProps } from '@/components/product';
import MegaButton from './mega-button';

export default async function NewestProducts() {
  const products = await loadNewest();
  if (!products || products.length === 0) {
    return null;
  }

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
          <ProductCard {...item} priorityImage={index < 2} />
        </Grid>
      ))}
    </Grid>
  );
}
