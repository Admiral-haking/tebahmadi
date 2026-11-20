import { SiteInfoDocument } from '@/settings/models/SiteInfo';
import { BRAND } from '@/config/brand';
import { Box, Button, InputBase, Stack, Typography } from '@mui/material';

export default function HomeSearch({ info, value }: { info?: SiteInfoDocument | null; value?: string }) {
  return (
    <Stack
      gap={{ xs: 1.5, md: 2 }}
      sx={{ mb: { xs: 3, md: 4 }, pt: { xs: 1, md: 2 } }}
      direction={{ xs: 'column', md: 'row' }}
      alignItems={{ xs: 'stretch', md: 'center' }}
    >
      <Stack gap={0.75} sx={{ width: { xs: '100%', md: 'auto' } }}>
        <Typography variant="h4" fontWeight="bold" component="p" sx={{ fontSize: { xs: '1.25rem', md: '2rem' } }}>
          دنبال چی میگردی؟
        </Typography>
        <Typography variant="subtitle2" component="p" sx={{ fontSize: { xs: '0.9rem', md: '1rem' } }}>
          محصول موردنظرتان را در فروشگاه{' '}
          <Typography variant="subtitle1" component="span" color="error.main" sx={{ fontSize: 'inherit', fontWeight: 700 }}>
            {info?.appName || BRAND.name}
          </Typography>{' '}
          پیدا کنید
        </Typography>
      </Stack>

      <Box flex="1 1 auto" sx={{ display: { xs: 'none', md: 'block' } }} />

      <Box
        sx={{
          position: 'relative',
          maxWidth: { xs: '100%', md: 360 },
          width: '100%',
        }}
      >
        <form autoComplete="off" method="get" action="/search">
          <Stack
            direction="row"
            alignItems="center"
            gap={1}
            sx={{
              overflow: 'hidden',
              transition: 'all .2s ease',
              borderRadius: 2,
              bgcolor: 'background.default',
              border: '1px solid',
              borderColor: 'divider',
              p: 0.5,
            }}
          >
            <InputBase
              placeholder="جستجو..."
              sx={{
                px: 1.25,
                py: 0.75,
                fontSize: { xs: '0.95rem', md: '1rem' },
              }}
              defaultValue={value}
              fullWidth
              name="q"
            />
            <Button type="submit" size="medium" variant="contained" sx={{ px: { xs: 1.5, md: 2 } }}>
              بگرد!
            </Button>
          </Stack>
        </form>
      </Box>
    </Stack>
  );
}
