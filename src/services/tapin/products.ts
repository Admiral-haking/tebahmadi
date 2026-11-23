import { tapinRequest } from './client';

export type TapinProduct = {
  product_id: number;
  title: string;
  category_id: string;
  weight: number;
  price: number;
  description?: string | null;
  created_at?: string | null;
};

export type TapinProductInput = {
  title: string;
  category_id: string;
  weight: number;
  price: number;
  description?: string | null;
};

export const listTapinProducts = (
  page = 1,
  count = 20,
  filters: { title?: string; productId?: number; categoryId?: string; shopId?: string } = {},
) =>
  tapinRequest<{ list: TapinProduct[]; page: number; count: number; total_count: number }>(
    'product/list',
    {
      page,
      count,
      title: filters.title,
      product_id: filters.productId,
      category_id: filters.categoryId,
      shop_id: filters.shopId,
    },
    { retrySafe: true },
  );

export const listTapinProductCategories = (shopId?: string) =>
  tapinRequest<{
    list: Array<{ category_id: string; title: string; parent_category_id: string | null }>;
    total_count: number;
  }>('product/category/list', { page: 1, count: 500, shop_id: shopId }, { retrySafe: true });

export const createTapinProduct = (input: TapinProductInput, shopId?: string) =>
  tapinRequest<TapinProduct>('product/create', { ...input, shop_id: shopId });

export const updateTapinProduct = (productId: number, input: TapinProductInput, shopId?: string) =>
  tapinRequest<TapinProduct>('product/update', {
    product_id: productId,
    ...input,
    shop_id: shopId,
  });

export const deleteTapinProduct = (productId: number, shopId?: string) =>
  tapinRequest<TapinProduct>('product/delete', { product_id: productId, shop_id: shopId });
