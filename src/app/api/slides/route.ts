import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { connectMongoose } from '@/lib/mongoose';
import { requirePermission } from '@/lib/auth';
import { slideCreateSchema } from '@/content/validation/slideSchema';
import { createSlide, listSlides } from '@/content/services/slideService';

export async function GET() {
  await connectMongoose();
  const slides = await listSlides();
  return NextResponse.json({ data: slides }, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

export async function POST(request: NextRequest) {
  await connectMongoose();
  await requirePermission(request, 'catalog:publish');

  try {
    const json = await request.json();
    const parsed = slideCreateSchema.parse(json);
    const slide = await createSlide(parsed);
    return NextResponse.json({ data: slide }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.flatten() }, { status: 400 });
    }
    console.error('Failed to create slide', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

