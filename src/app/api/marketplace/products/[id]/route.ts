import { NextRequest, NextResponse } from 'next/server';
import { getShopinoProduct } from '@/marketplace/shopinoService';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/marketplace/products/[id]
 * 
 * Returns a single product in Shopino format by ID.
 */
export async function GET(
  _req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;

    if (!id || id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 },
      );
    }

    const result = await getShopinoProduct(id.trim());
    if (!result) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch product';
    console.error('[Shopino API] Error fetching product:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
