import { Box, Stack, Typography } from '@mui/material';
import Logo from '@/components/logo';
import SearchBox from '@/components/search';
import { loadCategoryTree } from '@/lib/cache';
import MegaMenuMobile from '../components/mega-menu-mobile';
import { glassSurface } from '@/theme/design-system';

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
      <Stack direction="row" alignItems="center" gap={1.25} sx={{ width: '100%', px: { xs: 1.5, sm: 2 }, py: 1.25, minWidth: 0 }}>
        <Logo size={46} showName />
        <SearchBox onSearchUrl="/search" alwaysShowSearch boxSx={{ flex: 1, minWidth: 0 }} />
        <MegaMenuMobile categories={JSON.parse(JSON.stringify(categories as any))} />
      </Stack>
      <Stack direction="row" justifyContent="center" alignItems="center" gap={1} sx={{ minHeight: 46, px: 2, borderTop: '1px solid', borderColor: 'divider', color: 'primary.main' }}>
        <Box component="span" sx={{ width: 24, height: 24, border: '1px solid', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800 }}>i</Box>
        <Typography sx={{ fontSize: 12.5 }}>زمان آماده‌سازی و ارسال سفارش‌ها: <b>۳ تا ۷ روز کاری</b></Typography>
      </Stack>
    </Stack>
  );
}
