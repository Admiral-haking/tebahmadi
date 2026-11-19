import { Box, Divider, Grid, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import OptimizedImage from '@/components/image';
import { loadNewest } from './loaders';
import { ProductCardProps } from '@/components/product';
import MegaButton from './mega-button';

const CURRENCY_LABEL = 'تومان';
const FALLBACK_IMAGE = '/sample.jpg';

function formatPrice(value: number): string {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(normalized);
}

export default async function NewestProducts() {
  const products = await loadNewest();

  return (
    <Box sx={{ my: { xs: 4, md: 6 } }}>
      <Stack gap={2} alignItems="center" direction="row">
        <Divider sx={{ flex: '1 1 auto' }} />
        <Typography variant="h4" sx={{ fontSize: { xs: '1.3rem', md: '2rem' } }}>
          جدیدترین
          <Typography variant="h4" component="span" color="secondary.main" fontWeight="bold" sx={{ fontSize: 'inherit' }}>
            {' '}
            محصولات
          </Typography>
        </Typography>

        <Divider sx={{ flex: '1 1 auto' }} />
      </Stack>

      <ProductGrid products={products} />

      <Stack alignItems="center" justifyContent="center" sx={{ mt: { xs: 1, md: 2 } }}>
        <MegaButton />
      </Stack>
    </Box>
  );
}

async function ProductGrid({ products }: { products: ProductCardProps[] }) {
  return (
    <Grid container spacing={{ xs: 1.25, sm: 1.75 }} sx={{ my: { xs: 2.5, md: 4 } }}>
      {products?.map((item, index) => (
        <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
          <Box
            component={Link}
            href={'/product/' + item.slug}
            sx={{
              position: 'relative',
              display: 'flex',
              alignItems: 'stretch',
              minHeight: { xs: 104, sm: 94 },
              color: 'text.primary',
              borderColor: 'divider',
              borderWidth: 1,
              borderStyle: 'solid',
              borderRadius: 2,
              overflow: 'hidden',
              height: '100%',
              textDecoration: 'none',
              bgcolor: 'background.paper',
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: { xs: 102, sm: 92 },
                minWidth: { xs: 102, sm: 92 },
                height: { xs: 102, sm: 92 },
                minHeight: { xs: 102, sm: 92 },
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <OptimizedImage
                src={item.imageUrl || FALLBACK_IMAGE}
                alt={item.title || 'product image'}
                fill
                priority={index < 2}
                fetchPriority={index < 2 ? 'high' : 'auto'}
                loading={index < 2 ? undefined : 'lazy'}
                sizes="(max-width: 600px) 102px, 92px"
                style={{ objectFit: 'cover' }}
              />
            </Box>

            <Box
              sx={{
                flex: '1 1 auto',
                pr: 1.25,
                pl: 0.25,
                py: 1,
                minWidth: 0,
              }}
            >
              <Typography
                variant="caption"
                component="p"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.45,
                  fontSize: { xs: '0.78rem', sm: '0.76rem' },
                }}
              >
                {item.title}
              </Typography>
              <Stack direction="row" aria-label="product price" justifyContent="space-between" alignItems="baseline" spacing={1} sx={{ mt: 0.75, flexWrap: 'wrap' }}>
                {!!item.originalPrice && item.originalPrice > item.finalPrice && (
                  <Typography variant="caption" sx={{ textDecoration: 'line-through', opacity: 0.7 }} color="text.secondary">
                    {formatPrice(item.originalPrice)}{' '}
                    <Typography variant="caption" component="span" aria-label="price" color="text.secondary">
                      {CURRENCY_LABEL}
                    </Typography>
                  </Typography>
                )}
                <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
                  {formatPrice(item.finalPrice)}{' '}
                  <Typography variant="caption" component="span" aria-label="price" color="text.secondary">
                    {CURRENCY_LABEL}
                  </Typography>
                </Typography>
              </Stack>
            </Box>
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}
