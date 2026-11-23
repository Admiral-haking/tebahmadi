import { SiteInfoDocument } from '@/settings/models/SiteInfo';
import { loadRootCategories, StoreCategorySummary } from '@/views/store/data';
import { Box, Button, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import { BrandIcon } from '@/components/brand-icons';
import { resolveBrandIconName } from '@/lib/brand-icons';

export default async function Categories({ siteInfo }: { siteInfo: SiteInfoDocument }) {
  const categories = await loadRootCategories();
  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <Box sx={{ my: { xs: 3, md: 5 } }}>
      <Stack
        gap={2}
        alignItems="center"
        direction="row"
        sx={{ mb: { xs: 2.5, md: 3 } }}
      >
        <Box sx={{ flex: '1 1 auto' }}>
          <Typography variant="h3" sx={{ fontSize: { xs: '1.35rem', md: '2rem' } }}>
            دسته‌بندی محصولات
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            انتخاب سریع از محصولات طبیعی {siteInfo.appName}
          </Typography>
        </Box>
        <Button LinkComponent={Link} href="/store" variant="outlined" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
          همه محصولات
        </Button>
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
        gap: { xs: 1.5, sm: 2, md: 2.5 },
      }}
    >
      {categories.map((category) => (
        <CategoryTile
          key={category.id}
          category={category}
        />
      ))}
    </Box>
  );
}

export function getCategoryDisplayName(name: string | null | undefined, path: string | null | undefined): string {
  const trimmedName = name?.trim();
  if (trimmedName) return trimmedName;

  const segment = path
    ?.split("/")
    .map((value) => value.trim())
    .filter(Boolean)
    .pop()
    ?.replace(/[-_]+/g, " ");

  return segment ? `دسته‌بندی ${segment}` : "دسته‌بندی محصولات";
}

export function CategoryTile({ category }: { category: StoreCategorySummary }) {
  const categoryLabel = getCategoryDisplayName(category.name, category.path);
  const iconName = resolveBrandIconName(
    category.name,
    category.path,
    (category as StoreCategorySummary & { icon?: string }).icon,
  );

  return (
    <Box
      component={Button}
      LinkComponent={Link}
      href={category.path && category.path.trim().length > 0 ? '/store/' + category.path : '/store'}
      aria-label={categoryLabel}
      data-brand-icon={iconName}
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
              transform: 'translateY(-3px)',
              borderColor: 'primary.main',
            },
          }}
    >
      <Box
        className="category-icon"
        sx={{
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          width: { xs: 74, sm: 88, md: 108 },
          height: { xs: 74, sm: 88, md: 108 },
          borderRadius: { xs: 3, md: 4 },
          overflow: 'hidden',
          mb: 1,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          color: 'primary.main',
          backgroundImage: 'radial-gradient(circle at 25% 20%, rgba(197,160,89,.18), transparent 38%), linear-gradient(145deg, rgba(42,90,68,.08), rgba(249,248,246,.92))',
          boxShadow: '0 8px 24px rgba(42, 90, 68, .08)',
          transition: 'transform 180ms ease, border-color 180ms ease',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 8,
            border: '1px solid',
            borderColor: 'rgba(42,90,68,.12)',
            borderRadius: { xs: 2, md: 3 },
            pointerEvents: 'none',
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1, width: { xs: 38, sm: 46, md: 54 }, height: { xs: 38, sm: 46, md: 54 } }}>
          <BrandIcon name={iconName} size="100%" />
        </Box>
      </Box>

      <Typography
        variant="body2"
        component="p"
        sx={{
          textAlign: 'center',
          width: '100%',
          lineHeight: 1.45,
          px: 0.5,
          fontSize: { xs: '0.78rem', sm: '0.9rem' },
          fontWeight: 600,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {categoryLabel}
      </Typography>
    </Box>
  );
}
