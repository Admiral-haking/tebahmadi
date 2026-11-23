import type { Metadata } from "next";

import CartPageContent from "@/components/cart/CartPageContent";
import BuyLinkHandler from "@/components/cart/BuyLinkHandler";
import { generatePageMetadata } from "@/seo/services/metadataGenerator";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
    const { metadata } = await generatePageMetadata({ slug: "/cart" });
    return metadata;
}

export default async function Page() {
    return <>
        <BuyLinkHandler />
        <CartPageContent />
    </>
}
