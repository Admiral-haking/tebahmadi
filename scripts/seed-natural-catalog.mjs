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
const oldCategoryPaths = ['herbal-plants', 'herbal-teas', 'spices', 'natural-oils', 'body-care', 'skin-hair-care', 'honey-natural'];
const oldProductSlugs = ['gol-gavzaban', 'herbal-tea-relax', 'honey-mountain', 'slimming-oil', 'tab-ahmadi-deodorant-powder', 'unwanted-hair-oil'];
const oldProductSkus = ['TA-GOL-GAVZABAN', 'TA-HERBAL-TEA-RELAX', 'TA-HONEY-MOUNTAIN', 'TA-SLIMMING-OIL', 'TA-DEODORANT-POWDER-20G', 'TA-UNWANTED-HAIR-OIL'];

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
  {
    name: 'مراقبت پوست و مو',
    attributes: [
      { key: 'volumeMl', label: 'حجم', kind: 'number', variant: true, filterable: true, unit: 'میلی‌لیتر', min: 1 },
      { key: 'ingredients', label: 'ترکیبات', kind: 'text', searchable: true },
      { key: 'usage', label: 'روش مصرف', kind: 'text' },
      { key: 'applicationArea', label: 'ناحیه مصرف', kind: 'text', filterable: true },
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
  { name: 'مراقبت پوست و مو', slug: 'skin-hair-care', type: 'مراقبت پوست و مو', position: 2, seoTitle: 'محصولات مراقبت پوست و مو | طب احمدی', seoDescription: 'محصولات موضعی مراقبت پوست و مو طب احمدی با اطلاعات ترکیبات، مصرف و هشدارها.' },
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
    description: 'روغن گیاهی طب احمدی با حجم ۶۰ سی‌سی و ترکیبی از گلنار فارسی، دارچین، زنجبیل، شوید، میخک، زیره، رازیانه و انیسون. این محصول برای استفاده موضعی در روتین مراقبت بدن و ماساژ شکم و پهلو تهیه شده است. روزانه مقدار مناسبی روی ناحیه موردنظر بزنید و حدود ۵ دقیقه ماساژ دهید؛ ادامه روش مصرف باید مطابق برچسب رسمی محصول باشد. پیش از مصرف روی بخش کوچکی از پوست تست شود و از تماس با چشم، زخم و پوست تحریک‌شده خودداری کنید. این محصول جایگزین تشخیص، پیشگیری یا درمان پزشکی، رژیم غذایی یا مشاوره پزشک نیست.',
    attributeValues: [
      { key: 'volumeMl', value: 60 },
      { key: 'ingredients', value: 'گلنار فارسی، دارچین، زنجبیل، شوید، میخک، زیره، رازیانه، انیسون و سایر ترکیبات گیاهی اعلام‌شده' },
      { key: 'usage', value: 'روزانه مقدار مناسبی روی پوست تمیز شکم و پهلو بزنید و حدود ۵ دقیقه با حرکت دورانی ماساژ دهید؛ ادامه روش مصرف مطابق برچسب رسمی محصول باشد.' },
      { key: 'applicationArea', value: 'شکم و پهلو، فقط مصرف موضعی' },
      { key: 'warning', value: 'پیش از مصرف تست حساسیت انجام شود. در بارداری، شیردهی، بیماری زمینه‌ای یا مصرف دارو با پزشک مشورت کنید.' },
      { key: 'storage', value: 'در جای خشک و خنک و دور از نور مستقیم نگهداری شود.' },
    ],
    attrs: {
      volumeMl: 60,
      ingredients: 'گلنار فارسی، دارچین، زنجبیل، شوید، میخک، زیره، رازیانه، انیسون و سایر ترکیبات گیاهی اعلام‌شده',
      usage: 'حجم ۶۰ سی‌سی؛ مصرف موضعی روی پوست تمیز شکم و پهلو و ماساژ حدود ۵ دقیقه‌ای',
      applicationArea: 'شکم و پهلو',
      warning: 'تست حساسیت پیش از مصرف؛ جایگزین درمان پزشکی نیست',
      storage: 'جای خشک و خنک، دور از نور مستقیم',
      complianceStatus: 'needs_review',
      supplierDescription: 'روغن لاغری (چربی سوز قوی) یک محصول کاملاً طبیعی و گیاهی با حجم ۶۰ سی‌سی است که با ترکیبات ارزشمند و سنتی فرموله شده است. این روغن با نابود کردن چربی‌های شکم و پهلو، بهبود عملکرد تخمدان، درمان کیست و فیبروم، درمان تنبلی تخمدان و تسکین کامل دردهای پریود، یک راهکار جامع برای سلامتی زنان محسوب می‌شود. ترکیبات این روغن شامل گلنار فارسی، دارچین، زنجبیل، شوید، میخک، زیره و رازیانه، انیسون و سایر ترکیبات اعلام‌شده است.',
      supplierUsageNote: 'روش استفاده اعلام‌شده توسط تأمین‌کننده: روغن را هر روز به ناحیه موردنظر بزنید و به مدت ۵ دقیقه ماساژ دهید؛ سپس مقدار کمی روغن بزنید و روی موضع پلاستیک یا سلفون بکشید و کمی تحرک داشته باشید. در متن تأمین‌کننده ماندن روغن تا ۴ ساعت و استفاده از سشوار به مدت ۲ تا ۳ دقیقه ذکر شده است. این دستور پیش از انتشار عمومی باید از نظر ایمنی و برچسب رسمی بررسی شود. حجم اعلام‌شده: ۶۰ سی‌سی.',
      supplierClaims: 'ادعاهای تأمین‌کننده درباره چربی‌سوزی شکم و پهلو، تخمدان، کیست، فیبروم، تنبلی تخمدان و درد پریود؛ این ادعاها تا زمان تأیید مستندات و مجوز نباید در متن عمومی محصول نمایش داده شوند.',
    },
    searchableText: 'روغن لاغری چربی سوز قوی روغن گیاهی طب احمدی شکم پهلو گلنار فارسی دارچین زنجبیل شوید میخک زیره رازیانه انیسون',
    seoTitle: 'روغن لاغری گیاهی طب احمدی | روغن مراقبت شکم و پهلو',
    seoDescription: 'روغن گیاهی ۶۰ سی‌سی طب احمدی با ترکیبات سنتی برای استفاده موضعی و ماساژ شکم و پهلو؛ مشاهده ترکیبات، روش مصرف و هشدارها.',
    volumeMl: 60,
  },
  {
    slug: 'tab-ahmadi-deodorant-powder',
    title: 'پودر عرق‌گیر طب احمدی – ۲۰ گرم',
    type: 'بهداشت و مراقبت طبیعی بدن',
    category: 'body-care',
    sku: 'TA-DEODORANT-POWDER-20G',
    description: 'پودر عرق‌گیر طب احمدی، محصولی سبک و قابل‌حمل با وزن ۲۰ گرم برای کمک به کنترل رطوبت و کاهش بوی نامطبوع بدن و پا در استفاده روزانه است. پس از حمام مقدار کمی از پودر را روی پوست تمیز و خشک استفاده کنید؛ برای پا می‌توان مقدار کمی از پودر را با آب مخلوط کرد. بلافاصله پس از شیو استفاده نکنید و در صورت قرمزی، خارش یا سوزش مصرف را متوقف کنید. ماندگاری اعلامی محصول تا ۱۲۰ ساعت است و نتیجه مصرف به شرایط پوست و نحوه استفاده بستگی دارد.',
    attributeValues: [
      { key: 'ingredients', value: 'ترکیبات پودری عرق‌گیر طبق برچسب محصول' },
      { key: 'usage', value: 'پس از حمام مقدار کمی از پودر را روی پوست تمیز و خشک استفاده کنید؛ برای پا می‌توان مقدار کمی از پودر را با آب مخلوط کرد. بلافاصله پس از شیو استفاده نکنید.' },
      { key: 'applicationArea', value: 'پا و نواحی مستعد تعریق، طبق برچسب محصول' },
      { key: 'claimedDurationHours', value: 120 },
      { key: 'skinNote', value: 'برای مصرف روزانه؛ تست روی بخش کوچکی از پوست پیش از مصرف کامل توصیه می‌شود.' },
      { key: 'warning', value: 'در صورت قرمزی، خارش یا سوزش مصرف را متوقف کنید. روی زخم و پوست تحریک‌شده استفاده نشود.' },
      { key: 'storage', value: 'در جای خشک، خنک و دور از دسترس کودکان نگهداری شود.' },
    ],
    attrs: {
      weightGrams: 20,
      ingredients: 'ترکیبات پودری عرق‌گیر طبق برچسب محصول',
      usage: 'پس از حمام مقدار کمی روی پوست تمیز و خشک؛ برای پا امکان مخلوط‌کردن مقدار کمی پودر با آب وجود دارد',
      applicationArea: 'پا و نواحی مستعد تعریق',
      claimedDurationHours: 120,
      skinNote: 'تست روی بخش کوچکی از پوست پیش از مصرف کامل',
      warning: 'روی زخم و پوست تحریک‌شده استفاده نشود',
      storage: 'جای خشک و خنک، دور از دسترس کودکان',
      complianceStatus: 'needs_review',
      supplierDescription: 'پودر عرق‌گیر طب احمدی برای از بین بردن بوی عرق، بوی بد پا و استفاده روزانه معرفی شده است؛ وزن محصول ۲۰ گرم است و ماندگاری اعلامی آن تا ۱۲۰ ساعت ذکر شده است.',
      supplierUsageNote: 'روش استفاده اعلام‌شده توسط تأمین‌کننده: پس از حمام بلافاصله مقدار کمی پودر روی پوست استفاده شود و از زیاد زدن پودر خودداری شود. برای استفاده راحت‌تر، مخلوط‌کردن مقدار کمی پودر با کرم مرطوب‌کننده یا آبرسان پیشنهاد شده است. اگر شیو انجام شده، ۲ تا ۳ ساعت صبر شود. برای پا، مقدار کمی پودر با آب مخلوط و روی پا استفاده شود. برای مصرف داخل کفش نیز دستور ریختن نصف قاشق چای‌خوری هفته‌ای یک‌بار ارائه شده است؛ همه این دستورها باید با برچسب رسمی و ارزیابی ایمنی محصول تطبیق داده شوند.',
      supplierClaims: 'ادعاهای تأمین‌کننده درباره رفع بوی عرق، بوی پا، میخچه، خار پاشنه و روشن‌کنندگی پوست؛ در متن عمومی فقط ادعاهای مجاز و قابل‌اثبات نمایش داده می‌شوند.',
    },
    searchableText: 'پودر عرق گیر طب احمدی ۲۰ گرم بوی عرق بوی بد پا مراقبت بدن',
    seoTitle: 'پودر عرق‌گیر طب احمدی ۲۰ گرم | مراقبت بدن',
    seoDescription: 'پودر عرق‌گیر طب احمدی با وزن ۲۰ گرم برای کمک به کاهش رطوبت و بوی نامطبوع بدن و پا؛ مشاهده روش مصرف و هشدارها.',
    weightGrams: 20,
  },
  {
    slug: 'unwanted-hair-oil',
    title: 'روغن رفع موی زائد',
    type: 'مراقبت پوست و مو',
    category: 'skin-hair-care',
    sku: 'TA-UNWANTED-HAIR-OIL',
    description: 'روغن موضعی طب احمدی با حجم ۶۰ سی‌سی برای استفاده در روتین مراقبت پوست پس از اصلاح یا اپیلاسیون. ترکیبات، روش مصرف و هرگونه ادعای کاهش رشد مو باید پیش از فعال‌سازی با برچسب رسمی، مستندات ایمنی و الزامات قانونی تطبیق داده شود. این محصول جایگزین لیزر، تشخیص یا درمان پزشکی نیست و پیش از مصرف به تست حساسیت نیاز دارد.',
    attributeValues: [
      { key: 'volumeMl', value: 60 },
      { key: 'ingredients', value: 'تاتوره، بذرالبنج، رازیانه و سایر ترکیبات اعلامی؛ در انتظار تأیید برچسب رسمی' },
      { key: 'usage', value: 'پس از تأیید برچسب رسمی، مقدار کمی روی بخش کوچکی از پوست تست و مطابق دستور مجاز مصرف شود.' },
      { key: 'applicationArea', value: 'پوست بدن و صورت، فقط مصرف موضعی و طبق برچسب' },
      { key: 'warning', value: 'پیش از فعال‌سازی، ترکیبات و ایمنی محصول باید بررسی شود؛ روی پوست آسیب‌دیده یا نزدیک چشم استفاده نشود.' },
      { key: 'storage', value: 'در جای خشک و خنک و دور از نور مستقیم نگهداری شود.' },
    ],
    attrs: {
      volumeMl: 60,
      ingredients: 'تاتوره، بذرالبنج، رازیانه و سایر ترکیبات اعلامی؛ در انتظار تأیید برچسب رسمی',
      usage: 'مصرف موضعی فقط پس از تأیید برچسب رسمی',
      applicationArea: 'پوست بدن و صورت، فقط مصرف موضعی',
      warning: 'پیش از فعال‌سازی، ترکیبات و ایمنی محصول باید بررسی شود',
      storage: 'جای خشک و خنک، دور از نور مستقیم',
      complianceStatus: 'needs_review',
      supplierDescription: 'روغن رفع موی زائد با حجم ۶۰ سی‌سی به عنوان جایگزین طبیعی برای لیزر و مراقبت موضعی پس از حذف مو از ریشه معرفی شده است. تأمین‌کننده درباره موهای زائد بدن، صورت و چانه و اصلاح سبک زندگی برای تنظیم هورمون‌ها توضیح داده است؛ این ادعاها برای نمایش عمومی نیازمند بررسی مستندات هستند.',
      supplierUsageNote: 'روش مصرف اعلام‌شده توسط تأمین‌کننده: ابتدا موها با روشی که مو را از ریشه خارج می‌کند مانند اپیلاسیون یا بند برداشته شود؛ ماه اول هر روز و از ماه دوم پس از هر نوبت اپیلاسیون یا بند، روغن روی موضع استفاده شود. حجم اعلام‌شده: ۶۰ سی‌سی. این دستور تا تأیید ایمنی و برچسب رسمی، عمومی نمی‌شود.',
      supplierClaims: 'ترکیبات اعلامی تأمین‌کننده شامل تاتوره، بذرالبنج و رازیانه است و ادعا شده روغن مورچه ندارد؛ به دلیل حساسیت ایمنی این ترکیبات، محصول باید تا تأیید فرمول، مجوز و برچسب رسمی غیرفعال بماند.',
    },
    searchableText: 'روغن رفع موی زائد مراقبت پوست و مو روغن موضعی طب احمدی اصلاح اپیلاسیون',
    seoTitle: 'روغن رفع موی زائد طب احمدی | پیش‌نویس مراقبت پوست',
    seoDescription: 'پیش‌نویس روغن موضعی ۶۰ سی‌سی طب احمدی؛ ترکیبات و روش مصرف پس از تأیید برچسب و الزامات ایمنی منتشر می‌شود.',
    volumeMl: 60,
  },
];

for (const item of productsToSeed) {
  const existing = await products.findOne({ slug: item.slug }, { projection: { variants: 1 } });
  const currentVariant = existing?.variants?.find((variant) => variant?.sku === item.sku);
  const variant = {
    _id: currentVariant?._id ?? new mongoose.Types.ObjectId(),
    sku: item.sku,
    attributeValues: [
      ...(item.weightGrams ? [{ key: 'weightGrams', value: item.weightGrams }] : []),
      ...(item.volumeMl ? [{ key: 'volumeMl', value: item.volumeMl }] : []),
    ],
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
        attrs: {
          ...item.attrs,
          ...(item.weightGrams ? { weightGrams: item.weightGrams } : {}),
          ...(item.volumeMl ? { volumeMl: item.volumeMl } : {}),
        },
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
