import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    serverExternalPackages: ['node-fetch'],

    // Keep Turbopack anchored to this project when another lockfile exists in the home directory.
    turbopack: {
        root: process.cwd(),
    },

    // Keep production builds honest: type errors must fail the build.
    typescript: {
        ignoreBuildErrors: false,
    },

    // Enable compression (built-in)
    compress: true,

    // Image optimization (sharp is installed)
    images: {
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        minimumCacheTTL: 604800, // 7 days
        dangerouslyAllowSVG: false,
        contentDispositionType: 'attachment',
        // Media thumbnails use query parameters such as ?type=thumb/original.
        // Declaring the local path keeps the app compatible with Next.js 16.
        localPatterns: [{ pathname: '/api/media/**' }],
    },

    // Production optimizations
    productionBrowserSourceMaps: false,

    // Enable React strict mode
    reactStrictMode: true,

    // HTTP security and caching headers
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                ],
            },
            {
                source: '/api/media/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
                ],
            },
            {
                source: '/_next/static/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
            {
                source: '/_next/image',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' },
                ],
            },
        ];
    },

    // Experimental features
    experimental: {
        // The server has limited RAM; serial build workers avoid swap storms during deploys.
        cpus: 1,
        optimizePackageImports: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
    },
};

export default nextConfig;
