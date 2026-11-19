import type { Metadata } from "next";
import { notFound } from "next/navigation";

import ProductView from "@/views/product";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";
import type { ProductDetailData } from "@/views/product/data";
import { loadProductDetail } from "@/views/product/data";

type ProductPageProps = {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const GUARANTEE_KEYWORDS_LATIN = ['guarantee', 'guaranty', 'warranty'];
const GUARANTEE_KEYWORDS_FA = ['گارانتی', 'ضمانت'];

function formatGuaranteeValue(value: unknown): string | undefined {
    if (value === null || value === undefined) {
        return undefined;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    }
    if (Array.isArray(value)) {
        const joined = value
            .map((item) => formatGuaranteeValue(item))
            .filter((item): item is string => Boolean(item));
        return joined.length ? joined.join(" / ") : undefined;
    }
    if (typeof value === "object") {
        if ("label" in (value as Record<string, unknown>) && typeof (value as Record<string, unknown>).label === "string") {
            return formatGuaranteeValue((value as Record<string, unknown>).label);
        }
        if ("name" in (value as Record<string, unknown>) && typeof (value as Record<string, unknown>).name === "string") {
            return formatGuaranteeValue((value as Record<string, unknown>).name);
        }
        try {
            return JSON.stringify(value);
        } catch {
            return undefined;
        }
    }
    return String(value);
}

function extractGuarantee(product: ProductDetailData): string | undefined {
    for (const variant of product.variants ?? []) {
        for (const attribute of variant.attributes ?? []) {
            const key = typeof attribute?.key === "string" ? attribute.key.toLowerCase() : "";
            if (GUARANTEE_KEYWORDS_LATIN.includes(key)) {
                const formatted = formatGuaranteeValue(attribute.value);
                if (formatted) {
                    return formatted;
                }
            }
        }

        for (const entry of variant.attributeEntries ?? []) {
            const label = entry?.label ?? "";
            const lowerLabel = label.toLowerCase();
            if (GUARANTEE_KEYWORDS_LATIN.some((keyword) => lowerLabel.includes(keyword))) {
                if (entry.value?.trim()) {
                    return entry.value.trim();
                }
            }
            if (GUARANTEE_KEYWORDS_FA.some((keyword) => label.includes(keyword))) {
                if (entry.value?.trim()) {
                    return entry.value.trim();
                }
            }
        }
    }

    return undefined;
}

export async function generateMetadata({ params }: Pick<ProductPageProps, "params">): Promise<Metadata> {
    const { slug } = await params;
    if (!slug) {
        notFound();
    }

    const product = await loadProductDetail(slug);
    if (!product) {
        notFound();
    }

    const primaryVariant = product.variants[0];
    const productPrice = primaryVariant?.finalPrice;
    const productOldPrice = primaryVariant?.unitPrice;
    const guarantee = extractGuarantee(product);

    const otherMeta: Record<string, string | undefined> = {
        product_id: product.id,
        product_name: product.title,
        product_price: typeof productPrice === "number" ? String(productPrice) : undefined,
        product_old_price: typeof productOldPrice === "number" ? String(productOldPrice) : undefined,
        availability: product.hasInventory ? "instock" : "outofstock",
        guarantee,
    };

    const { metadata } = await generatePageMetadata({
        slug: `/product/${slug}`,
        defaults: {
            title: product.seoTitle || product.title,
            description: product.seoDescription || product.description,
            image: primaryVariant?.mediaThumbId
                ? { id: primaryVariant.mediaThumbId, alt: product.title }
                : undefined,
        },
        other: otherMeta,
    });


    return metadata;
}

export default async function Page({ params, searchParams }: ProductPageProps) {
    const { slug } = await params;
    if (!slug) {
        notFound();
    }
    return <ProductView slug={slug} searchParams={await searchParams} />;
}
