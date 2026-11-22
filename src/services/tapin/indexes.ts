import { InvoiceModel } from '@/orders/models/Invoice';
import ProductModel from '@/catalog/models/Product';

let indexPromise: Promise<void> | undefined;

/** Production disables Mongoose autoIndex, so Tapin idempotency indexes are ensured explicitly. */
export function ensureTapinIndexes(): Promise<void> {
  indexPromise ??= Promise.all([
    InvoiceModel.collection.createIndex(
      { 'tapinShipment.orderId': 1 },
      {
        unique: true,
        name: 'tapinShipment_orderId_unique',
        partialFilterExpression: { 'tapinShipment.orderId': { $type: 'number' } },
      },
    ),
    ProductModel.collection.createIndex(
      { 'variants.tapinMappings.shopId': 1, 'variants.tapinMappings.productId': 1 },
      {
        unique: true,
        sparse: true,
        name: 'tapin_variant_shop_product_unique',
      },
    ),
  ])
    .then(() => undefined)
    .catch((error) => {
      indexPromise = undefined;
      throw error;
    });
  return indexPromise;
}
