import type { UpsellProduct } from './CartPageContent';

type RecommendationEvent = {
  event: 'impression' | 'click' | 'add';
  algo: 'copurchase' | 'category' | 'curated' | 'explicit_bundle';
  productId: string;
};

export async function logCartRecommendationEvents(
  events: RecommendationEvent[],
  cartProductIdsKey: string,
): Promise<void> {
  if (!events.length) return;
  const contextProductIds = cartProductIdsKey ? cartProductIdsKey.split(',').slice(0, 30) : [];
  await fetch('/api/cart/suggestions/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      events: events.map((event) => ({ ...event, source: 'cart', contextProductIds })),
    }),
    keepalive: true,
  });
}
