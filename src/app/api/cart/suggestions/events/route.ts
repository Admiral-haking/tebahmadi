import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';

import { connectMongoose } from '@/lib/mongoose';
import { guardPublicWrite, noStoreJson } from '@/lib/public-write-guard';
import {
  RecommendationMetricModel,
  RECOMMENDATION_ALGOS,
  RECOMMENDATION_EVENTS,
} from '@/models/recommendations/RecommendationMetric';

export const runtime = 'nodejs';

const eventSchema = z.object({
  event: z.enum(RECOMMENDATION_EVENTS),
  algo: z.enum(RECOMMENDATION_ALGOS),
  productId: z.string().refine((value) => Types.ObjectId.isValid(value)),
  source: z.literal('cart'),
  contextProductIds: z.array(z.string()).max(30).default([]),
});

const payloadSchema = z.object({ events: z.array(eventSchema).max(50) });

export async function POST(request: NextRequest) {
  const denied = guardPublicWrite(request, 'cart:recommendation-events', 60);
  if (denied) return denied;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return noStoreJson({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return noStoreJson({ error: 'Invalid recommendation events' }, { status: 400 });
  if (!parsed.data.events.length) return noStoreJson({ ok: true });

  try {
    await connectMongoose();
    await RecommendationMetricModel.insertMany(
      parsed.data.events.map((event) => ({
        source: event.source,
        event: event.event,
        algo: event.algo,
        productId: new Types.ObjectId(event.productId),
        contextProductIds: event.contextProductIds
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id)),
      })),
      { ordered: false },
    );
    return noStoreJson({ ok: true });
  } catch (error) {
    console.error('Failed to record recommendation events', error);
    return noStoreJson({ error: 'Recommendation events unavailable' }, { status: 503 });
  }
}
