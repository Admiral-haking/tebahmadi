'use client';

import { useEffect, type ReactNode } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { useAuth } from './auth-context';
import { useLoginDialog } from './login-dialog';

interface AuthGuardProps extends ChildrenProps {
  /** @deprecated kept for compatibility — the inline login modal is used now. */
  redirectTo?: string;
  fallback?: ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { user, status, isLoading } = useAuth();
  const { openLogin } = useLoginDialog();
  const loading = isLoading || status === 'loading' || status === 'idle';

  // Open the inline login modal instead of navigating away; the page renders as
  // soon as the user signs in (no round-trip to /auth and back).
  useEffect(() => {
    if (!loading && !user) {
      openLogin();
    }
  }, [loading, user, openLogin]);

  if (loading) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="50vh">
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!user) {
    if (fallback) return <>{fallback}</>;
    return (
      <Stack alignItems="center" justifyContent="center" spacing={2} minHeight="50vh" textAlign="center" sx={{ px: 2 }}>
        <LockRoundedIcon color="primary" sx={{ fontSize: 44 }} />
        <Typography variant="h6" fontWeight={800}>برای مشاهدهٔ این بخش وارد شوید</Typography>
        <Button variant="contained" onClick={() => openLogin()} sx={{ borderRadius: 2, px: 4, fontWeight: 700 }}>
          ورود / ثبت‌نام
        </Button>
      </Stack>
    );
  }

  return <>{children}</>;
}
