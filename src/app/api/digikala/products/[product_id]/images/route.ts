import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ product_id: string }> };

/**
 * Safely extracts image URLs from different Digikala API formats
 */
function extractUrls(source: unknown): string[] {
  if (!source) return [];
  
  // Case 1: Array of strings (direct URLs)
  if (Array.isArray(source)) {
    return source
      .filter((item): item is string => typeof item === 'string')
      .map((u) => u.split('?')[0]);
  }
  
  // Case 2: Object with `url` property that is an array of strings
  if (typeof source === 'object' && source !== null) {
    const obj = source as Record<string, unknown>;
    if (Array.isArray(obj.url)) {
      return obj.url
        .filter((item): item is string => typeof item === 'string')
        .map((u) => u.split('?')[0]);
    }
    // Case 3: Single string
    if (typeof obj.url === 'string') {
      return [obj.url.split('?')[0]];
    }
  }
  
  // Case 4: Single string
  if (typeof source === 'string') {
    return [source.split('?')[0]];
  }
  
  return [];
}

/**
 * Safely extracts image URLs from an array of items (e.g., images.list)
 * Each item can be an object with `url` array or a direct string
 */
function extractListUrls(list: unknown): string[] {
  if (!list) return [];
  
  if (Array.isArray(list)) {
    return list.flatMap((item) => extractUrls(item));
  }
  
  if (typeof list === 'object' && list !== null) {
    // If it has a url property at the top level
    return extractUrls(list);
  }
  
  return [];
}

/**
 * Fetches product images from Digikala's public API
 * Returns all gallery images 
 */
export async function GET(req: NextRequest, context: RouteContext): Promise<NextResponse> {
    const { product_id } = await context.params;

    if (!product_id) {
        return NextResponse.json({ error: "product_id is required" }, { status: 400 });
    }

    try {
        const response = await fetch(
            `https://api.digikala.com/v2/product/${product_id}/`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                },
                next: { revalidate: 300 }
            }
        );

        if (!response.ok) {
            return NextResponse.json(
                { error: `Digikala API returned ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        const product = data?.data?.product;
        
        if (!product) {
            return NextResponse.json({ error: "Product not found in Digikala" }, { status: 404 });
        }

        // Safe extraction from product.images
        const images = product.images || {};
        const mainUrls = extractUrls(images.main?.url);
        const listUrls = extractListUrls(images.list);

        // Safe extraction from product.variants_images
        const variantsImages = product.variants_images || {};
        const variantMainUrls = extractUrls(variantsImages.main?.url);
        const variantListUrls = extractListUrls(variantsImages.list);

        // Product info
        const title = product.title_fa || product.title_en || '';
        const brand = product.brand?.title_fa || product.brand?.title_en || '';
        const category = product.category?.title_fa || product.category?.title_en || '';

        // Combine all unique URLs (product images + variant images)
        const allUrls = [...new Set([...mainUrls, ...listUrls, ...variantMainUrls, ...variantListUrls])];

        return NextResponse.json({
            productId: product_id,
            title,
            brand,
            category,
            gallery: {
                main: mainUrls,
                list: listUrls,
                all: allUrls
            },
            count: allUrls.length
        });

    } catch (error: any) {
        console.error("[digikala/images] Error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to fetch product images" },
            { status: 500 }
        );
    }
}
