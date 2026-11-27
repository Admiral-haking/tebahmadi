import mongoose from 'mongoose';
import fs from 'node:fs';

import { naturalCatalogInput } from './natural-catalog-input.mjs';
import { getMissingNaturalProductFields } from './natural-product-readiness.mjs';

const allowProduction = process.argv.includes('--allow-production');
const dryRun = process.argv.includes('--dry-run');

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function unwrapFindOneAndUpdateResult(result) {
  return result && Object.prototype.hasOwnProperty.call(result, 'value') ? result.value : result;
}

function asPlainObject(value) {
  if (!value || typeof value !== 'object') return {};
  if (value instanceof Map) return Object.fromEntries(value.entries());
  return { ...value };
}

function mergeAttributeDefinitions(existing = [], incoming = []) {
  const byKey = new Map();
  for (const attribute of existing) {
    if (attribute?.key) byKey.set(attribute.key, { ...attribute });
  }
  for (const attribute of incoming) {
    if (!attribute?.key) continue;
    byKey.set(attribute.key, { ...byKey.get(attribute.key), ...attribute });
  }
  return [...byKey.values()];
}

function mergeAttributes(existing, incoming, missingFields, item) {
  return {
    ...asPlainObject(existing),
    ...asPlainObject(incoming),
    catalogDataStatus: missingFields.length === 0 ? 'complete' : 'incomplete',
    missingRequiredFields: missingFields,
    safetyReviewRequired: item.requiresSafetyReview === true,
    dataSource: 'supplier-input-2026-11-24',
  };
}

function targetMatches(product, item) {
  return product?.slug === item.slug || (product?.variants ?? []).some((variant) => variant?.sku === item.sku);
}

function findTargetProduct(products, item) {
  const matches = products.filter((product) => targetMatches(product, item));
  if (matches.length > 1) {
    throw new Error(`برای ${item.slug} چند رکورد متناقض پیدا شد.`);
  }
  const product = matches[0] ?? null;
  if (product && product.slug === item.slug && !(product.variants ?? []).some((variant) => variant?.sku === item.sku)) {
    throw new Error(`محصول ${item.slug} وجود دارد اما SKU هدف ${item.sku} در آن نیست.`);
  }
  return product;
}

function assertInputIntegrity() {
  const slugs = new Set();
  const skus = new Set();
  for (const item of naturalCatalogInput) {
    if (!item.slug || !item.sku) throw new Error('هر کالای ورودی باید slug و SKU داشته باشد.');
    if (slugs.has(item.slug)) throw new Error(`slug تکراری در ورودی: ${item.slug}`);
    if (skus.has(item.sku)) throw new Error(`SKU تکراری در ورودی: ${item.sku}`);
    slugs.add(item.slug);
    skus.add(item.sku);
  }
}

async function upsertProductType(productTypes, item, now) {
  const current = await productTypes.findOne({ name: item.typeName }, { projection: { attributes: 1, version: 1 } });
  const attributes = mergeAttributeDefinitions(current?.attributes ?? [], item.typeAttributes ?? []);
  const result = await productTypes.findOneAndUpdate(
    { name: item.typeName },
    {
      $set: {
        name: item.typeName,
        version: current?.version ?? 1,
        attributes,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: 'after' },
  );
  const document = unwrapFindOneAndUpdateResult(result);
  if (!document?._id) throw new Error(`نوع محصول ${item.typeName} ساخته نشد.`);
  return document;
}

async function upsertCategory(categories, item, productTypeId, now) {
  const result = await categories.findOneAndUpdate(
    { path: item.categoryPath },
    {
      $set: {
        name: item.categoryName,
        slug: item.categoryPath,
        path: item.categoryPath,
        depth: 0,
        position: item.categoryPosition ?? 2,
        isActive: item.categoryActive !== false,
        seoTitle: `${item.categoryName} | طب احمدی`,
        seoDescription: `محصولات ${item.categoryName} طب احمدی با اطلاعات ترکیبات، مصرف و هشدارها.`,
        productTypeId,
        updatedAt: now,
      },
      $setOnInsert: { parentId: null, ancestors: [], createdAt: now },
    },
    { upsert: true, returnDocument: 'after' },
  );
  const document = unwrapFindOneAndUpdateResult(result);
  if (!document?._id) throw new Error(`دسته ${item.categoryPath} ساخته نشد.`);
  return document;
}

function variantForInsert(item, now) {
  return {
    _id: new mongoose.Types.ObjectId(),
    sku: item.sku,
    attributeValues: item.variantAttributeValues ?? [],
    price: { model: 'fixed', amount: 0, unitOfMeasure: 'unit' },
    inventory: { trackingUnit: 'unit', quantity: 0, lowStockThreshold: 0, frozen: true },
    active: false,
    createdAt: now,
    updatedAt: now,
  };
}

function buildStatusMetadata(item, missingFields) {
  return {
    catalogDataStatus: missingFields.length === 0 ? 'complete' : 'incomplete',
    missingRequiredFields: missingFields,
    safetyReviewRequired: item.requiresSafetyReview === true,
    dataSource: 'supplier-input-2026-11-24',
  };
}

function shouldDeactivate(item, missingFields, existingProduct) {
  if (!existingProduct) return true;
  if (item.forceInactive === true || item.requiresSafetyReview === true) return true;
  if (missingFields.length > 0) return true;
  return item.preserveExistingActivation !== true;
}

function actionFor(item, missingFields, existingProduct) {
  if (!existingProduct) return 'create-draft-inactive';
  if (item.forceInactive === true || item.requiresSafetyReview === true) return 'deactivate-safety-review';
  if (missingFields.length > 0) return 'keep-draft-incomplete';
  if (item.preserveExistingActivation === true) return 'update-preserve-existing-activation';
  return 'keep-draft-unpublished';
}

async function main() {
  assertInputIntegrity();
  loadEnvFile('.env.local');

  if (process.env.NODE_ENV === 'production' && !allowProduction) {
    throw new Error('برای اجرای این migration در production باید --allow-production را صریحاً وارد کنید.');
  }

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI تنظیم نشده است.');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 30_000,
  });

  try {
    const db = mongoose.connection;
    const productTypes = db.collection('producttypes');
    const categories = db.collection('categories');
    const products = db.collection('products');
    const now = new Date();
    const slugs = naturalCatalogInput.map((item) => item.slug);
    const skus = naturalCatalogInput.map((item) => item.sku);

    const existingProducts = await products.find(
      { $or: [{ slug: { $in: slugs } }, { 'variants.sku': { $in: skus } }] },
      { projection: { slug: 1, title: 1, status: 1, showInCart: 1, variants: 1 } },
    ).limit(100).maxTimeMS(10_000).toArray();

    const targets = naturalCatalogInput.map((item) => {
      const product = findTargetProduct(existingProducts, item);
      const missingFields = getMissingNaturalProductFields(item);
      return { item, product, missingFields, action: actionFor(item, missingFields, product) };
    });

    const productToTargets = new Map();
    for (const target of targets) {
      if (!target.product) continue;
      const id = String(target.product._id);
      const list = productToTargets.get(id) ?? [];
      list.push(target.item.slug);
      productToTargets.set(id, list);
    }
    for (const [id, itemSlugs] of productToTargets) {
      if (itemSlugs.length > 1) throw new Error(`یک رکورد دیتابیس با چند کالای ورودی تطبیق دارد (${id}).`);
    }

    const incompleteCount = targets.filter((target) => target.missingFields.length > 0).length;
    const existingCount = targets.filter((target) => target.product).length;
    const deactivateCount = targets.filter((target) => target.action === 'deactivate-safety-review').length;
    console.log(`پیش‌بررسی: ${existingCount} رکورد موجود، ${naturalCatalogInput.length - existingCount} رکورد جدید، ${incompleteCount} کالا بدون اندازه‌گیری کامل، ${deactivateCount} مورد غیرفعال‌سازی ایمنی.`);
    for (const target of targets) {
      const missing = target.missingFields.length > 0 ? ` | کمبود: ${target.missingFields.join('، ')}` : '';
      console.log(`${target.item.slug} | ${target.product ? 'موجود' : 'جدید'} | ${target.action}${missing}`);
    }

    if (dryRun) {
      console.log('حالت dry-run؛ هیچ تغییری ذخیره نشد.');
      return;
    }

    const typeCache = new Map();
    const categoryCache = new Map();
    let created = 0;
    let updated = 0;
    let deactivated = 0;

    for (const target of targets) {
      const { item, product, missingFields } = target;
      let type = typeCache.get(item.typeName);
      if (!type) {
        type = await upsertProductType(productTypes, item, now);
        typeCache.set(item.typeName, type);
      }
      let category = categoryCache.get(item.categoryPath);
      if (!category) {
        category = await upsertCategory(categories, item, type._id, now);
        categoryCache.set(item.categoryPath, category);
      }

      const attrs = mergeAttributes(product?.attrs, item.attrs, missingFields, item);
      const statusMetadata = buildStatusMetadata(item, missingFields);
      const common = {
        productTypeId: type._id,
        typeVersion: type.version ?? 1,
        title: item.title,
        slug: item.slug,
        brand: 'طب احمدی',
        description: item.description,
        attributeValues: item.attributeValues ?? [],
        attrs,
        categories: [category._id],
        searchableText: item.searchableText,
        seoTitle: item.seoTitle,
        seoDescription: item.seoDescription,
        updatedAt: now,
      };

      if (!product) {
        await products.insertOne({
          _id: new mongoose.Types.ObjectId(),
          ...common,
          attrs: { ...attrs, ...statusMetadata },
          variants: [variantForInsert(item, now)],
          status: 'draft',
          showInCart: false,
          createdAt: now,
        });
        created += 1;
        continue;
      }

      const deactivate = shouldDeactivate(item, missingFields, product);
      const set = {
        ...common,
        attrs: { ...attrs, ...statusMetadata },
        'variants.$[variant].attributeValues': item.variantAttributeValues ?? [],
      };
      if (deactivate) {
        set.status = 'draft';
        set.showInCart = false;
        set['variants.$[variant].active'] = false;
        set['variants.$[variant].inventory.frozen'] = true;
      }

      const result = await products.updateOne(
        { _id: product._id, 'variants.sku': item.sku },
        { $set: set },
        { arrayFilters: [{ 'variant.sku': item.sku }] },
      );
      if (result.matchedCount !== 1) {
        throw new Error(`به‌روزرسانی ${item.slug} کامل نشد.`);
      }
      updated += 1;
      if (deactivate) deactivated += 1;
    }

    console.log(`همگام‌سازی کامل شد: ${created} ساخته، ${updated} به‌روزرسانی، ${deactivated} غیرفعال.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
