import { Box, Stack, Typography } from '@mui/material';
import Logo from '@/components/logo';
import SearchBox from '@/components/search';
import { loadCategoryTree } from '@/lib/cache';
import MegaMenuMobile from '../components/mega-menu-mobile';
import { glassSurface } from '@/theme/design-system';
import { BrandIcon } from '@/components/brand-icons';

export default async function HeaderMobile({ title: _title }: { title: string }) {
  const categories = await loadCategoryTree();

  return (
    <Stack
      component="header"
      sx={{
        display: { xs: 'flex', md: 'none' },
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        ...glassSurface,
        bgcolor: 'rgba(255,255,255,.97)',
        borderInline: 0,
        borderTop: 0,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          width: '100%',
          px: { xs: 1, sm: 2 },
          py: { xs: 1, sm: 1.25 },
          minWidth: 0,
          display: 'flex',
          flexDirection: 'row-reverse',
          gap: { xs: 0.75, sm: 1.25 },
          direction: 'rtl',
        }}
      >
        <Box sx={{ width: 40, height: 40, flex: '0 0 40px', order: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
          <MegaMenuMobile categories={JSON.parse(JSON.stringify(categories as any))} />
        </Box>
        <SearchBox
          onSearchUrl="/search"
          alwaysShowSearch
          leadingIcon={<BrandIcon name="search" size={24} />}
          boxSx={{
            width: 'auto',
            flex: 1,
            order: 2,
            maxWidth: 'none',
            minWidth: 0,
            '& button': { display: { xs: 'none', sm: 'inline-flex' } },
          }}
        />
        <Box sx={{ minWidth: 0, order: 3, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Logo size={40} />
        </Box>
      </Stack>
      <Stack direction="row" justifyContent="center" alignItems="center" gap={0.75} sx={{ minHeight: 44, px: { xs: 1, sm: 2 }, minWidth: 0, borderTop: '1px solid', borderColor: 'divider', color: 'primary.main' }}>
        <Box component="span" sx={{ width: 24, height: 24, border: '1px solid', borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'primary.main' }}>
          <BrandIcon name="info" size={15} />
        </Box>
        <Typography sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', fontSize: { xs: 11.5, sm: 12.5 } }}>زمان آماده‌سازی و ارسال سفارش‌ها: <b>۳ تا ۷ روز کاری</b></Typography>
      </Stack>
    </Stack>
  );
}
