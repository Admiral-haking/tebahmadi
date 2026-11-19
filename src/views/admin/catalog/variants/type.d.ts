interface Price {
    model: string;
    amount: number;
    unitOfMeasure: string;
}

interface Offer {
    amount: number;
}

interface Inventory {
    trackingUnit: string;
    quantity: number;
    lowStockThreshold: number;
}

interface ProductReference {
    _id: string;
    title: string;
    slug: string;
    status: string;
}

interface DgkItem {
    _id: string;
    productId: string;
    variantId: string;
    barcode: string;
    dgkVariantId: number;
    dgkProductId: number;
    quantity: number;
    displayName: string;
    vendorId: string;
    createdAt: string;
    updatedAt: string;
    price: number
    __v: number;
}
interface BslItem {
    _id: string;
    productId: string;
    variantId: string;
    barcode: string;
    bslVariantId: number;
    bslProductId: number;
    quantity: number;
    displayName: string;
    vendorId: string;
    createdAt: string;
    updatedAt: string;
    price: number
    sku: string
    __v: number;
}
export interface SnpItem {
    productId?: string
    variantId?: string
    barcode: string
    snpProductId: string
    quantity: number
    displayName: string
    vendorId: string
    price: number
    createdAt: string;
    updatedAt: string;
    _id: string

}

export interface VariantResponse {
    displayName: string;
    _id: string;
    sku: string;
    price: Price;
    offer: Offer;
    inventory: Inventory;
    mediaIds: string[];
    barcode: string;
    active: boolean;
    colorKey: string;
    colorName: string;
    colorSwatches: string[];
    colorFamily: string;
    createdAt: string;
    updatedAt: string;
    product: ProductReference;
    dgk: DgkItem[];
    bsl: BslItem[];
    snp: SnpItem[]
}