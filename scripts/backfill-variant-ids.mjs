import mongoose from 'mongoose';
import fs from 'node:fs';

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
loadEnvFile('.env');

const uri = process.env.MONGO_URI;
if (!uri) throw new Error('MONGO_URI تنظیم نشده است.');

const dryRun = process.argv.includes('--dry-run');
await mongoose.connect(uri);

try {
  const products = mongoose.connection.collection('products');
  const cursor = products.find(
    { 'variants': { $elemMatch: { _id: { $exists: false } } } },
    { projection: { variants: 1 } },
  );

  let scanned = 0;
  let changed = 0;
  while (await cursor.hasNext()) {
    const product = await cursor.next();
    if (!product) continue;
    scanned += 1;
    const variants = Array.isArray(product.variants) ? product.variants : [];
    let productChanged = false;
    const nextVariants = variants.map((variant) => {
      if (!variant || variant._id) return variant;
      productChanged = true;
      return { ...variant, _id: new mongoose.Types.ObjectId() };
    });
    if (!productChanged) continue;
    changed += 1;
    if (!dryRun) {
      await products.updateOne(
        { _id: product._id },
        { $set: { variants: nextVariants, updatedAt: new Date() } },
      );
    }
  }

  console.log(`${dryRun ? 'پیش‌نمایش' : 'اصلاح'} شناسهٔ واریانت‌ها: ${changed} محصول از ${scanned} محصول بررسی‌شده.`);
} finally {
  await mongoose.disconnect();
}
