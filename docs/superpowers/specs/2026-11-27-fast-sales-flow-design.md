# Fast sales flow and responsive product media

## Status

 Approved 2026-11-27

## Goal

Make product discovery and checkout easier on mobile and desktop while keeping the existing catalog, cart, pricing, inventory, authentication, shipping, and payment APIs unchanged. Product images should load at an appropriate size for the device, avoid occupying excessive space, and remain visually stable while loading.

## User-facing outcome

- A product card communicates the product, price, availability, and next action without excessive vertical space.
- A product detail page presents the image, title, price, variant selection, quantity, and add-to-cart action in a single predictable purchase area.
- On mobile, the purchase action remains reachable without covering content or the bottom navigation.
- Cart line items and upsell items use the same responsive image behavior and have compact, touch-friendly controls.
- Images use thumbnails for lists and galleries until the user requests a larger image; only the first meaningful product image is prioritized.
- Empty, unavailable, and loading states remain clear and do not cause layout jumps.

## Scope

### In scope

1. Shared product image behavior in `OptimizedImage` and product-facing image call sites.
2. Store/product-card layout and responsive image sizing.
3. Product-detail media and purchase panel layout, including mobile sticky CTA behavior.
4. Cart line-item image and quantity layout, plus cart upsell cards.
5. Tests for responsive image props, purchase controls, and unchanged cart payload behavior where practical.

### Out of scope

- Changing pricing, offers, inventory, shipping, payment gateways, authentication, or cart server actions.
- Replacing the existing MUI design system or brand palette.
- Changing admin catalog/media data models or deleting/reimporting product data.
- Adding a new image CDN or a new third-party dependency.

## Current findings

- `OptimizedImage` is a client component with per-image loading state and a shimmer. It is used by product cards and the product detail gallery, but several storefront surfaces still use raw `<img>` elements.
- The product-detail primary image uses `priority` and a large fill frame. Gallery thumbnails do not consistently communicate their fixed `sizes` to the browser.
- Store cards use a square image and have a fixed responsive `sizes` value, but the same image behavior is not shared by cart upsell cards and cart line items.
- The product detail purchase controls are present, but mobile and desktop content are duplicated in places and the sticky action area needs a bounded, low-height mobile treatment.
- The cart already has a staged flow and server-side pricing/payment behavior; the safe improvement is presentation and loading, not a checkout logic rewrite.
- `next analyze` is not available in the installed Next.js CLI, so verification will use build output, source-level assertions, and targeted runtime checks.

## Design

### 1. Shared media contract

Keep `OptimizedImage` as the single storefront abstraction and make its defaults safe:

- Preserve explicit `priority` only for the first above-the-fold product image.
- Preserve `loading="lazy"` and `decoding="async"` for list, cart, upsell, and non-active gallery images.
- Provide explicit `sizes` at each responsive call site. Use small fixed sizes for thumbnails and bounded viewport fractions for cards and the main product image.
- Prefer the media service thumbnail/mobile file for cards and cart images. Use the original file only for the active detail image or an explicit zoom interaction.
- Keep a stable aspect-ratio frame so image load does not move price or CTA controls.
- Keep the fallback image behavior, but avoid loading a second large source when a thumbnail is already available.

### 2. Product cards and store grid

- Use a restrained responsive media frame: two columns on small phones, three on small tablets, and four on larger screens as the current grid allows.
- Keep card image proportions consistent and cap visual height through the grid rather than letting source dimensions enlarge the card.
- Keep the title at two lines, show the price and stock state together, and make the CTA the only primary action.
- Mark only the first visible card image as priority when the caller explicitly knows it is above the fold; do not mark every card as priority.

### 3. Product detail purchase area

- Keep the product media and purchase details as two responsive columns on desktop and a single flow on mobile.
- Bound the primary media frame with a responsive maximum height/width so it is neither oversized on desktop nor tiny on a phone.
- Keep variant controls above quantity and the add-to-cart action; make unavailable combinations visibly disabled.
- On mobile, use a compact sticky purchase bar with safe-area bottom padding and enough contrast, without covering the bottom navigation or dialogs.
- After add-to-cart, keep the existing success dialog and offer two clear actions: continue shopping or complete checkout.

### 4. Cart flow

- Keep the current three-step flow and server actions.
- Make cart line items a compact two-row mobile layout: thumbnail/title/price first, quantity and remove/save actions second.
- Render upsell images through the shared optimized image component with lazy loading and an explicit fixed card size.
- Keep the checkout summary visible at the right/below the cart, and preserve the existing payment gateway eligibility and error handling.

## Implementation boundaries

Expected files:

- `src/components/image/index.tsx` and `src/components/image/image.module.css`
- `src/components/product/card.tsx`
- `src/components/ui/ProductGallery.tsx`
- `src/views/product/components/view.client.tsx`
- `src/components/cart/CartLineItem.tsx`
- `src/components/cart/CartPageContent.tsx`
- Potentially the media URL selection in `src/views/product/data.ts` and `src/views/store/components/product-loader.ts` if an existing thumb/mobile URL is not carried through.

Avoid broad global CSS changes and avoid changing API/action signatures.

## Acceptance criteria

- Product list, product detail, cart, and checkout-related existing tests pass.
- `npm run lint`, `npm test`, and `npm run build` pass.
- Store cards and cart upsell cards do not use raw `<img>` for product media.
- Product list images are lazy by default; only explicitly designated above-the-fold images are prioritized.
- Main detail image and thumbnails expose bounded `sizes` values.
- Mobile product detail has one clear, reachable add-to-cart action without overlap with bottom navigation.
- Mobile cart line items remain readable at approximately 360px width, with no horizontal overflow.
- No change is made to cart line payloads, price calculation, inventory validation, shipping selection, or payment gateway behavior.
- Existing placeholder and media-error fallback behavior remains intact.

## Verification plan

1. Run targeted unit/source tests for image props, product cards, product detail purchase controls, and cart rendering.
2. Run `npm test`, `npm run lint`, and `NODE_ENV=production npm run build`.
3. Start the production server locally and check `/store`, `/product/<known-slug>`, and `/cart` with HTTP 200 responses.
4. Inspect generated markup/source assertions for responsive `sizes`, lazy loading, and the mobile CTA.
5. Measure the post-change build duration and `.next` size with the same commands used for the baseline; report the actual values without claiming browser Core Web Vitals unless a browser trace is available.
