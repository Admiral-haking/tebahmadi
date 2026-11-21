import { Box, Container } from "@mui/material";
import { Suspense } from "react";
import Hero from "./components/hero";
import StoreProductGrid from "./components/grid";
import type { StoreCategoryContext } from "./data";
import StoreProductGridSkeleton from "./components/grid-skeleton";
import { loadSiteInfo } from "@/lib/cache";
import { buildMediaUrl, resolveSiteBaseUrl, toAbsoluteUrl } from "@/seo/utils/url";
import { BRAND } from "@/config/brand";

export type StoreViewSearchParams = Record<string, string | string[] | undefined>;

function serializeJsonLd(value: unknown): string | null {
    if (!value) return null;
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
}

export default async function StoreView({
    searchParams,
    context,
}: {
    searchParams: StoreViewSearchParams;
    context: StoreCategoryContext;
}) {
    const siteInfo = await loadSiteInfo();

    const baseUrl = resolveSiteBaseUrl();
    const categoryPath = context.active.path;
    const storeUrl = toAbsoluteUrl(`/store/${categoryPath}`, baseUrl);
    const storeName = context.active.name || siteInfo?.appName || BRAND.name;

    const logoId =
        (siteInfo?.logo?.thumbId ?? siteInfo?.logo?.mobileId ?? siteInfo?.logo?.originalId)?.toString();
    const logoUrl = logoId ? buildMediaUrl(logoId, baseUrl ?? undefined) : undefined;

    const phoneNumbers = (siteInfo?.phones ?? [])
        .map((entry) => entry?.number?.trim())
        .filter((value): value is string => Boolean(value));
    const addresses = (siteInfo?.addresses ?? [])
        .map((entry) => {
            const street = entry?.address?.trim();
            if (!street) {
                return undefined;
            }
            const result: Record<string, unknown> = {
                "@type": "PostalAddress",
                streetAddress: street,
            };
            if (entry?.label?.trim()) {
                result.name = entry.label.trim();
            }
            return result;
        })
        .filter((value): value is Record<string, unknown> => Boolean(value));
    const socialLinks = (siteInfo?.socials ?? [])
        .map((entry) => entry?.url?.trim())
        .filter((value): value is string => Boolean(value));

    const storeJsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Store",
        "@id": storeUrl,
        name: storeName,
        url: storeUrl,
    };

    if (siteInfo?.description?.trim()) {
        storeJsonLd.description = siteInfo.description.trim();
    }
    if (logoUrl) {
        storeJsonLd.image = [logoUrl];
    }
    if (phoneNumbers.length > 0) {
        storeJsonLd.telephone = phoneNumbers.length === 1 ? phoneNumbers[0] : phoneNumbers;
    }
    if (addresses.length > 0) {
        storeJsonLd.address = addresses.length === 1 ? addresses[0] : addresses;
    }
    if (socialLinks.length > 0) {
        storeJsonLd.sameAs = socialLinks;
    }
    if (baseUrl) {
        storeJsonLd.isPartOf = {
            "@type": "WebSite",
            name: storeName,
            url: baseUrl.toString(),
        };
    }

    const serializedStoreJsonLd = serializeJsonLd(storeJsonLd);

    return (
        <>
            <Container maxWidth="lg" sx={{ position: "relative", my: { xs: 2, md: 5 }, px: { xs: 1.5, sm: 2 } }}>
                <Hero
                    category={context}
                    searchParams={await searchParams}
                    siteTitle={siteInfo?.appName || BRAND.name}
                />

                <Box sx={{ my: { xs: 3, md: 5 } }}>
                    <Suspense fallback={<StoreProductGridSkeleton />}>
                        <StoreProductGrid
                            searchParams={await searchParams}
                            category={context}
                        />
                    </Suspense>
                </Box>
            </Container>
            {serializedStoreJsonLd && (
                <Box
                    component="script"
                    type="application/ld+json"
                    sx={{ display: "none" }}
                    dangerouslySetInnerHTML={{ __html: serializedStoreJsonLd }}
                />
            )}
        </>
    );
}
