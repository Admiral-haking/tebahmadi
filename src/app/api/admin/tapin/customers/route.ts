import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import {
  listTapinCustomerCategories,
  listTapinCustomers,
  listTapinShops,
} from '@/services/tapin/orders';
import { TapinError } from '@/services/tapin/client';

export async function GET(request: NextRequest) {
  await requirePermission(request, 'orders:read');
  const p = new URL(request.url).searchParams;
  const page = Math.max(1, Number(p.get('page')) || 1);
  const number = (key: string) => {
    const value = Number(p.get(key));
    return Number.isInteger(value) && value > 0 ? value : undefined;
  };
  const shopId = p.get('shopId')?.trim() || undefined;
  try {
    const [customers, categories, shops] = await Promise.all([
      listTapinCustomers(page, 20, {
        firstName: p.get('firstName')?.trim().slice(0, 30) || undefined,
        lastName: p.get('lastName')?.trim().slice(0, 40) || undefined,
        mobile: p.get('mobile')?.replace(/\D/g, '').slice(0, 11) || undefined,
        phone:
          p
            .get('phone')
            ?.replace(/[^\d+]/g, '')
            .slice(0, 20) || undefined,
        email: p.get('email')?.trim().slice(0, 200) || undefined,
        postalCode: p.get('postalCode')?.replace(/\D/g, '').slice(0, 10) || undefined,
        state: number('state'),
        city: number('city'),
        createdAt: p.get('createdAt')?.trim().slice(0, 30) || undefined,
        categoryId: p.get('categoryId') || undefined,
        shopId,
      }),
      listTapinCustomerCategories(shopId),
      listTapinShops(),
    ]);
    return NextResponse.json({
      data: { customers, categories: categories.list, shops: shops.list },
    });
  } catch (error) {
    if (error instanceof TapinError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'دریافت مشتریان تاپین ناموفق بود.' }, { status: 502 });
  }
}
