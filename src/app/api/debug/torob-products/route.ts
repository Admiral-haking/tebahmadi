import { NextResponse } from 'next/server';
import ProductModel from '@/catalog/models/Product';
import { connectMongoose } from '@/lib/mongoose';

export const runtime = 'nodejs';

export async function GET() {
  await connectMongoose();

  const total = await ProductModel.countDocuments({});
  const active = await ProductModel.countDocuments({ status: 'active' });
  const activeWithStock = await ProductModel.countDocuments({
    status: 'active',
    variants: { $elemMatch: { active: true, 'inventory.quantity': { $gt: 0 } } }
  });
  
  // بررسی محصولاتی که status ندارن یا draft هستن
  const noStatus = await ProductModel.countDocuments({ status: { $exists: false } });
  const draft = await ProductModel.countDocuments({ status: 'draft' });
  const archived = await ProductModel.countDocuments({ status: 'archived' });

  // بررسی productTypeId
  const noProductType = await ProductModel.countDocuments({ productTypeId: { $exists: false } });

  // نمونه محصولات active
  const sampleActive = await ProductModel.find({ status: 'active' })
    .limit(10)
    .select({ title: 1, slug: 1, status: 1, variants: { $slice: 2 } })
    .lean();

  const result = {
    counts: {
      total,
      active,
      draft,
      archived,
      noStatus,
      noProductType,
      activeWithStock,
    },
    sampleActive: sampleActive.map((p: any) => ({
      title: p.title,
      slug: p.slug,
      status: p.status,
      variantsCount: (p.variants || []).length,
      firstVariant: (p.variants || [])[0] ? {
        active: (p.variants as any[])[0]?.active,
        price: (p.variants as any[])[0]?.price?.amount,
        stock: (p.variants as any[])[0]?.inventory?.quantity,
        hasMedia: !!((p.variants as any[])[0]?.mediaIds?.length),
      } : null,
    })),
  };

  return NextResponse.json(result);
}
