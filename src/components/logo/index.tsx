"use server";
import { loadSiteInfo } from '@/lib/cache';
import { Box } from '@mui/material';
import Link from 'next/link';
import OptimizedImage from '../image';
import { BRAND } from '@/config/brand';
import BrandLockup from '../brand-lockup';

export default async function Logo({ size = 40, showName = false }: { size?: number; showName?: boolean }) {
  const siteInfo = await loadSiteInfo();
  const appName = siteInfo?.appName ?? BRAND.name;
  const logoField = siteInfo?.logo;
  const logoId = logoField
    ? String(logoField.thumbId ?? logoField.mobileId ?? logoField.originalId ?? '')
    : '';
  const logoSrc = logoId ? `/api/media/${logoId}` : null;

  return (
    <Link
      href="/"
      aria-label={appName}
      style={{ display: 'inline-flex', alignItems: 'center', gap: showName ? 10 : 0, minWidth: 0, maxWidth: '100%', flexShrink: 0, overflow: 'visible' }}
    >
      {logoSrc ? (
        <Box sx={{
          bgcolor: 'transparent',
          p: 0,
          borderRadius: 0,
          width: size,
          height: size,
          position: 'relative',
          flex: '0 0 auto',
          overflow: 'visible',
        }}>
          <OptimizedImage
            src={logoSrc}
            fallbackSrc="/tebahmadi-mark.svg"
            alt={appName}
            fill
            style={{
              objectFit: 'contain',
              background: 'transparent',
            }}
            priority={size >= 56}
            transparentBackground
            containerStyle={{ overflow: 'hidden', borderRadius: 0, backgroundColor: 'transparent' }}
          />
        </Box>
      ) : (
        <BrandLockup size={size} showName={false} compact />
      )}
      {showName ? (
        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, minWidth: 0, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: Math.max(size / 2.5, 14), fontWeight: 800, lineHeight: 1.1 }}>{appName}</span>
          <span style={{ fontSize: Math.max(size / 5.8, 9), color: 'var(--mui-palette-text-secondary)', lineHeight: 1.1 }}>اصالت طبیعت، عیار تندرستی</span>
        </span>
      ) : null}
    </Link>
  );
}
