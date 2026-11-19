"use server";
import { loadSiteInfo } from '@/lib/cache';
import { Box } from '@mui/material';
import Link from 'next/link';
import OptimizedImage from '../image';


function DefaultLogo({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 128 128" role="img" aria-label="لوگو پیش‌فرض">
      <linearGradient
        id="logoGradientPrimary"
        x1={14.704}
        x2={110.985}
        y1={46.27}
        y2={92.024}
        gradientTransform="matrix(1 0 0 -1 0 130)"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset={0} stopColor="#e40035" />
        <stop offset={0.24} stopColor="#f60a48" />
        <stop offset={0.352} stopColor="#f20755" />
        <stop offset={0.494} stopColor="#dc087d" />
        <stop offset={0.745} stopColor="#9717e7" />
        <stop offset={1} stopColor="#6c00f5" />
      </linearGradient>
      <path
        fill="url(#logoGradientPrimary)"
        d="m124.5 21.3l-4.4 68.6L78.3 0zm-29 88.7L64 128l-31.5-18l6.4-15.5h50.3zM64 34.1l16.5 40.2h-33zM7.9 89.9L3.5 21.3L49.7 0z"
      />
      <linearGradient id="logoGradientSecondary" x1={28.733} x2={91.742} y1={117.071} y2={45.195} gradientTransform="matrix(1 0 0 -1 0 130)" gradientUnits="userSpaceOnUse">
        <stop offset={0} stopColor="#ff31d9" />
        <stop offset={1} stopColor="#ff5be1" stopOpacity={0} />
      </linearGradient>
      <path
        fill="url(#logoGradientSecondary)"
        d="m124.5 21.3l-4.4 68.6L78.3 0zm-29 88.7L64 128l-31.5-18l6.4-15.5h50.3zM64 34.1l16.5 40.2h-33zM7.9 89.9L3.5 21.3L49.7 0z"
      />
    </svg>
  );
}

export default async function Logo({ size = 40, showName = false }: { size?: number; showName?: boolean }) {
  const siteInfo = await loadSiteInfo();
  const appName = siteInfo?.appName ?? 'برند شما';
  const logoField = siteInfo?.logo;
  const logoId = logoField
    ? String(logoField.thumbId ?? logoField.mobileId ?? logoField.originalId ?? '')
    : '';
  const logoSrc = logoId ? `/api/media/${logoId}` : null;

  return (
    <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: showName ? 12 : 0 }}>
      {logoSrc ? (
        <Box sx={{
          bgcolor: 'white',
          p: .5,
          borderRadius: 1,
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
            }}
            priority={false}
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
