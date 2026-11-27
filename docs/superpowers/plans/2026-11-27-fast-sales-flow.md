# Fast Sales Flow and Responsive Product Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make product discovery, product selection, add-to-cart, and cart review faster and clearer on every device while loading only appropriately sized product images.

**Architecture:** Keep the existing catalog, cart, pricing, inventory, shipping, authentication, and payment actions unchanged. Improve the shared image abstraction first, then apply it to store cards, product detail, and cart surfaces; use responsive aspect-ratio frames and a bounded mobile purchase bar to prevent layout jumps and oversized media.

**Tech Stack:** Next.js 15.5.7, React 19, MUI 7, `next/image`, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-27-fast-sales-flow-design.md`

## Global Constraints

- Preserve the existing catalog, cart, pricing, inventory, shipping, payment, and authentication APIs and server actions.
- Do not add a third-party dependency or an image CDN.
- Use the existing `OptimizedImage` abstraction for storefront product media.
- Product list and cart images must be lazy and explicitly sized; only an explicitly designated above-the-fold image may be prioritized.
- Keep the existing Tab Ahmadi palette, typography, RTL behavior, and restrained radius scale.
- Keep fallback media behavior for missing or failed product images.
- Do not change product data, prices, offers, inventory, or checkout payloads.

## Review Focus

- Missing or broken media URL: the product must keep its layout and show the existing placeholder without a second large request.
- 360px mobile viewport: product cards, product detail, and cart lines must not overflow horizontally or hide the purchase action.
- Slow image/network response: text, price, and CTA must remain visible while media loads; no avoidable blank block or layout shift.
- Product with multiple variants/media items: selecting a variant must keep the active image and thumbnail behavior correct.
- Out-of-stock/disabled variant: the user must not be offered an active purchase action, and cart/payment logic must remain unchanged.

### Task 1: Harden the shared storefront image contract

**Files:**
- Modify: `src/components/image/index.tsx`
- Modify: `src/components/image/image.module.css`
- Modify: `src/components/ui/ProductGallery.tsx`
- Create: `src/components/image/index.test.tsx`

**Interfaces:**
- Consumes: existing `OptimizedImageProps` and `ProductGalleryImage` inputs.
- Produces: the same exported `OptimizedImage` component and `ProductGallery` exports, with safer first paint and explicit responsive image sizing.

- [x] **Step 1: Write the failing image behavior tests**

  Add a Vitest test that mocks `next/image` as a plain `<img>` and verifies:

  - a non-priority image keeps `loading="lazy"` and `decoding="async"`;
  - a priority image keeps `fetchPriority="high"`;
  - a fill image receives its caller-provided `sizes` value;
  - the server-rendered image is not hidden with `opacity:0` before client JavaScript runs;
  - the fallback source is used for an empty/invalid source.

- [x] **Step 2: Run the focused test and verify it fails**

  Run: `npx vitest run src/components/image/index.test.tsx`

  Expected: FAIL because the current component hides the initial image and does not pin the new fallback/first-paint behavior.

- [x] **Step 3: Implement the shared image behavior**

  In `src/components/image/index.tsx`, keep the current fallback handling and public props, but make the image itself visible during the initial paint, keep the shimmer as a non-blocking overlay, and preserve `priority`, `loading`, `decoding`, `fetchPriority`, and `sizes` semantics. Do not remove the error fallback state.

  In `image.module.css`, disable the animated shimmer for reduced-motion users and prevent it from intercepting pointer input.

  In `ProductGallery.tsx`, keep the main image prioritized, set a bounded responsive `sizes` value for the main frame, and keep thumbnail images lazy with `sizes="72px"`.

- [x] **Step 4: Run the focused test and verify it passes**

  Run: `npx vitest run src/components/image/index.test.tsx`

  Expected: PASS.

- [x] **Step 5: Commit the shared media change**

  ```bash
  git add src/components/image/index.tsx src/components/image/image.module.css src/components/ui/ProductGallery.tsx src/components/image/index.test.tsx
  git commit -m "perf: improve storefront image loading"
  ```

### Task 2: Make store cards load only the right image size

**Files:**
- Modify: `src/components/product/card.tsx`
- Modify: `src/components/product/card.test.tsx`
- Modify: `src/views/store/components/grid-client.tsx`
- Create: `src/views/store/components/grid-client.test.tsx`
- Potentially modify: `src/views/home/components/discount-client.tsx` only if the shared priority contract requires a call-site correction.

**Interfaces:**
- Consumes: existing `ProductCardProps` and `StoreProductGridClient` pagination state.
- Produces: the same card props and grid behavior, with explicit first-visible priority and lazy subsequent images.

- [x] **Step 1: Extend the product-card test**

  Update the existing image mock to expose `loading`, `fetchPriority`, `sizes`, and `priority` as data attributes. Add assertions that a default card is lazy, uses the bounded card `sizes`, and does not request high priority; add a second test for `priorityImage`.

  Add a grid-client regression test that renders two initial products and asserts only the first receives `priorityImage`.

- [x] **Step 2: Run the focused card test and verify it fails**

  Run: `npx vitest run src/components/product/card.test.tsx src/views/store/components/grid-client.test.tsx`

  Expected: FAIL for the new priority/sizing assertions.

- [x] **Step 3: Implement responsive card media and first-item priority**

  Keep the current card CTA, price, title clamp, stock state, and link behavior. Use a stable responsive image frame with a bounded `sizes` value suitable for the existing two/three/four-column grid. In `StoreProductGridClient`, pass `priorityImage` only to the first product of the initial visible page; appended and later products remain lazy. Preserve the current infinite-scroll and pagination behavior.

- [x] **Step 4: Run the focused card test and verify it passes**

  Run: `npx vitest run src/components/product/card.test.tsx src/views/store/components/grid-client.test.tsx`

  Expected: PASS.

- [x] **Step 5: Commit the store-card change**

  ```bash
  git add src/components/product/card.tsx src/components/product/card.test.tsx src/views/store/components/grid-client.tsx src/views/store/components/grid-client.test.tsx
  git commit -m "perf: size store product images responsively"
  ```

### Task 3: Simplify product-detail selection and purchase on mobile

**Files:**
- Modify: `src/views/product/components/view.client.tsx`
- Create: `src/views/product/components/view.client.test.tsx`

**Interfaces:**
- Consumes: existing `ProductDetailData`, variant selection state, and `useCart` methods.
- Produces: the same `handleAddToCart` line payload and success/error dialogs, with a bounded media frame and a reachable mobile CTA.

- [x] **Step 1: Add a regression test for the purchase shell**

  Use the existing Vitest/SSR conventions with mocked image/cart/theme hooks to assert the rendered product purchase surface includes the bounded main-image `sizes`, `env(safe-area-inset-bottom)`, quantity control, and `افزودن به سبد خرید` action.

- [x] **Step 2: Run the focused product test and verify it fails**

  Run: `npx vitest run src/views/product/components/view.client.test.tsx`

  Expected: FAIL only for the new responsive purchase/media contract.

- [x] **Step 3: Implement the responsive product purchase layout**

  Bound the primary media frame with a responsive aspect ratio and maximum size instead of the current large mobile minimum height. Add explicit `sizes` for the main image and lazy `sizes="72px"` thumbnails. Keep the variant controls before quantity and the add-to-cart button.

  Make the mobile purchase bar compact, safe-area aware, and positioned above the existing bottom navigation without covering dialogs or content. Keep one clear primary CTA, keep quantity controls touch-friendly, and preserve all existing stock, min/max quantity, variant validation, cart line construction, and success-dialog behavior.

- [x] **Step 4: Run the focused product test and verify it passes**

  Run: `npx vitest run src/views/product/components/view.client.test.tsx`

  Expected: PASS.

- [x] **Step 5: Commit the product-detail change**

  ```bash
  git add src/views/product/components/view.client.tsx src/views/product/components/view.client.test.tsx
  git commit -m "feat: simplify mobile product purchase flow"
  ```

### Task 4: Make cart media and controls compact on every device

**Files:**
- Modify: `src/components/cart/CartLineItem.tsx`
- Modify: `src/components/cart/CartPageContent.tsx`
- Create: `src/components/cart/CartLineItem.test.tsx`
- Create: `src/components/cart/CartUpsellCard.tsx`
- Create: `src/components/cart/CartUpsellCard.test.tsx`

**Interfaces:**
- Consumes: existing `CartLine`, `CartAvailabilityRow`, `useCart`, cart suggestion response, and checkout layout.
- Produces: the same quantity/update/remove/save callbacks and upsell actions, with shared optimized product media and no horizontal overflow at 360px.

- [x] **Step 1: Write failing cart media/layout tests**

  Add focused tests that mock `useCart` and assert that a cart line keeps its title, price, quantity controls, and action labels in server-rendered output. Add a focused `CartUpsellCard` test that asserts the shared optimized-image path, lazy loading, and explicit fixed card size.

- [x] **Step 2: Run the focused cart tests and verify they fail**

  Run: `npx vitest run src/components/cart/CartLineItem.test.tsx src/components/cart/CartUpsellCard.test.tsx`

  Expected: FAIL because the line item and upsell currently use raw `<img>` elements.

- [x] **Step 3: Implement compact cart media and controls**

  Replace the product `<img>` in `CartLineItem` with `OptimizedImage` inside a stable responsive thumbnail frame; retain the existing `thumbSrc` fallback and all quantity constraints. Adjust the line item to keep title/price readable on narrow screens and move quantity/remove/save controls into a second compact row when needed.

  Extract the upsell card markup into `CartUpsellCard`, replace its raw product `<img>` with `OptimizedImage`, use a fixed card aspect ratio and explicit `sizes`, and keep the horizontal carousel, scroll controls, unavailable state, and quick-add callback unchanged. Keep the checkout summary and existing stepper layout intact.

- [x] **Step 4: Run the focused cart tests and verify they pass**

  Run: `npx vitest run src/components/cart/CartLineItem.test.tsx src/components/cart/CartUpsellCard.test.tsx src/components/cart/cart-availability.test.ts src/components/cart/transport-options.test.ts`

  Expected: PASS.

- [x] **Step 5: Commit the cart-flow change**

  ```bash
  git add src/components/cart/CartLineItem.tsx src/components/cart/CartPageContent.tsx src/components/cart/CartLineItem.test.tsx src/components/cart/CartUpsellCard.tsx src/components/cart/CartUpsellCard.test.tsx
  git commit -m "feat: streamline responsive cart media"
  ```

### Task 5: Full verification and delivery checks

**Files:**
- Modify: none unless a verification failure requires a focused correction.
- Test: the repository test, lint, and production build commands.

**Interfaces:**
- Consumes: the completed image, product-card, product-detail, and cart changes.
- Produces: evidence that the requested sales-flow and responsive-media behavior works without changing checkout business logic.

- [x] **Step 1: Run the complete automated suite**

  Run: `npm test`

  Expected: all existing and new tests pass.

- [x] **Step 2: Run lint and production build**

  Run: `npm run lint`

  Expected: exit 0 with no new lint errors.

  Run: `NODE_ENV=production npm run build`

  Expected: exit 0 and all static/dynamic routes compile.

- [x] **Step 3: Check the production routes and responsive contracts**

  Start the built app locally and request `/store`, a known `/product/<slug>`, and `/cart`; expect HTTP 200. Inspect rendered markup/source assertions for lazy list/cart images, bounded `sizes`, a single mobile purchase CTA, and no raw product-media `<img>` in store/cart surfaces.

- [x] **Step 4: Compare the same baseline signals**

  Run the performance benchmark command used before the change and record build elapsed time and `.next` disk usage. Report only measured local build/output signals; do not claim Core Web Vitals without a browser trace.

- [x] **Step 5: Review the final diff and commit verification evidence**

  Run:

  ```bash
  git diff --check
  git status --short
  git log --oneline -5
  ```

  Do not stage the pre-existing `.codex-attachments/` directory. If all checks pass, push the commits on `main`; deployment requires a separate explicit delivery step and post-deploy health check.
