import mongoose from 'mongoose';
import fs from 'node:fs';

if (process.env.NODE_ENV === 'production') {
  throw new Error('این seed فقط برای محیط local است.');
}

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

loadEnvFile('.env.local');
const uri = process.env.MONGO_URI;
if (!uri) throw new Error('MONGO_URI تنظیم نشده است.');

await mongoose.connect(uri);
const db = mongoose.connection;
const productTypes = db.collection('producttypes');
const categories = db.collection('categories');
const products = db.collection('products');

const types = [
  {
    name: 'گیاه دارویی و ادویه', version: 1,
    attributes: [
      { key: 'weightGrams', label: 'وزن خالص', kind: 'number', required: true, variant: true, filterable: true, unit: 'گرم' },
      { key: 'origin', label: 'خاستگاه', kind: 'text', filterable: true },
      { key: 'form', label: 'شکل محصول', kind: 'enum', enumValues: ['خشک', 'پودر', 'دانه'], filterable: true },
      { key: 'ingredients', label: 'ترکیبات', kind: 'text' },
      { key: 'usage', label: 'روش مصرف', kind: 'text' },
      { key: 'warning', label: 'هشدار مصرف', kind: 'text' },
    ],
  },
  {
    name: 'دمنوش و ترکیب گیاهی', version: 1,
    attributes: [
      { key: 'weightGrams', label: 'وزن خالص', kind: 'number', required: true, variant: true, filterable: true, unit: 'گرم' },
      { key: 'ingredients', label: 'ترکیبات', kind: 'text' },
      { key: 'brewing', label: 'روش دم‌آوری', kind: 'text' },
      { key: 'usage', label: 'روش مصرف', kind: 'text' },
      { key: 'warning', label: 'هشدار مصرف', kind: 'text' },
    ],
  },
  {
    name: 'عسل و فرآورده طبیعی', version: 1,
    attributes: [
      { key: 'weightGrams', label: 'وزن خالص', kind: 'number', required: true, variant: true, filterable: true, unit: 'گرم' },
      { key: 'source', label: 'منبع محصول', kind: 'text', filterable: true },
      { key: 'ingredients', label: 'ترکیبات', kind: 'text' },
      { key: 'storage', label: 'شرایط نگهداری', kind: 'text' },
      { key: 'warning', label: 'هشدار مصرف', kind: 'text' },
    ],
  },
];

const typeIds = new Map();
for (const type of types) {
  const result = await productTypes.findOneAndUpdate(
    { name: type.name },
    { $set: { ...type, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  );
  typeIds.set(type.name, result._id);
}

const categoryRows = [
  ['گیاهان دارویی', 'herbal-plants', 'گیاه دارویی و ادویه'],
  ['دمنوش‌ها', 'herbal-teas', 'دمنوش و ترکیب گیاهی'],
  ['ادویه و چاشنی', 'spices', 'گیاه دارویی و ادویه'],
  ['روغن‌های طبیعی', 'natural-oils', 'عسل و فرآورده طبیعی'],
  ['عسل و فرآورده‌های طبیعی', 'honey-natural', 'عسل و فرآورده طبیعی'],
];
for (const [name, slug, typeName] of categoryRows) {
  await categories.updateOne(
    { path: slug },
    { $set: { name, slug, path: slug, depth: 0, position: categoryRows.findIndex((row) => row[1] === slug), isActive: true, productTypeId: typeIds.get(typeName), updatedAt: new Date() }, $setOnInsert: { ancestors: [], parentId: null, createdAt: new Date() } },
    { upsert: true },
  );
}

const categoryIds = new Map();
for (const [, slug] of categoryRows) {
  const category = await categories.findOne({ path: slug }, { projection: { _id: 1 } });
  if (category) categoryIds.set(slug, category._id);
}

const sampleProducts = [
  { slug: 'gol-gavzaban', title: 'گل گاوزبان ممتاز', type: 'گیاه دارویی و ادویه', category: 'herbal-plants', price: 185000, weight: 100, attrs: { origin: 'دامنه‌های البرز', form: 'خشک', ingredients: 'گل گاوزبان خالص', usage: 'یک قاشق غذاخوری در یک لیوان آب جوش؛ ۱۵ دقیقه دم بکشد.', warning: 'در صورت بارداری یا مصرف دارو با پزشک مشورت شود.' } },
  { slug: 'herbal-tea-relax', title: 'دمنوش آرامش شب', type: 'دمنوش و ترکیب گیاهی', category: 'herbal-teas', price: 240000, weight: 80, attrs: { ingredients: 'گل محمدی، به‌لیمو و اسطوخودوس', brewing: 'یک قاشق در آب جوش، ۱۰ دقیقه دم‌آوری', usage: 'روزانه یک تا دو فنجان', warning: 'حساسیت به ترکیبات را بررسی کنید.' } },
  { slug: 'honey-mountain', title: 'عسل کوهستان طبیعی', type: 'عسل و فرآورده طبیعی', category: 'honey-natural', price: 420000, weight: 500, attrs: { source: 'کوهستان', ingredients: 'عسل خالص', storage: 'در جای خشک و خنک، دور از نور مستقیم', warning: 'برای کودکان زیر یک سال توصیه نمی‌شود.' } },
];
for (const item of sampleProducts) {
  const type = typeIds.get(item.type);
  const categoryId = categoryIds.get(item.category);
  const now = new Date();
  await products.updateOne(
    { slug: item.slug },
    { $set: {
      productTypeId: type, typeVersion: 1, title: item.title, slug: item.slug,
      description: `محصول طبیعی ${item.title} با اطلاعات روشن برای خرید آگاهانه.`, brand: 'طب احمدی',
      attributeValues: [{ key: 'weightGrams', value: item.weight }], attrs: { ...item.attrs, weightGrams: item.weight },
      categories: categoryId ? [categoryId] : [], searchableText: `${item.title} ${Object.values(item.attrs).join(' ')}`,
      status: 'active', showInCart: true, seoTitle: `${item.title} | طب احمدی`, seoDescription: `خرید ${item.title} از فروشگاه طب احمدی.`,
      variants: [{ sku: `TA-${item.slug.toUpperCase()}`, attributeValues: [{ key: 'weightGrams', value: item.weight }], price: { model: 'fixed', amount: item.price, unitOfMeasure: 'unit' }, inventory: { trackingUnit: 'unit', quantity: 25, lowStockThreshold: 5 }, active: true, updatedAt: now, createdAt: now }], updatedAt: now,
    }, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );
}

console.log(`کاتالوگ آزمایشی آماده شد: ${types.length} نوع محصول، ${categoryRows.length} دسته‌بندی و ${sampleProducts.length} محصول`);
await mongoose.disconnect();
