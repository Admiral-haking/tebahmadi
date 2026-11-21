import OptimizedImage from '@/components/image';
import { SiteInfoDocument } from '@/settings/models/SiteInfo';
import { loadRootCategories, StoreCategorySummary } from '@/views/store/data';
import { Box, Button, Stack, Typography } from '@mui/material';
import Link from 'next/link';

export default async function Categories({ siteInfo }: { siteInfo: SiteInfoDocument }) {
  const categories = await loadRootCategories();

  return (
    <Box sx={{ my: { xs: 5, md: 8 } }}>
      <Stack
        gap={0.75}
        alignItems="center"
        sx={{ mb: { xs: 3, md: 4 } }}
      >
        <Box aria-hidden sx={{ width: 34, height: 18, position: 'relative', mb: 0.5, '&::before': { content: '""', position: 'absolute', inset: 0, background: 'repeating-conic-gradient(from 0deg, #b69a68 0deg 8deg, transparent 8deg 22deg)', mask: 'radial-gradient(circle, transparent 0 5px, #000 6px)' } }} />
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h3" sx={{ fontSize: { xs: '1.45rem', md: '1.75rem' }, color: 'primary.main' }}>
            دسته‌بندی محصولات
          </Typography>
        </Box>
      </Stack>

      <CategoryGrid categories={categories} />
    </Box>
  );
}

async function CategoryGrid({ categories }: { categories: StoreCategorySummary[] }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
        gap: { xs: 1.5, sm: 2, md: 2.25 },
      }}
    >
      {categories.map((category, index) => (
        <Box
          key={category.id}
          component={Button}
          LinkComponent={Link}
          href={category.path && category.path.trim().length > 0 ? '/store/' + category.path : '/store'}
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            textTransform: 'none',
            color: 'text.primary',
            p: 0,
            minWidth: 0,
            '&:hover .category-icon': { transform: 'translateY(-3px)', borderColor: 'primary.main', bgcolor: '#f0f1de' },
          }}
        >
          <Box
            className="category-icon"
            sx={{
              position: 'relative',
              width: '100%',
              aspectRatio: { xs: '1 / 1', sm: '2.35 / 1' },
              maxWidth: { xs: 108, sm: 'none' },
              borderRadius: { xs: '50%', sm: 999 },
              overflow: 'hidden',
              mb: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: '#f6f4e8',
              boxShadow: 'none',
              transition: 'transform 180ms ease, border-color 180ms ease',
            }}
          >
            <OptimizedImage
              src={category.mediaId ? '/api/media/' + category.mediaId : '/category.png'}
              alt={category.name || 'category'}
              fill
              priority={index < 5}
              fetchPriority={index < 5 ? 'high' : 'auto'}
              style={{ objectFit: 'contain', padding: '12%' }}
            />
          </Box>

          <Typography
            variant="body2"
            component="p"
            sx={{
              textAlign: 'center',
              width: '100%',
              lineHeight: 1.45,
              px: 0.5,
              fontSize: { xs: '0.72rem', sm: '0.9rem' },
              fontWeight: 500,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {category.name}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
