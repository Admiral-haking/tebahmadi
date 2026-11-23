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

const oldTypeNames = ['گیاه دارویی و ادویه', 'دمنوش و ترکیب گیاهی', 'عسل و فرآورده طبیعی'];
const oldCategoryPaths = ['herbal-plants', 'herbal-teas', 'spices', 'natural-oils', 'honey-natural'];
const oldProductSlugs = ['gol-gavzaban', 'herbal-tea-relax', 'honey-mountain'];
const oldProductSkus = ['TA-GOL-GAVZABAN', 'TA-HERBAL-TEA-RELAX', 'TA-HONEY-MOUNTAIN'];

await products.deleteMany({
  $or: [
    { slug: { $in: oldProductSlugs } },
    { 'variants.sku': { $in: oldProductSkus } },
  ],
});
await categories.deleteMany({ path: { $in: oldCategoryPaths } });
await productTypes.deleteMany({ name: { $in: oldTypeNames } });

const now = new Date();
const typeDefinitions = [
  {
    name: 'روغن‌های گیاهی مراقبت بدن',
    attributes: [
      { key: 'weightGrams', label: 'وزن خالص', kind: 'number', required: true, variant: true, filterable: true, unit: 'گرم', min: 1 },
      { key: 'volumeMl', label: 'حجم', kind: 'number', variant: true, filterable: true, unit: 'میلی‌لیتر', min: 1 },
      { key: 'ingredients', label: 'ترکیبات', kind: 'text', searchable: true },
      { key: 'usage', label: 'روش مصرف', kind: 'text' },
      { key: 'applicationArea', label: 'ناحیه مصرف', kind: 'text', filterable: true },
      { key: 'warning', label: 'هشدار مصرف', kind: 'text' },
      { key: 'storage', label: 'شرایط نگهداری', kind: 'text' },
    ],
  },
  {
    name: 'بهداشت و مراقبت طبیعی بدن',
    attributes: [
      { key: 'weightGrams', label: 'وزن خالص', kind: 'number', required: true, variant: true, filterable: true, unit: 'گرم', min: 1 },
      { key: 'ingredients', label: 'ترکیبات', kind: 'text', searchable: true },
      { key: 'usage', label: 'روش مصرف', kind: 'text' },
      { key: 'applicationArea', label: 'ناحیه مصرف', kind: 'text', filterable: true },
      { key: 'claimedDurationHours', label: 'ماندگاری اعلامی (ساعت)', kind: 'number', filterable: true, min: 0 },
      { key: 'skinNote', label: 'راهنمای سازگاری با پوست', kind: 'text' },
      { key: 'warning', label: 'هشدار مصرف', kind: 'text' },
      { key: 'storage', label: 'شرایط نگهداری', kind: 'text' },
    ],
  },
];

const typeIds = new Map();
for (const type of typeDefinitions) {
  const result = await productTypes.findOneAndUpdate(
    { name: type.name },
    { $set: { ...type, version: 1, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true, returnDocument: 'after' },
  );
  typeIds.set(type.name, result._id);
}

const categoryDefinitions = [
  { name: 'روغن‌های طبیعی', slug: 'natural-oils', type: 'روغن‌های گیاهی مراقبت بدن', position: 0, seoTitle: 'روغن‌های طبیعی و گیاهی | طب احمدی', seoDescription: 'خرید روغن‌های طبیعی و گیاهی طب احمدی با اطلاعات کامل مصرف و نگهداری.' },
  { name: 'بهداشت و مراقبت بدن', slug: 'body-care', type: 'بهداشت و مراقبت طبیعی بدن', position: 1, seoTitle: 'محصولات بهداشت و مراقبت بدن | طب احمدی', seoDescription: 'محصولات بهداشت و مراقبت بدن طب احمدی برای استفاده روزمره.' },
];

const categoryIds = new Map();
for (const category of categoryDefinitions) {
  const result = await categories.findOneAndUpdate(
    { path: category.slug },
    {
      $set: {
        name: category.name,
        slug: category.slug,
        path: category.slug,
        depth: 0,
        position: category.position,
        isActive: true,
        seoTitle: category.seoTitle,
        seoDescription: category.seoDescription,
        productTypeId: typeIds.get(category.type),
        updatedAt: now,
      },
      $setOnInsert: { parentId: null, ancestors: [], createdAt: now },
    },
    { upsert: true, returnDocument: 'after' },
  );
  categoryIds.set(category.slug, result._id);
}

const productsToSeed = [
  {
    slug: 'slimming-oil',
    title: 'روغن لاغری (چربی‌سوز قوی)',
    type: 'روغن‌های گیاهی مراقبت بدن',
    category: 'natural-oils',
    sku: 'TA-SLIMMING-OIL',
    description: 'روغن گیاهی طب احمدی با ترکیبی از گلنار فارسی، دارچین، زنجبیل، شوید، میخک، زیره، رازیانه و انیسون. این محصول برای استفاده موضعی در روتین مراقبت بدن و ماساژ شکم و پهلو تهیه شده است. پیش از مصرف روی بخش کوچکی از پوست تست شود و از تماس با چشم، زخم و پوست تحریک‌شده خودداری کنید. این محصول جایگزین تشخیص، پیشگیری یا درمان پزشکی، رژیم غذایی یا مشاوره پزشک نیست.',
    attributeValues: [
      { key: 'ingredients', value: 'گلنار فارسی، دارچین، زنجبیل، شوید، میخک، زیره، رازیانه، انیسون و سایر ترکیبات گیاهی اعلام‌شده' },
      { key: 'usage', value: 'مقدار مناسبی روی پوست تمیز شکم و پهلو بزنید و با حرکت دورانی ماساژ دهید؛ مقدار و دفعات مصرف مطابق برچسب محصول باشد.' },
      { key: 'applicationArea', value: 'شکم و پهلو، فقط مصرف موضعی' },
      { key: 'warning', value: 'پیش از مصرف تست حساسیت انجام شود. در بارداری، شیردهی، بیماری زمینه‌ای یا مصرف دارو با پزشک مشورت کنید.' },
      { key: 'storage', value: 'در جای خشک و خنک و دور از نور مستقیم نگهداری شود.' },
    ],
    attrs: { ingredients: 'گلنار فارسی، دارچین، زنجبیل، شوید، میخک، زیره، رازیانه، انیسون و سایر ترکیبات گیاهی اعلام‌شده', usage: 'مصرف موضعی روی پوست تمیز شکم و پهلو و ماساژ دورانی', applicationArea: 'شکم و پهلو', warning: 'تست حساسیت پیش از مصرف؛ جایگزین درمان پزشکی نیست', storage: 'جای خشک و خنک، دور از نور مستقیم' },
    searchableText: 'روغن لاغری چربی سوز قوی روغن گیاهی طب احمدی شکم پهلو گلنار فارسی دارچین زنجبیل شوید میخک زیره رازیانه انیسون',
    seoTitle: 'روغن لاغری گیاهی طب احمدی | روغن مراقبت شکم و پهلو',
    seoDescription: 'روغن گیاهی طب احمدی با ترکیبات سنتی برای استفاده موضعی و ماساژ شکم و پهلو؛ مشاهده ترکیبات، روش مصرف و هشدارها.',
  },
  {
    slug: 'tab-ahmadi-deodorant-powder',
    title: 'پودر عرق‌گیر طب احمدی – ۲۰ گرم',
    type: 'بهداشت و مراقبت طبیعی بدن',
    category: 'body-care',
    sku: 'TA-DEODORANT-POWDER-20G',
    description: 'پودر عرق‌گیر طب احمدی، محصولی سبک و قابل‌حمل برای کمک به کنترل رطوبت و کاهش بوی نامطبوع بدن و پا در استفاده روزانه است. وزن محصول ۲۰ گرم است و می‌تواند همراه همیشگی شما در خانه، محل کار و سفر باشد. ماندگاری اعلامی محصول تا ۱۲۰ ساعت است و نتیجه مصرف به شرایط پوست و نحوه استفاده بستگی دارد. پیش از مصرف روی بخش کوچکی از پوست تست شود و روی پوست زخمی یا تحریک‌شده استفاده نشود.',
    attributeValues: [
      { key: 'ingredients', value: 'ترکیبات پودری عرق‌گیر طبق برچسب محصول' },
      { key: 'usage', value: 'مقدار کمی از پودر را روی پوست کاملاً تمیز و خشک استفاده کنید؛ از تماس با چشم و تنفس مستقیم پودر خودداری شود.' },
      { key: 'applicationArea', value: 'پا و نواحی مستعد تعریق، طبق برچسب محصول' },
      { key: 'claimedDurationHours', value: 120 },
      { key: 'skinNote', value: 'برای مصرف روزانه؛ تست روی بخش کوچکی از پوست پیش از مصرف کامل توصیه می‌شود.' },
      { key: 'warning', value: 'در صورت قرمزی، خارش یا سوزش مصرف را متوقف کنید. روی زخم و پوست تحریک‌شده استفاده نشود.' },
      { key: 'storage', value: 'در جای خشک، خنک و دور از دسترس کودکان نگهداری شود.' },
    ],
    attrs: { weightGrams: 20, ingredients: 'ترکیبات پودری عرق‌گیر طبق برچسب محصول', usage: 'مصرف مقدار کمی روی پوست تمیز و خشک', applicationArea: 'پا و نواحی مستعد تعریق', claimedDurationHours: 120, skinNote: 'تست روی بخش کوچکی از پوست پیش از مصرف کامل', warning: 'روی زخم و پوست تحریک‌شده استفاده نشود', storage: 'جای خشک و خنک، دور از دسترس کودکان' },
    searchableText: 'پودر عرق گیر طب احمدی ۲۰ گرم بوی عرق بوی بد پا مراقبت بدن',
    seoTitle: 'پودر عرق‌گیر طب احمدی ۲۰ گرم | مراقبت بدن',
    seoDescription: 'پودر عرق‌گیر طب احمدی با وزن ۲۰ گرم برای کمک به کاهش رطوبت و بوی نامطبوع بدن و پا؛ مشاهده روش مصرف و هشدارها.',
    weightGrams: 20,
  },
];

for (const item of productsToSeed) {
  const existing = await products.findOne({ slug: item.slug }, { projection: { variants: 1 } });
  const currentVariant = existing?.variants?.find((variant) => variant?.sku === item.sku);
  const variant = {
    _id: currentVariant?._id ?? new mongoose.Types.ObjectId(),
    sku: item.sku,
    attributeValues: item.weightGrams ? [{ key: 'weightGrams', value: item.weightGrams }] : [],
    price: { model: 'fixed', amount: 0, unitOfMeasure: 'unit' },
    inventory: { trackingUnit: 'unit', quantity: 0, lowStockThreshold: 0, frozen: true },
    active: false,
    createdAt: currentVariant?.createdAt ?? now,
    updatedAt: now,
  };
  await products.updateOne(
    { slug: item.slug },
    {
      $set: {
        productTypeId: typeIds.get(item.type),
        typeVersion: 1,
        title: item.title,
        brand: 'طب احمدی',
        description: item.description,
        attributeValues: item.attributeValues,
        attrs: { ...item.attrs, ...(item.weightGrams ? { weightGrams: item.weightGrams } : {}) },
        variants: [variant],
        categories: [categoryIds.get(item.category)],
        searchableText: item.searchableText,
        seoTitle: item.seoTitle,
        seoDescription: item.seoDescription,
        status: 'draft',
        showInCart: false,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
}

console.log(`کاتالوگ واقعی آماده شد: ${typeDefinitions.length} نوع محصول، ${categoryDefinitions.length} دسته‌بندی و ${productsToSeed.length} پیش‌نویس محصول`);
await mongoose.disconnect();
