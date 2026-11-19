import type { Metadata } from "next";

import CartPageContent from "@/components/cart/CartPageContent";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";
import { requireAuthenticatedUser } from "@/lib/require-auth";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    const { metadata } = await generatePageMetadata({ slug: "/cart" });
    return metadata;
}

export default async function Page() {
    await requireAuthenticatedUser("/cart");
    return <>
        <CartPageContent />
    </>
}
