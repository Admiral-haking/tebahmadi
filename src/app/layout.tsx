import type { Metadata } from "next";
import AppTheme from "@/theme";
import Layout from "@/layout";
import CartProvider from "@/components/cart/CartProvider";
import { AuthProvider, LoginProvider, LoginDialogProvider } from "@/auth";
import { Toaster } from 'sonner';
import dynamic from "next/dynamic";
import { loadSiteInfo } from "@/lib/cache";
import { resolveSiteBaseUrl, buildMediaUrl } from "@/seo/utils/url";
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import JsonLd from "@/components/seo/json-ld";
import CookieConsent from "@/components/cookie-consent";

const ProgressBar = dynamic(() => import("@/components/progress"))

export async function generateMetadata(): Promise<Metadata> {
  const info = await loadSiteInfo();
  const title = info?.appName ?? 'Hippogriff';
  const description = info?.description ?? 'فروشگاه آنلاین';
  const base = resolveSiteBaseUrl();
  const logoId = info?.logo?.thumbId ?? info?.logo?.mobileId ?? info?.logo?.originalId;
  const logoUrl = logoId ? buildMediaUrl(String(logoId), base ?? undefined) : undefined;

  const metadata: Metadata = {
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      title,
      description,
      siteName: title,
      url: base?.toString(),
      images: logoUrl ? [{ url: logoUrl, alt: title }] : undefined,
      locale: 'fa_IR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: logoUrl ? [logoUrl] : undefined,
    },
    other: {
      'application-name': title,
    },
  };

  if (base) {
    metadata.metadataBase = base;
  }

  return metadata;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const info = await loadSiteInfo();
  const baseUrl = ((await resolveSiteBaseUrl())?.toString() || "https://tebahmadi.ir").replace(/\/+$/, '');

  const logoField = info?.logo;
  const logoId = logoField
    ? String(logoField.thumbId ?? logoField.mobileId ?? logoField.originalId ?? '')
    : '';
  const logoSrc = logoId ? `/api/media/${logoId}` : null;
  const appName = info?.appName ?? 'فروشگاه آنلاین';
  const description = info?.description ?? '';

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {logoSrc && <link rel="icon" href={logoSrc} />}
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        {/* JSON-LD Structured Data for AI/SEO */}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: appName,
            description: description,
            url: baseUrl,
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${baseUrl}/search?q={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          }}
        />

        <AppRouterCacheProvider options={{ enableCssLayer: true, speedy: true, prepend: true }}>
          <AppTheme>
            <ProgressBar />
            <AuthProvider>
              <LoginProvider>
                <LoginDialogProvider>
                  <CartProvider>
                    <Layout>
                      {children}
                    </Layout>
                  </CartProvider>
                  <Toaster />
                </LoginDialogProvider>
              </LoginProvider>
            </AuthProvider>
          </AppTheme>
        </AppRouterCacheProvider>

        {/* Cookie consent banner — also conditionally loads Google Analytics */}
        <CookieConsent />
      </body>
    </html>
  );
}
