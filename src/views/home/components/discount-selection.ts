import { calculateDiscountPercent } from '@/lib/format';
import type { ProductCardProps } from '@/components/product';

export function selectDiscountProducts(products: ProductCardProps[]): ProductCardProps[] {
  return products.filter((product) => {
    if (!product.inStock) {
      return false;
    }

    const discountPercent = product.discountPercent ?? calculateDiscountPercent(product.originalPrice, product.finalPrice);
    return typeof discountPercent === 'number' && discountPercent > 0;
  });
}
