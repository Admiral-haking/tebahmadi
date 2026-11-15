# Tab Ahmadi Brand and OTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Tab Ahmadi visual identity to the storefront and login while making the SMS.ir OTP template replaceable through server configuration.

**Architecture:** Keep the existing React/Vinext routes and behavior. Add a final brand stylesheet and one bundled brand motif asset, update storefront/login markup, and centralize semantic OTP template resolution with a legacy environment fallback.

**Tech Stack:** React 19, Vinext, TypeScript, CSS, SMS.ir verify API, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-15-brand-and-otp-design.md`

## Global Constraints

- Do not hardcode the production SMS.ir template id.
- Do not expose secrets or use the supplied reference art as product photography.
- Preserve cart, checkout, admin authorization and customer session behavior.
- Keep Persian RTL, keyboard focus and reduced-motion behavior.

## Review Focus

- Missing OTP template configuration must fail closed without deleting an existing valid session.
- Legacy `SMS_IR_TEMPLATE_ID` must remain accepted during server migration.
- Product cards without a real image must not imply a fake product photograph.
- Header, product grid and login must not overflow at 390px.
- Local test mode may return `devCode` to tests but must not show a local-code message in UI.

---

### Task 1: Semantic OTP template configuration

**Files:**
- Modify: `lib/sms-provider.ts`
- Modify: `lib/local-node-runtime.ts`
- Modify: `lib/server-config.ts`
- Modify: `lib/production-config.ts`
- Modify: `.env.example`
- Modify: `deploy/server.env.example`
- Test: `tests/commerce-providers.test.ts`
- Test: `tests/server-config.test.ts`

**Interfaces:**
- Produces: `resolveSmsOtpTemplateId(env): string | undefined`

- [x] Add failing tests for semantic OTP template selection and legacy fallback.
- [x] Resolve `SMS_IR_OTP_TEMPLATE_ID` before the legacy variable in every runtime/config check.
- [x] Remove concrete template identifiers from tracked env examples and docs.
- [x] Run provider and server-config tests.

### Task 2: OTP autofill on every login surface

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/account/page.tsx`
- Modify: `app/admin/page.tsx`
- Modify: `hooks/use-sms-code.ts`
- Modify: `app/api/customer/otp/request/route.ts`

**Interfaces:**
- Consumes: `useSmsCode(enabled, onCode)`

- [x] Bind the shared customer login and staff OTP inputs to the shared WebOTP hook; `/account` redirects signed-out customers to this shared login.
- [x] Keep manual entry and OS autofill fallback.
- [x] Replace the visible local-development message with neutral delivery copy while preserving test-only `devCode` in the API.
- [x] Run typecheck and OTP E2E coverage.

### Task 3: Storefront brand system

**Files:**
- Add: `public/brand-motifs.png`
- Add: `app/brand-theme.css`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: tokenized brand styles and responsive branded storefront markup.

- [x] Bundle the supplied motif sheet as a local asset.
- [x] Replace generic hero/brand marks with the printed-label composition and approved copy.
- [x] Add honest no-image product placeholders and line icons for store assurances.
- [x] Apply the approved palette to cards, cart, forms, footer and mobile navigation.
- [x] Verify keyboard focus, reduced motion and responsive overflow.

### Task 4: Verification and handoff

**Files:**
- Modify: `docs/production-readiness.md`
- Modify: `docs/deployment.md`

**Interfaces:**
- Produces: deployment instructions that keep the real template id server-only.

- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm build` and `pnpm db:verify`.
- [x] Inspect screenshots at desktop, tablet and mobile widths.
- [x] Document the exact SMS.ir template text requirement for origin-bound autofill without storing the real template id.
