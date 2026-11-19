"use client";

/**
 * Product JSON-LD Structured Data
 * Helps AI assistants (ChatGPT, Bard, etc.) and search engines understand product details
 */
export default function ProductJsonLd({
  name,
  description,
  sku,
  mpn,
  brand,
  image,
  price,
  priceCurrency = "IRR",
  availability = "https://schema.org/InStock",
  url,
  reviewCount,
  ratingValue,
}: {
  name: string;
  description?: string;
  sku?: string;
  mpn?: string;
  brand?: string;
  image?: string;
  price?: number;
  priceCurrency?: string;
  availability?: string;
  url?: string;
  reviewCount?: number;
  ratingValue?: number;
}) {
  const productData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    sku,
    mpn,
    image,
    url,
    offers: {
      "@type": "Offer",
      price: price ?? 0,
      priceCurrency,
      availability,
      url,
    },
  };

  if (brand) {
    productData.brand = {
      "@type": "Brand",
      name: brand,
    };
  }

  if (reviewCount && ratingValue) {
    productData.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue,
      reviewCount,
      bestRating: 5,
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(productData),
      }}
    />
  );
}
