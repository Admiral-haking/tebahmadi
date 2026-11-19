import { NextRequest, NextResponse } from 'next/server';
import { listShopinoProducts } from '@/marketplace/shopinoService';

export const runtime = 'nodejs';

/**
 * GET /api/marketplace/products
 * 
 * Returns a paginated list of active products in Shopino format.
 * 
 * Query parameters:
 *   - page (number, optional, default: 1)
 *   - limit (number, optional, default: 20)
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));

    const result = await listShopinoProducts(page, limit);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch products';
    console.error('[Shopino API] Error fetching products:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
