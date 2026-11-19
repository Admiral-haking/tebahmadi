'use client';

import { useMemo } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { AuthGuard } from '@/auth';
import { useAuth } from '@/auth/auth-context';
import { LayoutAdmin } from '@/layout/admin';
import { userHasAdminAccess } from '@/auth/permissions';
import AdminTheme from './admin-theme';

interface AdminLayoutWrapperProps {
  children: React.ReactNode;
}

function UnauthorizedNotice() {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="60vh"
      gap={2}
      sx={{ px: 3 }}
    >
      <Typography variant="h5" fontWeight={600} textAlign="center">
        دسترسی غیرمجاز
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center" maxWidth={420}>
        برای مشاهده این بخش به سطح دسترسی بالاتری نیاز دارید. در صورت نیاز با مدیر سایت تماس بگیرید.
      </Typography>
    </Box>
  );
}

function GuardedContent({ children }: AdminLayoutWrapperProps) {
  const { user } = useAuth();

  const allowed = useMemo(() => userHasAdminAccess(user), [user]);

  if (!allowed) {
    return (
      <LayoutAdmin>
        <UnauthorizedNotice />
      </LayoutAdmin>
    );
  }

  return <LayoutAdmin>{children}</LayoutAdmin>;
}

function LoadingFallback() {
  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="60vh">
      <CircularProgress size={32} />
    </Box>
  );
}

export function AdminLayoutWrapper({ children }: AdminLayoutWrapperProps) {
  return (
    <AdminTheme>
      <AuthGuard fallback={<LoadingFallback />}>
        <GuardedContent>{children}</GuardedContent>
      </AuthGuard>
    </AdminTheme>
  );
}

export default AdminLayoutWrapper;
