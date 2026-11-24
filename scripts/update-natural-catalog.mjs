import mongoose from 'mongoose';
import fs from 'node:fs';

const allowProduction = process.argv.includes('--allow-production');
const createMissing = process.argv.includes('--create-missing');

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

loadEnvFile('.env.local');
if (process.env.NODE_ENV === 'production' && !allowProduction) {
  throw new Error('برای اجرای این migration در production باید --allow-production را صریحاً وارد کنید.');
}
const uri = process.env.MONGO_URI;
if (!uri) throw new Error('MONGO_URI تنظیم نشده است.');

const updates = [
  {
    slug: 'slimming-oil',
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
    seoTitle: 'روغن لاغری گیاهی طب احمدی | روغن مراقبت شکم و پهلو',
    seoDescription: 'روغن گیاهی ۶۰ سی‌سی طب احمدی با ترکیبات سنتی برای استفاده موضعی و ماساژ شکم و پهلو؛ مشاهده ترکیبات، روش مصرف و هشدارها.',
    searchableText: 'روغن لاغری چربی سوز قوی ۶۰ سی سی روغن گیاهی طب احمدی شکم پهلو گلنار فارسی دارچین زنجبیل شوید میخک زیره رازیانه انیسون',
    variantAttributeValues: [{ key: 'volumeMl', value: 60 }],
  },
  {
    slug: 'tab-ahmadi-deodorant-powder',
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
    seoTitle: 'پودر عرق‌گیر طب احمدی ۲۰ گرم | مراقبت بدن',
    seoDescription: 'پودر عرق‌گیر طب احمدی با وزن ۲۰ گرم برای کمک به کاهش رطوبت و بوی نامطبوع بدن و پا؛ مشاهده روش مصرف و هشدارها.',
    searchableText: 'پودر عرق گیر طب احمدی ۲۰ گرم بوی عرق بوی بد پا مراقبت بدن',
    variantAttributeValues: [{ key: 'weightGrams', value: 20 }],
  },
  {
    slug: 'unwanted-hair-oil',
    title: 'روغن رفع موی زائد',
    typeName: 'مراقبت پوست و مو',
    categoryPath: 'skin-hair-care',
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
    seoTitle: 'روغن رفع موی زائد طب احمدی | پیش‌نویس مراقبت پوست',
    seoDescription: 'پیش‌نویس روغن موضعی ۶۰ سی‌سی طب احمدی؛ ترکیبات و روش مصرف پس از تأیید برچسب و الزامات ایمنی منتشر می‌شود.',
    searchableText: 'روغن رفع موی زائد ۶۰ سی سی مراقبت پوست و مو روغن موضعی طب احمدی اصلاح اپیلاسیون',
    variantAttributeValues: [{ key: 'volumeMl', value: 60 }],
  },
];

await mongoose.connect(uri);
const productTypes = mongoose.connection.collection('producttypes');
const categories = mongoose.connection.collection('categories');
const products = mongoose.connection.collection('products');
const slugs = updates.map((item) => item.slug);
const found = await products.find({ slug: { $in: slugs } }, { projection: { slug: 1 } }).toArray();
const foundSlugs = new Set(found.map((item) => item.slug));
const missing = slugs.filter((slug) => !foundSlugs.has(slug));

console.log(`پیش‌بررسی: ${found.length} از ${updates.length} محصول هدف پیدا شد.`);
if (missing.length > 0 && (!createMissing || missing.some((slug) => slug !== 'unwanted-hair-oil'))) {
  throw new Error(`محصول هدف پیدا نشد: ${missing.join(', ')}`);
}

if (process.argv.includes('--dry-run')) {
  console.log('حالت dry-run؛ هیچ تغییری ذخیره نشد.');
  await mongoose.disconnect();
  process.exit(0);
}

const now = new Date();
let created = 0;
for (const item of updates) {
  if (!foundSlugs.has(item.slug)) {
    const typeResult = await productTypes.findOneAndUpdate(
      { name: item.typeName },
      {
        $set: {
          name: item.typeName,
          version: 1,
          attributes: [
            { key: 'volumeMl', label: 'حجم', kind: 'number', variant: true, filterable: true, unit: 'میلی‌لیتر', min: 1 },
            { key: 'ingredients', label: 'ترکیبات', kind: 'text', searchable: true },
            { key: 'usage', label: 'روش مصرف', kind: 'text' },
            { key: 'applicationArea', label: 'ناحیه مصرف', kind: 'text', filterable: true },
            { key: 'warning', label: 'هشدار مصرف', kind: 'text' },
            { key: 'storage', label: 'شرایط نگهداری', kind: 'text' },
          ],
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    );
    const categoryResult = await categories.findOneAndUpdate(
      { path: item.categoryPath },
      {
        $set: {
          name: 'مراقبت پوست و مو',
          slug: item.categoryPath,
          path: item.categoryPath,
          depth: 0,
          position: 2,
          isActive: true,
          seoTitle: 'محصولات مراقبت پوست و مو | طب احمدی',
          seoDescription: 'محصولات موضعی مراقبت پوست و مو طب احمدی با اطلاعات ترکیبات، مصرف و هشدارها.',
          productTypeId: typeResult._id,
          updatedAt: now,
        },
        $setOnInsert: { parentId: null, ancestors: [], createdAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    );
    await products.insertOne({
      _id: new mongoose.Types.ObjectId(),
      productTypeId: typeResult._id,
      typeVersion: 1,
      title: item.title,
      brand: 'طب احمدی',
      description: item.description,
      attributeValues: item.attributeValues,
      attrs: item.attrs,
      variants: [{
        _id: new mongoose.Types.ObjectId(),
        sku: item.sku,
        attributeValues: item.variantAttributeValues,
        price: { model: 'fixed', amount: 0, unitOfMeasure: 'unit' },
        inventory: { trackingUnit: 'unit', quantity: 0, lowStockThreshold: 0, frozen: true },
        active: false,
        createdAt: now,
        updatedAt: now,
      }],
      categories: [categoryResult._id],
      searchableText: item.searchableText,
      seoTitle: item.seoTitle,
      seoDescription: item.seoDescription,
      status: 'draft',
      showInCart: false,
      createdAt: now,
      updatedAt: now,
    });
    created += 1;
    continue;
  }
  const result = await products.updateOne(
    { slug: item.slug },
    {
      $set: {
        description: item.description,
        attributeValues: item.attributeValues,
        attrs: item.attrs,
        searchableText: item.searchableText,
        seoTitle: item.seoTitle,
        seoDescription: item.seoDescription,
        'variants.$[variant].attributeValues': item.variantAttributeValues,
        updatedAt: now,
      },
    },
    { arrayFilters: [{ 'variant.sku': item.sku }] },
  );
  if (result.matchedCount !== 1) {
    throw new Error(`به‌روزرسانی ${item.slug} کامل نشد.`);
  }
}

console.log(`اطلاعات ${updates.length - created} محصول به‌روز و ${created} محصول جدید به‌صورت draft/inactive ایجاد شد.`);
await mongoose.disconnect();
