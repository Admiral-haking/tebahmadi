'use client';

import { useState, useEffect } from 'react';
import { Box, Button, Link, Stack, Typography } from '@mui/material';

const CONSENT_COOKIE = 'cookie_consent';

function readConsentCookie(): 'accepted' | 'rejected' | null {
    const match = document.cookie.match(
        new RegExp('(?:^|;)\\s*' + CONSENT_COOKIE + '\\s*=\\s*([^;]+)')
    );
    const val = match?.[1]?.trim();
    if (val === 'accepted' || val === 'rejected') return val;
    return null;
}

function writeConsentCookie(value: 'accepted' | 'rejected') {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax${secure}`;
}

export default function CookieConsent() {
    const [state, setState] = useState<'accepted' | 'rejected' | 'pending' | null>(null);

    useEffect(() => {
        setState(readConsentCookie() ?? 'pending');
    }, []);

    function accept() {
        writeConsentCookie('accepted');
        setState('accepted');
    }

    function reject() {
        writeConsentCookie('rejected');
        setState('rejected');
    }

    if (state === 'accepted') {
        return null;
    }

    if (state !== 'pending') return null;

    return (
        <Box
            role="dialog"
            aria-label="رضایت کوکی"
            sx={{
                position: 'fixed',
                bottom: { xs: 0, sm: 24 },
                left: { xs: 0, sm: 24 },
                right: { xs: 0, sm: 'auto' },
                maxWidth: { sm: 440 },
                bgcolor: 'background.paper',
                borderRadius: { xs: '20px 20px 0 0', sm: 3.5 },
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 18px 50px rgba(var(--mui-palette-text-primaryChannel) / 0.22)',
                overflow: 'hidden',
                zIndex: 1500,
                animation: 'cookieSlideUp .5s cubic-bezier(.16,1,.3,1) both',
                '@keyframes cookieSlideUp': {
                    '0%': { opacity: 0, transform: 'translateY(24px)' },
                    '100%': { opacity: 1, transform: 'translateY(0)' },
                },
            }}
        >
            {/* gradient accent strip */}
            <Box sx={{ height: 5, background: 'linear-gradient(90deg, var(--mui-palette-primary-main), var(--mui-palette-secondary-main), var(--mui-palette-error-main))' }} />

            <Stack spacing={2} sx={{ p: { xs: 2.5, sm: 3 } }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box
                        sx={{
                            flexShrink: 0,
                            width: 46,
                            height: 46,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 26,
                            background: 'linear-gradient(135deg, rgba(var(--mui-palette-primary-mainChannel) / 0.16), rgba(var(--mui-palette-error-mainChannel) / 0.16))',
                        }}
                        aria-hidden
                    >
                        🍪
                    </Box>
                    <Stack spacing={0.5}>
                        <Typography variant="subtitle1" fontWeight={800}>
                            استفاده از کوکی‌ها
                        </Typography>
                        <Typography variant="body2" color="text.secondary" lineHeight={1.8}>
                            برای حفظ ورود و سبد خرید، از کوکی‌های ضروری استفاده می‌کنیم.{' '}
                            <Link href="/page/privacy" underline="hover" sx={{ fontSize: 'inherit', fontWeight: 600 }}>
                                سیاست حریم خصوصی
                            </Link>
                        </Typography>
                    </Stack>
                </Stack>
                <Stack direction="row" spacing={1.25}>
                    <Button
                        variant="outlined"
                        fullWidth
                        color="inherit"
                        onClick={reject}
                        sx={{ borderRadius: 2, py: 1, borderColor: 'divider', color: 'text.secondary', fontWeight: 700 }}
                    >
                        فقط ضروری‌ها
                    </Button>
                    <Button
                        variant="contained"
                        fullWidth
                        onClick={accept}
                        sx={{
                            borderRadius: 2,
                            py: 1,
                            fontWeight: 800,
                            background: 'linear-gradient(135deg, var(--mui-palette-primary-main), var(--mui-palette-secondary-main))',
                            boxShadow: '0 8px 20px rgba(var(--mui-palette-primary-mainChannel) / 0.35)',
                            '&:hover': { background: 'linear-gradient(135deg, var(--mui-palette-primary-dark), var(--mui-palette-secondary-dark))' },
                        }}
                    >
                        ادامه
                    </Button>
                </Stack>
            </Stack>
        </Box>
    );
}
