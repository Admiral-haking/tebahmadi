'use client';

import { Stack, Typography } from '@mui/material';
import { Bookmark } from 'lucide-react';

import { TEB_COLORS, TEB_RADII } from '@/theme/tokens';
import { useCart } from './useCart';
import CartLineItem from './CartLineItem';

export default function SavedCartLines() {
  const { savedLines } = useCart();
  if (savedLines.length === 0) return null;

  return (
    <Stack
      spacing={1.5}
      sx={{
        mt: 2,
        p: { xs: 1.5, md: 2 },
        border: `1px solid ${TEB_COLORS.border}`,
        borderRadius: `${TEB_RADII.md}px`,
        bgcolor: TEB_COLORS.surfaceSoft,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Bookmark size={18} color={TEB_COLORS.primary} />
        <Typography variant="subtitle2" fontWeight={800} color={TEB_COLORS.textPrimary}>
          ذخیره‌شده برای بعد
        </Typography>
        <Typography variant="caption" color="text.secondary">
          در مبلغ سفارش حساب نمی‌شود
        </Typography>
      </Stack>
      <Stack spacing={1}>
        {savedLines.map((line) => (
          <CartLineItem key={`saved-${line.variantId}`} line={line} mode="saved" />
        ))}
      </Stack>
    </Stack>
  );
}
