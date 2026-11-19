import SearchBox from '@/components/search';
import { Box, Divider, Stack, Typography } from '@mui/material';

import StoreFilters from './filters';
import type { StoreCategoryContext } from '../data';
import type { StoreViewSearchParams } from '..';
import Image from 'next/image';

function extractSearchValue(searchParams: StoreViewSearchParams): string {
  const raw = searchParams.q;
  if (Array.isArray(raw)) {
    return raw[0] ?? '';
  }
  return raw ?? '';
}

function buildBreadcrumbLabel(category: StoreCategoryContext): string | null {
  if (category.breadcrumbs.length <= 1) {
    return null;
  }
  return category.breadcrumbs.map((crumb) => crumb.name).join(' / ');
}

export default function Hero({
  category,
  searchParams,
  siteTitle,
}: {
  category: StoreCategoryContext;
  searchParams: StoreViewSearchParams;
  siteTitle?: string;
}) {
  const searchValue = extractSearchValue(searchParams);
  const breadcrumb = buildBreadcrumbLabel(category);
  const searchUrl = '/store/' + category.active.path;

  return (
    <Stack gap={{ xs: 1.5, md: 2 }} alignItems={{ xs: 'stretch', md: 'center' }} direction={{ xs: 'column', md: 'row' }}>
      <Stack
        direction="row"
        gap={{ xs: 1.25, md: 2 }}
        alignItems="center"
        sx={{ flex: '1 1 auto', width: { xs: '100%', md: 'initial' } }}
      >
        <Box
          sx={{
            position: 'relative',
            width: { xs: 62, sm: 76 },
            height: { xs: 62, sm: 76 },
            borderRadius: '50%',
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
            bgcolor: 'background.paper',
          }}
        >
          <Image
            alt={category.active.name}
            src={category.mediaId ? '/api/media/' + category.mediaId : '/category.png'}
            fill
            sizes="(max-width: 600px) 62px, 76px"
            style={{ objectFit: 'cover' }}
          />
        </Box>

        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
          {siteTitle && (
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>
              {siteTitle}
            </Typography>
          )}
          <Typography variant="h4" sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem', md: '2rem' } }}>
            {category.active.name}
          </Typography>
          {breadcrumb && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {breadcrumb}
            </Typography>
          )}
        </Box>

        <Divider sx={{ flex: '1 1 auto', display: { xs: 'none', md: 'block' } }} />
      </Stack>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={1.5}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={{ width: { xs: '100%', md: 'initial' } }}
      >
        <StoreFilters attributes={category.filterAttributes} searchParams={searchParams} />
        <SearchBox
          boxSx={{ width: '100%', minWidth: { xs: '100%', sm: 300 }, maxWidth: { xs: '100%', sm: 340 } }}
          onSearchUrl={searchUrl}
          initialQuery={searchValue}
          alwaysShowSearch
          preserveQueryParams
        />
      </Stack>
    </Stack>
  );
}
