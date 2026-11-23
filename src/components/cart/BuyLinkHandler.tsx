'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { useCart, type CartLine } from '@/hooks/cart/useCart';
import { axiosRequest, safeJson } from '@/utils/axios-request';
import { CHECKOUT_GATEWAY_STORAGE_KEY } from './checkout-session';

const gateways = new Set(['zarinpal', 'snapppay', 'digipay', 'azkivam', 'torob', 'bajetpay']);
export const CAMPAIGN_ATTRIBUTION_KEY = 'app:campaign-attribution:v1';

/** Applies a campaign purchase link once, then removes its action parameters. */
export default function BuyLinkHandler() {
  const { addFixedLine, addPerUnitLine, setOfferCode, setAttribution } = useCart();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const url = new URL(window.location.href);
    const variants = (url.searchParams.get('buy') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 50);
    const coupon = url.searchParams.get('coupon')?.trim();
    const gateway = url.searchParams.get('gateway')?.trim().toLowerCase();
    const campaign = url.searchParams.get('utm_campaign')?.trim();
    const source = url.searchParams.get('utm_source')?.trim();
    const medium = url.searchParams.get('utm_medium')?.trim();

    if (campaign || source || medium) {
      const attribution = { campaign, source, medium };
      window.sessionStorage.setItem(CAMPAIGN_ATTRIBUTION_KEY, JSON.stringify(attribution));
      setAttribution(attribution);
    }
    if (coupon) setOfferCode(coupon.toUpperCase().slice(0, 40));
    if (gateway && gateways.has(gateway)) {
      window.sessionStorage.setItem(CHECKOUT_GATEWAY_STORAGE_KEY, gateway);
    }
    if (!variants.length) return;

    const quantities = (url.searchParams.get('qty') ?? '').split(',');
    Promise.all(
      variants.map(async (variant, index) => {
        const qty = Math.max(1, Math.min(1000, Number(quantities[index]) || 1));
        const response = await axiosRequest(
          `/api/store/buy-link?variant=${encodeURIComponent(variant)}`,
          { cache: 'no-store' },
        );
        const body = await safeJson<{ line?: CartLine; error?: string }>(response);
        if (!response.ok || !body.line) {
          throw new Error(body.error || 'یکی از کالاها قابل افزودن نیست.');
        }
        const line = body.line;
        if (line.priceModel === 'per_unit') addPerUnitLine(line, qty, line.unitOfMeasure);
        else addFixedLine(line, qty);
      }),
    )
      .then(() => toast.success('کالاها از لینک خرید به سبد افزوده شدند.'))
      .catch((error) => toast.error(error instanceof Error ? error.message : 'افزودن کالا ناموفق بود.'));

    url.searchParams.delete('buy');
    url.searchParams.delete('qty');
    url.searchParams.delete('coupon');
    url.searchParams.delete('gateway');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [addFixedLine, addPerUnitLine, setAttribution, setOfferCode]);

  return null;
}
