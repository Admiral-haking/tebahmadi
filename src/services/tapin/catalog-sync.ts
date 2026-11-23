import { Types } from 'mongoose';

import ProductModel from '@/catalog/models/Product';
import { getTapinConfig } from './client';
import { createTapinProduct, updateTapinProduct } from './products';

function variantWeight(variant: Record<string, any>): number {
  const raw = variant.attributeValues?.find(
    (item: Record<string, unknown>) => item.key === 'weightGrams',
  )?.value;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

export async function syncCatalogVariantToTapin(
  variantId: string,
  categoryId: string,
  requestedShopId?: string,
) {
  if (!Types.ObjectId.isValid(variantId)) throw new Error('شناسه واریانت معتبر نیست.');
  const product = await ProductModel.findOne({ 'variants._id': variantId }).lean();
  if (!product) throw new Error('محصول داخلی پیدا نشد.');
  const variant = product.variants.find((item) => String(item._id) === variantId) as
    | Record<string, any>
    | undefined;
  if (!variant) throw new Error('واریانت داخلی پیدا نشد.');

  const weight = variantWeight(variant);
  if (weight <= 0) throw new Error(`وزن واریانت ${variant.sku} ثبت نشده است.`);
  const price = Math.max(0, Math.round(Number(variant.price?.amount ?? 0) * 10));
  const attributes = (variant.attributeValues ?? [])
    .filter((item: Record<string, unknown>) => item.key !== 'weightGrams')
    .map((item: Record<string, unknown>) => String(item.value ?? ''))
    .filter(Boolean)
    .join('، ');
  const input = {
    title: `${product.title}${attributes ? ` - ${attributes}` : ''}`.slice(0, 100),
    category_id: categoryId,
    weight,
    price,
    description: product.description?.slice(0, 2000) || null,
  };

  const defaultShopId = getTapinConfig().shopId;
  const shopId = requestedShopId || defaultShopId;
  const mapping = variant.tapinMappings?.find(
    (item: { shopId: string; productId: number }) => item.shopId === shopId,
  );
  const existingId = mapping?.productId ?? (shopId === defaultShopId ? variant.tapinProductId : 0);
  const remote = existingId
    ? await updateTapinProduct(existingId, input, shopId)
    : await createTapinProduct(input, shopId);
  const syncedAt = new Date();

  await ProductModel.updateOne(
    { _id: product._id, 'variants._id': variantId },
    {
      $set:
        shopId === defaultShopId
          ? {
              'variants.$.tapinProductId': remote.product_id,
              'variants.$.tapinCategoryId': categoryId,
              'variants.$.tapinSyncedAt': syncedAt,
            }
          : {},
    },
  );

  const mappingUpdate = await ProductModel.updateOne(
    {
      _id: product._id,
      variants: { $elemMatch: { _id: variantId, 'tapinMappings.shopId': shopId } },
    },
    {
      $set: {
        'variants.$[variant].tapinMappings.$[mapping]': {
          shopId,
          productId: remote.product_id,
          categoryId,
          syncedAt,
        },
      },
    },
    {
      arrayFilters: [
        { 'variant._id': new Types.ObjectId(variantId) },
        { 'mapping.shopId': shopId },
      ],
    },
  );
  if (!mappingUpdate.modifiedCount) {
    await ProductModel.updateOne(
      { _id: product._id, 'variants._id': variantId },
      {
        $push: {
          'variants.$.tapinMappings': {
            shopId,
            productId: remote.product_id,
            categoryId,
            syncedAt,
          },
        },
      },
    );
  }
  return { productId: String(product._id), variantId, sku: variant.sku, remote };
}
