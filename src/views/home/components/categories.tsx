import OptimizedImage from '@/components/image';
import { SiteInfoDocument } from '@/settings/models/SiteInfo';
import { loadRootCategories, StoreCategorySummary } from '@/views/store/data';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import Link from 'next/link';

export default async function Categories({ siteInfo }: { siteInfo: SiteInfoDocument }) {
  const categories = await loadRootCategories();

  return (
    <Box sx={{ my: { xs: 4, md: 6 } }}>
      <Stack
        gap={2}
        alignItems="center"
        direction="row"
        sx={{ mb: { xs: 2.5, md: 3 } }}
      >
        <Divider sx={{ flex: '1 1 auto' }} />
        <Typography variant="h4" sx={{ fontSize: { xs: '1.3rem', md: '2rem' }, whiteSpace: 'nowrap' }}>
          ویترین
          <Typography component="span" color="secondary.main" fontWeight="bold" sx={{ fontSize: 'inherit' }}>
            {' '}
            {siteInfo.appName}
          </Typography>
        </Typography>
        <Divider sx={{ flex: '1 1 auto' }} />
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
        gridTemplateColumns: {
          xs: 'repeat(3, minmax(0, 1fr))',
          sm: 'repeat(4, minmax(0, 1fr))',
          md: 'repeat(5, minmax(0, 1fr))',
        },
        gap: { xs: 1.25, sm: 1.75, md: 2 },
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
            '&:hover .category-icon': {
              transform: 'scale(1.05)',
            },
          }}
        >
          <Box
            className="category-icon"
            sx={{
              position: 'relative',
              width: { xs: 74, sm: 88, md: 108 },
              height: { xs: 74, sm: 88, md: 108 },
              borderRadius: '50%',
              overflow: 'hidden',
              mb: 1,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              transition: 'transform 180ms ease',
            }}
          >
            <OptimizedImage
              src={category.mediaId ? '/api/media/' + category.mediaId : '/category.png'}
              alt={category.name || 'category'}
              fill
              priority={index < 5}
              fetchPriority={index < 5 ? 'high' : 'auto'}
              style={{ objectFit: 'cover' }}
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
              fontSize: { xs: '0.73rem', sm: '0.85rem' },
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
