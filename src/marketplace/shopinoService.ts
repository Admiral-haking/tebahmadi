import { Types } from 'mongoose';
import { connectMongoose } from '@/lib/mongoose';
import ProductModel from '@/catalog/models/Product';
import CategoryModel from '@/catalog/models/Category';
import ProductTypeModel from '@/catalog/models/ProductType';
import MediaModel from '@/media/models/Media';
import { InvoiceModel } from '@/orders/models/Invoice';
import { adjustInventoryForInvoice } from '@/orders/services/invoiceService';
import type {
  ShopinoProduct,
  ShopinoVariation,
  ShopinoAttribute,
  ShopinoSpec,
  ShopinoProductsListResponse,
  ShopinoProductResponse,
} from './shopinoTypes';

const APP_BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tebahmadi.ir/').replace(/\/+$/, '');
const PRODUCTS_PER_PAGE = 20;

/**
 * Safely resolve media IDs to full URLs.
 */
async function resolveMediaUrls(mediaIds: Types.ObjectId[]): Promise<string[]> {
  if (!mediaIds.length) return [];
  const mediaDocs = await MediaModel.find({ _id: { $in: mediaIds } })
    .lean()
    .exec();
  return mediaDocs.map((doc) => {
    const filename = doc.filename || 'file';
    const id = doc._id.toString();
    return `${APP_BASE_URL}/api/media/${id}/${filename}`;
  });
}

/**
 * Get category names for a product's category IDs (from root to leaf).
 */
async function getCategoryNames(categoryIds: Types.ObjectId[]): Promise<string[]> {
  if (!categoryIds.length) return [];
  const categories = await CategoryModel.find({ _id: { $in: categoryIds } })
    .sort({ depth: 1 })
    .lean()
    .exec();
  return categories.map((cat) => cat.name);
}

/**
 * Build a map of attribute key → label from the ProductType.
 */
async function getAttributeNameMap(productTypeId: Types.ObjectId): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  try {
    const productType = await ProductTypeModel.findById(productTypeId).lean().exec();
    if (productType && Array.isArray((productType as any).attributes)) {
      for (const attr of (productType as any).attributes) {
        if (attr.key && attr.label) {
          nameMap.set(attr.key, attr.label);
        }
      }
    }
  } catch {
    // silently ignore
  }
  return nameMap;
}

/**
 * Convert a value to string representation for specs/attributes.
 */
function valueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return (obj.name as string) || (obj.value as string) || JSON.stringify(value);
  }
  return String(value);
}

/**
 * Transform a single product document into Shopino format.
 */
async function transformProduct(product: any): Promise<ShopinoProduct | null> {
  if (!product) return null;

  const productId = product._id?.toString?.() || String(product._id);
  const slug = product.slug || productId;

  // Build category names
  const rawCategoryIds: any[] = Array.isArray(product.categories) ? product.categories : [];
  const categoryIds = rawCategoryIds
    .map((id: any) => (Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null))
    .filter(Boolean) as Types.ObjectId[];
  const categoryNames = await getCategoryNames(categoryIds);

  // Get attribute labels from ProductType
  let attrNameMap = new Map<string, string>();
  if (product.productTypeId && Types.ObjectId.isValid(product.productTypeId)) {
    attrNameMap = await getAttributeNameMap(new Types.ObjectId(product.productTypeId));
  }

  // Build specs from product-level attributeValues
  const specs: ShopinoSpec[] = [];
  if (product.brand) {
    specs.push({ name: 'برند', value: product.brand });
  }
  if (Array.isArray(product.attributeValues)) {
    for (const attr of product.attributeValues) {
      const name = attrNameMap.get(attr.key) || attr.key;
      const value = valueToString(attr.value);
      if (name && value) {
        specs.push({ name, value });
      }
    }
  }

  // Collect unique media IDs from all variants for product-level images
  const allVariantMediaIds: Types.ObjectId[] = [];
  const seenMediaIds = new Set<string>();
  if (Array.isArray(product.variants)) {
    for (const variant of product.variants) {
      if (Array.isArray(variant.mediaIds)) {
        for (const mid of variant.mediaIds) {
          const midStr = mid?.toString?.() || String(mid);
          if (!seenMediaIds.has(midStr) && Types.ObjectId.isValid(mid)) {
            seenMediaIds.add(midStr);
            allVariantMediaIds.push(new Types.ObjectId(mid));
          }
        }
      }
    }
  }
  const productImages = allVariantMediaIds.length > 0 ? await resolveMediaUrls(allVariantMediaIds) : [];

  // Transform variations
  const variations: ShopinoVariation[] = [];
  if (Array.isArray(product.variants)) {
    for (const variant of product.variants) {
      if (!variant) continue;

      const variantId = variant._id?.toString?.() || String(variant._id || '');
      const priceAmount = Number(variant.price?.amount ?? 0);
      const offerAmount = variant.offer?.amount;
      const discountedPrice =
        offerAmount !== undefined && offerAmount !== null && Number(offerAmount) >= 0
          ? Number(offerAmount)
          : priceAmount;
      const stockQty = Number(variant.inventory?.quantity ?? 0);

      // Resolve variation-specific images
      const varMediaIds: Types.ObjectId[] = [];
      if (Array.isArray(variant.mediaIds)) {
        for (const mid of variant.mediaIds) {
          if (Types.ObjectId.isValid(mid)) {
            varMediaIds.push(new Types.ObjectId(mid));
          }
        }
      }
      const varImages = varMediaIds.length > 0 ? await resolveMediaUrls(varMediaIds) : [];

      // Build variation attributes
      const attributes: ShopinoAttribute[] = [];
      if (Array.isArray(variant.attributeValues)) {
        for (const attr of variant.attributeValues) {
          const attrName = attrNameMap.get(attr.key) || attr.key;
          const attrValue = valueToString(attr.value);
          attributes.push({
            key: attr.key,
            name: attrName,
            value: attrValue,
          });
        }
      }

      variations.push({
        id: variantId || productId,
        price: priceAmount,
        discounted_price: discountedPrice,
        stock_quantity: stockQty,
        images: varImages,
        attributes,
      });
    }
  }

  const description = product.description || '';
  const url = `${APP_BASE_URL}/product/${slug}`;

  return {
    id: productId,
    title: product.title || '',
    categories: categoryNames,
    specs,
    description,
    images: productImages,
    url,
    variations,
  };
}

/**
 * List active products in Shopino format with pagination.
 */
export async function listShopinoProducts(
  page: number = 1,
  limit: number = PRODUCTS_PER_PAGE,
): Promise<ShopinoProductsListResponse> {
  await connectMongoose();

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    ProductModel.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    ProductModel.countDocuments({ status: 'active' }).exec(),
  ]);

  const transformed: ShopinoProduct[] = [];
  for (const product of products) {
    const shopinoProduct = await transformProduct(product);
    if (shopinoProduct) {
      transformed.push(shopinoProduct);
    }
  }

  return {
    products: transformed,
    page,
    total_pages: Math.ceil(total / limit),
    total,
  };
}

/**
 * Get a single product in Shopino format by ID or slug.
 */
export async function getShopinoProduct(
  id: string,
): Promise<ShopinoProductResponse | null> {
  await connectMongoose();

  let product;
  if (Types.ObjectId.isValid(id)) {
    product = await ProductModel.findById(id).lean().exec();
  }
  if (!product) {
    // Try finding by slug
    product = await ProductModel.findOne({ slug: id }).lean().exec();
  }
  if (!product) {
    return null;
  }

  const transformed = await transformProduct(product);
  if (!transformed) return null;

  return { product: transformed };
}

/**
 * Submit a Shopino order into the system's Invoice collection.
 */
export async function submitShopinoOrder(
  payload: any,
): Promise<{ id: number }> {
  await connectMongoose();

  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid payload');
  }

  const {
    order_id,
    first_name,
    last_name,
    province,
    city,
    address,
    postcode,
    phone,
    shipping_title,
    shipping_price,
    note,
    items,
  } = payload;

  if (!order_id) throw new Error('order_id is required');
  if (!first_name || !last_name) throw new Error('first_name and last_name are required');
  if (!province || !city) throw new Error('province and city are required');
  if (!address) throw new Error('address is required');
  if (!phone) throw new Error('phone is required');
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('items array is required');
  }

  const invoiceNumber = `SHOP-${order_id}`;

  const lines = [];
  let subtotal = 0;
  let discountTotal = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const discPrice = Number(item.discounted_price) || price;
    const lineTotal = price * qty;
    const effectiveTotal = discPrice * qty;

    subtotal += lineTotal;
    discountTotal += lineTotal - effectiveTotal;

    // Resolve real product and variant if IDs are valid ObjectIds
    let productId = new Types.ObjectId('000000000000000000000000');
    let variantId = new Types.ObjectId('000000000000000000000000');
    let productSlug = String(item.product_id);
    let productTitle = `Shopino Product #${item.product_id}`;
    let sku = String(item.variation_id);

    if (Types.ObjectId.isValid(item.product_id)) {
      const product = await ProductModel.findById(item.product_id).lean().exec();
      if (product) {
        productId = product._id as Types.ObjectId;
        productSlug = product.slug;
        productTitle = product.title;

        if (Types.ObjectId.isValid(item.variation_id)) {
          const variant = (product.variants as any[]).find(
            (v: any) => v._id?.toString() === String(item.variation_id),
          );
          if (variant) {
            variantId = variant._id;
            sku = variant.sku || sku;
          }
        }
      }
    }

    lines.push({
      productId,
      productSlug,
      variantId,
      sku,
      title: productTitle,
      priceModel: 'fixed' as const,
      qty,
      unitPriceBase: price,
      variantOfferAmount: price - discPrice,
      unitPriceEffective: discPrice,
      lineTotal: effectiveTotal,
      weightGrams: 0,
    });
  }

  const shippingTotal = Number(shipping_price) || 0;
  const grandTotal = subtotal - discountTotal + shippingTotal;

  const invoice = await InvoiceModel.create({
    number: invoiceNumber,
    status: 'pending',
    lines,
    transportName: shipping_title || 'Shopino Shipping',
    shippingPrice: shippingTotal,
    shippingPaymentMethod: 'on_delivery',
    addressSnapshot: {
      fname: first_name,
      lname: last_name,
      phone,
      state: province,
      city,
      address,
      postalCode: postcode,
    },
    subtotal,
    discountTotal,
    shippingTotal,
    grandTotal,
    paymentMethod: 'shopino',
    paymentMethodData: {
      shopinoOrderId: order_id,
      note: note || '',
    },
  });

  try {
    await adjustInventoryForInvoice(invoice, 'deduct');
  } catch (err) {
    console.error('[Shopino] Inventory deduction failed for order', order_id, err instanceof Error ? err.message : err);
  }

  return { id: order_id };
}

/**
 * Get tracking codes for Shopino order IDs.
 */
export async function getShopinoTrackingCodes(
  orderIds: number[],
): Promise<(string | null)[]> {
  await connectMongoose();

  const codes: (string | null)[] = [];

  for (const orderId of orderIds) {
    const invoice = await InvoiceModel.findOne({
      'paymentMethodData.shopinoOrderId': orderId,
    })
      .lean()
      .exec();

    if (invoice) {
      const progress = (invoice as any).progress;
      if (progress?.packagedPostedTrackingNumber) {
        codes.push(progress.packagedPostedTrackingNumber);
      } else {
        codes.push(null);
      }
    } else {
      codes.push(null);
    }
  }

  return codes;
}
