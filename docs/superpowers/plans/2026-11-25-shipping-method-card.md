# Shipping Method Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the checkout shipping select/radio controls with a responsive, accessible card for choosing the carrier and shipping-payment timing, without changing checkout data or pricing behavior.

**Architecture:** Keep `CarrierSelect` as the stateful boundary that consumes `useCart` and `useTransportOptions`. Replace the native-looking MUI select/radio layout with semantic radio-card buttons styled from the existing Tab Ahmadi tokens, while leaving `/api/transport?isActive=true`, `transportId`, `online`, and `on_delivery` unchanged. Remove the duplicate parent heading so the component owns the complete shipping section.

**Tech Stack:** Next.js 15, React 19, TypeScript, MUI 7, Vitest, server-rendered component markup tests.

**Spec:** `docs/superpowers/specs/2026-11-25-shipping-method-card-design.md`

## Global Constraints

- Use the current API `/api/transport?isActive=true` without changing its contract.
- Preserve automatic selection of the first available transport, retry behavior, and `transportId` updates.
- Preserve the existing payment values `online` and `on_delivery`.
- Keep every interactive control at least 48px tall with visible focus states.
- Allow text to wrap; do not truncate titles or create horizontal overflow.
- Keep loading and error feedback inside the shipping card.
- Respect `prefers-reduced-motion` for state transitions.
- Do not change database models, transport APIs, pricing, checkout actions, or final order payment gateways.

## Review Focus

- A single transport option must render as an already-selected card and must not render a redundant select.
- Multiple transport options must expose the complete card as the selectable radio target.
- A failed transport request must keep the retry action reachable and must not crash or leave an empty form.
- A mobile viewport around 360–390px must wrap both carrier and payment content without horizontal overflow.
- Selecting `on_delivery` must retain the existing state value and show the shipping-payment explanation.

### Task 1: Rebuild `CarrierSelect` as accessible shipping and payment cards

**Files:**
- Create: `src/components/cart/CarrierSelect.test.tsx`
- Modify: `src/components/cart/CarrierSelect.tsx`

**Interfaces:**
- Consumes: `useCart()` with `state.transportId`, `state.shippingPaymentMethod`, `setTransportId`, and `setShippingPaymentMethod`.
- Consumes: `useTransportOptions()` with `options`, `isLoading`, `error`, and `retry`.
- Produces: the same state updates and API-facing values as the current component; the rendered section exposes carrier and payment choices as semantic radio controls.

- [ ] **Step 1: Write the failing server-rendered markup tests**

  Mock the two existing hooks and render one selected carrier with `renderToStaticMarkup`. Assert the markup contains `روش و هزینه ارسال`, the carrier name, `انتخاب شده`, both payment choices, `role="radio"`, and `aria-checked="true"` for the selected option; assert it does not contain a native `<select>`. Add a second case with `on_delivery` and assert the delivery-payment explanation is present. Add an error case that asserts the retry label remains rendered.

- [ ] **Step 2: Run the focused test to verify the current implementation fails**

  Run: `npm test -- --run src/components/cart/CarrierSelect.test.tsx`

  Expected: FAIL because the current component has no shipping-card heading/radio-card markup and still renders a native MUI select for multiple options.

- [ ] **Step 3: Implement the card-based component**

  In `src/components/cart/CarrierSelect.tsx`, keep the existing effects that default invalid or empty selections to the first available option. Render a `section` with a heading, helper text, selected-status chip, carrier radio-card group, and shipping-payment radio-card group. Use `ButtonBase`/button semantics with `role="radio"` and `aria-checked` for full-card activation, preserve the current option descriptions, and keep loading, empty, error, and retry states inside the section. Use `TEB_COLORS` and `TEB_RADII`, responsive `sx` grids (`1fr` on narrow screens and two columns for payment cards from `sm` upward), 48px minimum control heights, readable wrapping, visible focus rings, and reduced-motion-safe transitions. Keep the on-delivery helper text semantically equivalent to the current behavior.

- [ ] **Step 4: Run the focused test to verify the card behavior**

  Run: `npm test -- --run src/components/cart/CarrierSelect.test.tsx`

  Expected: PASS for selected carrier markup, payment state copy, and retry/error markup.

### Task 2: Integrate the self-contained shipping card into checkout

**Files:**
- Modify: `src/components/cart/CartPageContent.tsx` near the address/transport step.
- Test: `src/components/cart/CartPageContent.test.tsx`

**Interfaces:**
- Consumes: the self-contained `CarrierSelect` section from Task 1.
- Produces: one shipping section in the address step, with no duplicate `روش ارسال` heading around it.

- [ ] **Step 1: Remove the duplicate wrapper heading**

  Keep the address form and divider unchanged, then render `CarrierSelect` directly instead of wrapping it with the parent `روش ارسال` heading. Preserve the existing grid, paper, and address copy.

- [ ] **Step 2: Run the cart and transport regression tests**

  Run: `npm test -- --run src/components/cart/transport-options.test.ts src/components/cart/cart-reducer.test.ts src/components/cart/cart-availability.test.ts`

  Expected: PASS with no changes to transport normalization or cart state behavior.

### Task 3: Verify responsive production readiness

**Files:**
- No new source files; verify the files from Tasks 1–2.

**Interfaces:**
- Consumes: the completed shipping card and existing project build/lint/test scripts.
- Produces: a production build with type-safe, lint-clean checkout UI and no uncommitted generated artifacts.

- [ ] **Step 1: Run the complete test suite**

  Run: `npm test`

  Expected: PASS.

- [ ] **Step 2: Run lint and production build**

  Run: `npm run lint && NEXT_TELEMETRY_DISABLED=1 npm run build`

  Expected: lint exits 0 and Next.js production build completes successfully.

- [ ] **Step 3: Inspect the final diff and commit**

  Run: `git diff --check && git status --short && git diff --stat`

  Expected: no whitespace errors; only the plan, test, component, and checkout integration changes are present. Commit with `git add docs/superpowers/specs/2026-11-25-shipping-method-card-design.md docs/superpowers/plans/2026-11-25-shipping-method-card.md src/components/cart/CarrierSelect.tsx src/components/cart/CarrierSelect.test.tsx src/components/cart/CartPageContent.tsx src/components/cart/CartPageContent.test.tsx && git commit -m "feat: redesign checkout shipping method cards"`.
