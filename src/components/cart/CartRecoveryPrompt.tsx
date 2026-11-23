'use client';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCart } from './useCart';
import {
  CART_RECOVERY_DISMISSED_UNTIL_STORAGE_KEY,
  CART_UPDATED_AT_STORAGE_KEY,
} from './CartProvider';
import { TEB_COLORS, TEB_RADII } from '@/theme/tokens';

const RECOVERY_AFTER_MS = 30 * 60 * 1000;
const DISMISS_FOR_MS = 6 * 60 * 60 * 1000;

function formatRelativeMinutes(updatedAt: number): string {
  const diffMinutes = Math.max(1, Math.round((Date.now() - updatedAt) / 60000));
  if (diffMinutes < 60) {
    return `${new Intl.NumberFormat('fa-IR').format(diffMinutes)} دقیقه قبل`;
  }
  const diffHours = Math.max(1, Math.round(diffMinutes / 60));
  return `${new Intl.NumberFormat('fa-IR').format(diffHours)} ساعت قبل`;
}

export default function CartRecoveryPrompt() {
  const { lines, itemsCount } = useCart();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [updatedLabel, setUpdatedLabel] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!lines.length || pathname === '/cart') {
      setVisible(false);
      return;
    }

    const dismissedUntil = Number(
      window.localStorage.getItem(CART_RECOVERY_DISMISSED_UNTIL_STORAGE_KEY) ?? 0,
    );
    if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) {
      setVisible(false);
      return;
    }

    const updatedAt = Number(window.localStorage.getItem(CART_UPDATED_AT_STORAGE_KEY) ?? 0);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0 || Date.now() - updatedAt < RECOVERY_AFTER_MS) {
      setVisible(false);
      return;
    }

    setUpdatedLabel(formatRelativeMinutes(updatedAt));
    setVisible(true);
  }, [lines.length, pathname]);

  if (!visible || !lines.length) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        left: { xs: 12, md: 24 },
        right: { xs: 12, md: 'auto' },
        bottom: { xs: 12, md: 24 },
        zIndex: 1400,
        width: { xs: 'auto', md: 360 },
      }}
    >
      <Stack
        spacing={1}
        sx={{
          p: 1.5,
          borderRadius: `${TEB_RADII.md}px`,
          border: `1px solid ${TEB_COLORS.border}`,
          bgcolor: TEB_COLORS.surface,
          boxShadow: '0 12px 36px rgba(0 0 0 / 0.12)',
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <ShoppingBagOutlinedIcon sx={{ color: TEB_COLORS.primary }} fontSize="small" />
            <Box>
              <Typography fontWeight={700}>سبد خرید شما هنوز محفوظ است</Typography>
              <Typography variant="body2" color="text.secondary">
                {new Intl.NumberFormat('fa-IR').format(itemsCount)} آیتم از {updatedLabel} در سبد شما مانده است.
              </Typography>
            </Box>
          </Stack>
          <IconButton
            aria-label="بستن یادآور سبد خرید"
            onClick={() => {
              window.localStorage.setItem(
                CART_RECOVERY_DISMISSED_UNTIL_STORAGE_KEY,
                String(Date.now() + DISMISS_FOR_MS),
              );
              setVisible(false);
            }}
            sx={{
              width: 40,
              height: 40,
              flexShrink: 0,
              border: `1px solid ${TEB_COLORS.border}`,
              bgcolor: TEB_COLORS.background,
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Stack>
        <Button
          component={Link}
          href="/cart"
          variant="contained"
          fullWidth
          sx={{ bgcolor: TEB_COLORS.primary, '&:hover': { bgcolor: TEB_COLORS.primaryDark } }}
        >
          بازگشت به سبد خرید
        </Button>
      </Stack>
    </Box>
  );
}
