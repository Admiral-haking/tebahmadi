import type { ProductDetailData } from "../data";
import ProductDetailClient from "./view.client";

export default function ProductDetailView({
    product,
    initialVariantId,
}: {
    product: ProductDetailData;
    initialVariantId?: string;
}) {
    return <ProductDetailClient product={product} initialVariantId={initialVariantId} />;
}
