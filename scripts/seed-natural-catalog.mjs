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

console.log(`کاتالوگ آزمایشی آماده شد: ${types.length} نوع محصول و ${categoryRows.length} دسته‌بندی`);
await mongoose.disconnect();
