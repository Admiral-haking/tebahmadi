import Logo from '@/components/logo';
import SearchBox from '@/components/search';
import { loadCategoryTree } from '@/lib/cache';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import CartButton from '../components/cart-button';
import DesktopMenu from '../components/desktop-menu';
import MegaMenu from '../components/mega-menu';
import UserButton from '../components/user-button';
import { glassSurface } from '@/theme/design-system';

export default async function HeaderDesktop() {
  const categories = await loadCategoryTree();

  return (
    <Box
      component="header"
      sx={{
        display: { xs: 'none', md: 'block' },
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        ...glassSurface,
        bgcolor: 'rgba(255,255,255,.96)',
        borderInline: 0,
        borderTop: 0,
      }}
    >
      <Container maxWidth="lg">
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ minHeight: 94 }}>
          <Logo size={64} showName />
          <MegaMenu categories={JSON.parse(JSON.stringify(categories as any))} />
          <SearchBox onSearchUrl="/search" alwaysShowSearch boxSx={{ width: 350, maxWidth: 350 }} />
          <Box flex="1 1 auto" />
          <Button component={Link} href="/page/contact" variant="outlined" sx={{ minHeight: 48, bgcolor: '#f7f6eb' }}>
            پشتیبانی
          </Button>
          <UserButton />
          <CartButton />
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ minHeight: 56, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" gap={1} sx={{ color: 'primary.main' }}>
            <Box component="span" sx={{ width: 26, height: 26, border: '1px solid', borderColor: 'primary.200', borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800 }}>i</Box>
            <Typography sx={{ fontSize: 14 }}>زمان آماده‌سازی و ارسال سفارش‌ها: <b>۳ تا ۷ روز کاری</b></Typography>
          </Stack>
          <DesktopMenu />
        </Stack>
      </Container>
    </Box>
  );
}
