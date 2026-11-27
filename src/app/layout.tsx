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
import ChunkLoadRecovery from "@/components/chunk-load-recovery-client";
import { BRAND } from "@/config/brand";
import { criticalLayoutCss } from "@/layout/critical-layout-css";

const ProgressBar = dynamic(() => import("@/components/progress"))

export async function generateMetadata(): Promise<Metadata> {
  const info = await loadSiteInfo();
  const title = info?.appName && info.appName !== BRAND.name ? info.appName : BRAND.title;
  const description = info?.description ?? BRAND.description;
  const base = resolveSiteBaseUrl();
  const logoId = info?.logo?.thumbId ?? info?.logo?.mobileId ?? info?.logo?.originalId;
  const logoUrl = logoId ? buildMediaUrl(String(logoId), base ?? undefined) : undefined;

  const metadata: Metadata = {
    title: {
      default: title,
      template: '%s',
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
    alternates: {
      canonical: base?.toString() ?? BRAND.url,
    },
    icons: {
      icon: '/tebahmadi-mark.svg',
      apple: '/tebahmadi-mark.svg',
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

  const appName = info?.appName ?? BRAND.name;
  const description = info?.description ?? BRAND.description;
  const configuredPhones = info?.phones?.map((phone) => phone.number?.trim()).filter(Boolean) ?? [];
  const publisherTelephone = configuredPhones.length === 1 ? configuredPhones[0] : configuredPhones;

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/tebahmadi-mark.svg" />
        <style id="tebahmadi-critical-layout" dangerouslySetInnerHTML={{ __html: criticalLayoutCss }} />
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
            inLanguage: 'fa-IR',
            publisher: {
              "@type": "Organization",
              name: appName,
              url: baseUrl,
              ...(configuredPhones.length > 0 ? { telephone: publisherTelephone } : {}),
            },
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
            <ChunkLoadRecovery />
            <ProgressBar />
            <AuthProvider>
              <LoginProvider>
                <LoginDialogProvider>
                  <CartProvider>
                    <Layout>
                      {children}
                    </Layout>
                  </CartProvider>
                  <Toaster
                    position="bottom-center"
                    mobileOffset={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
                  />
                </LoginDialogProvider>
              </LoginProvider>
            </AuthProvider>
          </AppTheme>
        </AppRouterCacheProvider>

      </body>
    </html>
  );
}
