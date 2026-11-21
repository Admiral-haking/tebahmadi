"use server";
import { loadSiteInfo } from '@/lib/cache';
import { Box } from '@mui/material';
import Link from 'next/link';
import OptimizedImage from '../image';
import { BRAND } from '@/config/brand';


function DefaultLogo({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 128 128" role="img" aria-label={`نشان ${BRAND.name}`}>
      <rect width="128" height="128" rx="30" fill="#f7f5ed" />
      <path d="M64 12 76 24l17 4 4 17 12 12-12 12-4 17-17 4-12 12-12-12-17-4-4-17L19 57l12-12 4-17 17-4z" fill="none" stroke="#2a5a44" strokeWidth="5" />
      <path d="M72 86c-16-2-28-13-28-27 11 1 22 5 29 15 4-12 12-21 22-27 1 17-7 31-23 39Z" fill="#2a5a44" />
      <path d="M49 91c5-12 13-22 25-30" fill="none" stroke="#f9f8f6" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export default async function Logo({ size = 40, showName = false }: { size?: number; showName?: boolean }) {
  const siteInfo = await loadSiteInfo();
  const appName = siteInfo?.appName ?? BRAND.name;
  const logoField = siteInfo?.logo;
  const logoId = logoField
    ? String(logoField.thumbId ?? logoField.mobileId ?? logoField.originalId ?? '')
    : '';
  const logoSrc = logoId ? `/api/media/${logoId}` : null;

  return (
    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: showName ? 12 : 0 }}>
      {logoSrc ? (
        <Box sx={{
          bgcolor: 'transparent',
          p: 0,
          borderRadius: 0,
          width: size,
          height: size,
          position: 'relative'
        }}>
          <OptimizedImage
            src={logoSrc}
            alt={appName}
            fill
            style={{
              objectFit: 'contain',
              background: 'transparent',
            }}
            priority={false}
            transparentBackground
          />
        </Box>
      ) : (
        <DefaultLogo size={size} />
      )}
      {showName ? (
        <span style={{ fontSize: Math.max(size / 2.5, 14), fontWeight: 700 }}>{appName}</span>
      ) : null}
    </Link>
  );
}
