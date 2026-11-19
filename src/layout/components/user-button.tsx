'use client';

import { JSX, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import { useAuth, useLoginDialog } from '@/auth';
import type { AuthUser } from '@/auth';
import ProfileForm from './profile-form';

function hasElevatedRole(user: AuthUser | null | undefined): boolean {
  if (!user?.roles?.length) {
    return false;
  }
  return user.roles.some((role) => role !== 'customer');
}

export default function UserButton(): JSX.Element {
  const { user, status, setUser, logout } = useAuth();
  const { openLogin } = useLoginDialog();
  const [open, setOpen] = useState(false);

  const initials = useMemo(() => {
    if (!user) {
      return null;
    }
    const candidate = `${user.fname ?? ''} ${user.lname ?? ''}`.trim();
    if (candidate) {
      return candidate.charAt(0).toUpperCase();
    }
    if (user.phone) {
      const digits = user.phone.replace(/\D/g, '');
      if (digits) {
        return digits.charAt(digits.length - 1);
      }
    }
    return null;
  }, [user]);

  const handleDrawerOpen = () => {
    if (user) {
      setOpen(true);
    }
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <Avatar sx={{ bgcolor: 'background.paper', color: 'text.primary' }}>
        <CircularProgress size={20} />
      </Avatar>
    );
  }

  if (!user) {
    return (
      <Button
        onClick={() => openLogin()}
        variant="contained"
        size="small"
        startIcon={<LoginRoundedIcon />}
        sx={{
          minHeight: 38,
          px: { xs: 1.2, sm: 1.6 },
          borderRadius: 2,
          fontWeight: 800,
          whiteSpace: 'nowrap',
        }}
      >
        ورود/ثبت نام
      </Button>
    );
  }

  return (
    <>
      <Avatar
        alt="user"
        onClick={handleDrawerOpen}
        sx={{
          bgcolor: 'background.paper',
          color: 'text.primary',
          objectFit: 'cover',
          cursor: 'pointer'
        }}
        variant='circular'
        src={user.avatar ? `/api/media/${user.avatar.thumbId}` : ''}
      >
        {initials ? (
          <Typography component="span" sx={{ fontWeight: 600 }}>
            {initials}
          </Typography>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24">
            <circle cx={12} cy={6} r={4} fill="currentColor" />
            <path
              fill="currentColor"
              d="M20 17.5c0 2.485 0 4.5-8 4.5s-8-2.015-8-4.5S7.582 13 12 13s8 2.015 8 4.5"
              opacity={0.5}
            ></path>
          </svg>
        )}
      </Avatar>

      <Drawer anchor="right" open={open} onClose={handleDrawerClose}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            p: 2,
            bgcolor: 'background.paper'
          }}>
          <Typography variant="h6">حساب کاربری</Typography>
          <IconButton onClick={handleDrawerClose} aria-label="بستن">
            <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="m12 10.586l4.95-4.95l1.414 1.414L13.414 12l4.95 4.95l-1.414 1.414L12 13.414l-4.95 4.95l-1.414-1.414L10.586 12l-4.95-4.95l1.414-1.414z"
              />
            </svg>
          </IconButton>
        </Stack>
        <Box
          sx={{
            width: { xs: 320, sm: 350 },
            p: 2,
            maxHeight: '100vh',
            height: '100%',
            bgcolor: 'background.paper',
            pt: 12,
            overflowY: 'scroll'
          }}
          role="presentation"
        >
          <Stack spacing={0.5} mb={3} alignItems="flex-start">
            <Typography variant="subtitle1" fontWeight={600}>
              {`${user.fname ?? ''} ${user.lname ?? ''}`.trim() || 'کاربر عزیز'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ direction: 'ltr' }}>
              {user.phone}
            </Typography>
          </Stack>

          <Divider sx={{ mb: 3 }} />

          <ProfileForm user={user} onSuccess={setUser} />

          <Divider sx={{ my: 3 }} />

          <Stack spacing={1.5} onClick={handleDrawerClose}>
            <Button component={Link} href="/orders" variant="contained" fullWidth>
              سفارش‌ها
            </Button>
            {hasElevatedRole(user) ? (
              <Button component="a" href="/admin" variant="contained" fullWidth>
                پنل مدیریت
              </Button>
            ) : null}

            <Button onClick={() => logout()} variant="contained" color='error' fullWidth>
              خروج
            </Button>
          </Stack>

          <Stack alignItems="center" justifyContent="center" sx={{ height: 400, py: 8 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width={200} height={200} viewBox="0 0 40 40">
              <g fill="none" strokeMiterlimit={10}>
                <path fill="#ffe236" stroke="#231f20" d="M15.9 21.61c-.98.665-3.982 1.79-4.892.488c-.91-1.3 1.213-3.717 2.181-4.382c.969-.665 2.055-.46 2.935.831s.734 2.377-.225 3.062Z" strokeWidth={1}></path>
                <path fill="#ff52a1" stroke="#231f20" d="M11.937 30.306c-.332-.734-2.025-.743-3.297-.743s-2.935 0-3.297.743c-.332.372-.489 2.348-.489 3.982s.157 3.62.49 3.991c.322.734 2.015.744 3.296.744c1.282 0 2.935 0 3.297-.744c.323-.371.48-2.348.48-3.991s-.157-3.58-.48-3.982Zm10.399-5.224c-.322-1.223-2.015-1.223-3.306-1.223c-1.292 0-2.935 0-3.297 1.194c-.323.597-.48 3.757-.48 6.369s.157 5.781.48 6.378c.362 1.213 2.035 1.223 3.297 1.223s2.935 0 3.297-1.194c.332-.596.489-3.756.489-6.378s-.147-5.772-.48-6.369Z" strokeWidth={1}></path>
                <path fill="#ffe236" stroke="#231f20" d="M32.726 19.858c-.323-1.634-2.025-1.653-3.297-1.653s-2.935 0-3.297 1.653c-.333.812-.489 5.156-.489 8.805s.156 7.953.49 8.804c.332 1.634 2.024 1.644 3.296 1.644s2.935 0 3.297-1.644c.332-.812.489-5.165.489-8.804s-.137-7.993-.49-8.805Z" strokeWidth={1}></path>
                <path stroke="#fff" strokeLinecap="round" d="M30.466 19.946c.607 0 .773.137.88 1.32m-11.093 4.433c.596 0 .763.146.87 1.33M9.658 31.255c.597 0 .763.137.87 1.32" strokeWidth={1}></path>
                <path fill="#48eeff" stroke="#231f20" d="M17.954 5.526c.98-.053 1.965 0 2.935.157c.92-.705 1.839-1.37 2.602-1.859C26.044 2.171 29.449.889 30.388.889c1.516 0 6.212.587 7.542 2.642s-.088 6.564-.694 7.953c-.372.851-2.935 3.424-5.528 5.077a43 43 0 0 1-2.71 1.566v.068a12.4 12.4 0 0 1-1.134 2.808a9.8 9.8 0 0 1-2.064 2.749a1.21 1.21 0 0 1-1.478 0a11 11 0 0 1-1.878-2.309a15 15 0 0 1-.704-1.262a12.5 12.5 0 0 1-3.688-3.835a12.4 12.4 0 0 1-1.957-4.891q-.474-.593-.88-1.233a11.3 11.3 0 0 1-1.282-2.68a1.21 1.21 0 0 1 .636-1.292c.472-.244.606-.577 3.385-.724Z" strokeWidth={1}></path>
                <path fill="#fff" stroke="#231f20" d="M20.81 12.746c-.004 2.184 2.358 3.553 4.251 2.465a2.84 2.84 0 0 0 1.423-2.465c.004-2.184-2.357-3.553-4.25-2.465a2.84 2.84 0 0 0-1.424 2.465Z" strokeWidth={1}></path>
                <path stroke="#231f20" strokeLinecap="round" d="M34.731 10.085a20.3 20.3 0 0 1-4.099-6.359M26.65 18.528a26 26 0 0 1-2.866 1.418M19.607 7.64a24 24 0 0 0-2.456 2.034" strokeWidth={1}></path>
                <path stroke="#fff" strokeLinecap="round" d="M35.66 3.795a5.3 5.3 0 0 0-2.425-.842" strokeWidth={1}></path>
                <path fill="#ffe236" stroke="#231f20" strokeLinecap="round" d="M5.784 16.786a1.419 1.419 0 1 0 2.837 0a1.419 1.419 0 0 0-2.837 0Zm-4.266 7.338c0 1.641 1.778 2.667 3.2 1.846a2.13 2.13 0 0 0 1.066-1.846c0-1.642-1.777-2.668-3.2-1.847a2.13 2.13 0 0 0-1.066 1.846Z" strokeWidth={1}></path>
              </g>
            </svg>
          </Stack>
        </Box>
      </Drawer>
    </>
  );
}
