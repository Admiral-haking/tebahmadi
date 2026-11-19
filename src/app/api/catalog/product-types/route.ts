import { NextRequest, NextResponse } from 'next/server';
import { connectMongoose } from '@/lib/mongoose';
import { jsonError } from '@/lib/http';
import { createProductType } from '@/catalog/services/productTypeService';
import ProductTypeModel from '@/catalog/models/ProductType';
import { requirePermission } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await connectMongoose();
  const search = req.nextUrl.searchParams.get('q')?.trim();
  const filter = search
    ? {
        name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' },
      }
    : {};

  const productTypes = await ProductTypeModel.find(filter)
    .sort({ createdAt: -1 })
    .lean({ virtuals: false, getters: false });

  const serialized = productTypes.map((type) => ({
    id: type._id?.toString() ?? '',
    name: type.name ?? '',
    version: type.version,
    attributes: Array.isArray(type.attributes)
      ? type.attributes.map((attr) => ({
          key: attr?.key ?? '',
          label: attr?.label ?? '',
          kind: attr?.kind ?? 'text',
          required: Boolean(attr?.required),
          variant: Boolean(attr?.variant),
          filterable: Boolean(attr?.filterable),
          searchable: Boolean(attr?.searchable),
          enumValues: Array.isArray(attr?.enumValues) ? attr.enumValues : undefined,
          values: Array.isArray(attr?.values)
            ? attr.values.map((value) => ({
                key: value?.key ?? '',
                name: value?.name ?? '',
                swatches: Array.isArray(value?.swatches) ? value.swatches : [],
                family: value?.family,
                rtlName: value?.rtlName,
                aliases: Array.isArray(value?.aliases) ? value.aliases : undefined,
                active: value?.active ?? true,
              }))
            : undefined,
          min: attr?.min,
          max: attr?.max,
          regex: attr?.regex,
          unit: attr?.unit,
        }))
      : [],
    createdAt: type.createdAt instanceof Date ? type.createdAt.toISOString() : undefined,
    updatedAt: type.updatedAt instanceof Date ? type.updatedAt.toISOString() : undefined,
  }));

  return NextResponse.json({ productTypes: serialized });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  await connectMongoose();
  await requirePermission(req, 'catalog:publish');
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body');
  }

  try {
    const productType = await createProductType(payload);
    return NextResponse.json({ productType }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create product type';
    return jsonError(400, message);
  }
}
