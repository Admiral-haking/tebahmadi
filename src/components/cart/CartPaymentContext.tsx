'use client';

import { Box, Button, Grid, Paper, Stack, Typography } from '@mui/material';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';

import { TEB_COLORS, TEB_RADII } from '@/theme/tokens';

type CartPaymentContextProps = {
  addressSummary: string;
  shippingSummary: string;
  onEditShipping: () => void;
};

export default function CartPaymentContext({
  addressSummary,
  shippingSummary,
  onEditShipping,
}: CartPaymentContextProps) {
  return (
    <Grid size={{ xs: 12, md: 4 }} sx={{ display: { xs: 'none', md: 'block' } }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1, md: 1.6 },
          borderRadius: `${TEB_RADII.lg}px`,
          border: `1px solid ${TEB_COLORS.border}`,
          bgcolor: '#FFFFFF',
        }}
      >
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Stack
            gap={0.5}
            sx={{
              p: 1.25,
              borderRadius: `${TEB_RADII.md}px`,
              border: `1px solid ${TEB_COLORS.border}`,
              bgcolor: TEB_COLORS.background,
            }}
          >
            <Stack direction="row" alignItems="center" gap={0.75}>
              <LocationOnRoundedIcon sx={{ color: TEB_COLORS.primary }} fontSize="small" />
              <Typography variant="body2" fontWeight={800}>
                آدرس تحویل
              </Typography>
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                lineHeight: 1.8,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {addressSummary || 'آدرس ثبت نشده است.'}
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={onEditShipping}
              sx={{ alignSelf: 'flex-start', minHeight: 40, px: 1, fontWeight: 800, color: TEB_COLORS.primary }}
            >
              اصلاح آدرس و ارسال
            </Button>
          </Stack>

          <Stack
            gap={0.5}
            sx={{
              p: 1.25,
              borderRadius: `${TEB_RADII.md}px`,
              border: `1px solid ${TEB_COLORS.border}`,
              bgcolor: TEB_COLORS.background,
            }}
          >
            <Stack direction="row" alignItems="center" gap={0.75}>
              <LocalShippingRoundedIcon sx={{ color: TEB_COLORS.primary }} fontSize="small" />
              <Typography variant="body2" fontWeight={800}>
                ارسال
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              {shippingSummary}
            </Typography>
          </Stack>
        </Box>
      </Paper>
    </Grid>
  );
}
