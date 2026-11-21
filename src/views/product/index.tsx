import { Box, Container } from "@mui/material";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import ProductDetailView from "./components/view";
import SimilarProducts from "./components/similar";
import type { ProductDetailData } from "./data";
import { loadProductDetail } from "./data";
import { resolveSiteBaseUrl, toAbsoluteUrl } from "@/seo/utils/url";

const PRICE_CURRENCY = "IRR";

function serializeJsonLd(value: unknown): string | null {
    if (!value) return null;
    try {
        return JSON.stringify(value);
    } catch {
        return null;
    }
}

function sanitizeDescription(value?: string | null): string | undefined {
    if (!value) {
        return undefined;
    }
    const normalized = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return normalized.length > 0 ? normalized : undefined;
}

function formatPriceValue(value: number): string {
    if (Number.isInteger(value)) {
        return value.toString();
    }
    const rounded = Math.round(value * 100) / 100;
    return rounded.toFixed(2);
}

function collectProductImageUrls(product: ProductDetailData, base?: URL): string[] {
    const urls = new Set<string>();
    product.variants.forEach((variant) => {
        variant.media?.forEach((media) => {
            const source = media?.fullUrl ?? media?.previewUrl ?? media?.url;
            if (!source) {
                return;
            }
            urls.add(toAbsoluteUrl(source, base));
        });
    });
    return Array.from(urls);
}

type OfferEntry = {
    offer: Record<string, unknown>;
    price: number;
    inStock: boolean;
};

function buildOfferEntries(product: ProductDetailData, productUrl: string): OfferEntry[] {
    const entries: OfferEntry[] = [];
    product.variants.forEach((variant) => {
        const priceValue = Number(variant.finalPrice);
        if (!Number.isFinite(priceValue) || priceValue <= 0) {
            return;
        }
        const normalizedPrice = Math.max(0, priceValue);
        const priceString = formatPriceValue(normalizedPrice);
        const inventoryQuantity = Number(variant.inventoryQuantity);
        const inStock = Number.isFinite(inventoryQuantity) ? inventoryQuantity > 0 : false;

        const offer: Record<string, unknown> = {
            "@type": "Offer",
            price: priceString,
            priceCurrency: PRICE_CURRENCY,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            url: productUrl,
            itemCondition: "https://schema.org/NewCondition",
        };

        const sku = variant.sku?.trim();
        if (sku) {
            offer.sku = sku;
        }

        if (variant.offerEndsAt) {
            offer.priceValidUntil = variant.offerEndsAt;
        }

        if (Number.isFinite(inventoryQuantity) && inventoryQuantity >= 0) {
            offer.inventoryLevel = {
                "@type": "QuantitativeValue",
                value: Math.max(0, Math.floor(inventoryQuantity)),
            };
        }

        entries.push({
            offer,
            price: normalizedPrice,
            inStock,
        });
    });
    return entries;
}

function createOffersSchema(entries: OfferEntry[]): unknown {
    if (entries.length === 0) {
        return undefined;
    }
    if (entries.length === 1) {
        return entries[0].offer;
    }

    const prices = entries.map((entry) => entry.price);
    const lowPrice = Math.min(...prices);
    const highPrice = Math.max(...prices);
    const hasStock = entries.some((entry) => entry.inStock);

    return {
        "@type": "AggregateOffer",
        priceCurrency: PRICE_CURRENCY,
        offerCount: entries.length,
        lowPrice: formatPriceValue(lowPrice),
        highPrice: formatPriceValue(highPrice),
        offers: entries.map((entry) => entry.offer),
        availability: hasStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    };
}

export default async function ProductView({
    slug,
    searchParams,
}: {
    slug: string;
    searchParams?: Record<string, string | string[] | undefined>;
}) {
    const product = await loadProductDetail(slug);
    if (!product) {
        notFound();
    }

    const rawVariantParam = searchParams?.variantId ?? searchParams?.variant;
    const initialVariantId = Array.isArray(rawVariantParam) ? rawVariantParam[0] : rawVariantParam;

    const baseUrl = resolveSiteBaseUrl();
    const productUrl = toAbsoluteUrl(`/product/${product.slug}`, baseUrl);
    const imageUrls = collectProductImageUrls(product, baseUrl ?? undefined);
    const offerEntries = buildOfferEntries(product, productUrl);
    const offersSchema = createOffersSchema(offerEntries);
    const categories = (product.categories ?? [])
        .map((category) => category?.name?.trim())
        .filter((value): value is string => Boolean(value));
    const description = sanitizeDescription(product.description);

    const productJsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Product",
        "@id": productUrl,
        name: product.title,
        url: productUrl,
    };

    if (description) {
        productJsonLd.description = description;
    }
    if (imageUrls.length > 0) {
        productJsonLd.image = imageUrls;
    }
    const primarySku = product.variants[0]?.sku?.trim();
    if (primarySku) {
        productJsonLd.sku = primarySku;
    }
    const brand = product.brand?.trim();
    if (brand) {
        productJsonLd.brand = {
            "@type": "Brand",
            name: brand,
        };
    }
    if (categories.length > 0) {
        productJsonLd.category = categories;
    }
    if (product.reviewStats?.total) {
        productJsonLd.aggregateRating = {
            "@type": "AggregateRating",
            ratingValue: product.reviewStats.averageRating.toFixed(1),
            reviewCount: product.reviewStats.total,
        };
    }
    if (offersSchema) {
        productJsonLd.offers = offersSchema;
    }

    const serializedProductJsonLd = serializeJsonLd(productJsonLd);

    return (
        <>
            <Container maxWidth="lg" sx={{ my: { xs: 2, md: 5 }, px: { xs: 1.5, sm: 2 } }}>
                <ProductDetailView product={product} initialVariantId={initialVariantId} />

                <Suspense>
                    <SimilarProducts product={product} searchParams={searchParams} />
                </Suspense>
            </Container>
            {serializedProductJsonLd && (
                <Box
                    component="script"
                    type="application/ld+json"
                    sx={{ display: "none" }}
                    dangerouslySetInnerHTML={{ __html: serializedProductJsonLd }}
                />
            )}
        </>
    );
}
