# طب احمدی Brand Icon System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and place a custom SVG icon family for Tab Ahmadi's storefront UI and product categories, excluding banners.

**Architecture:** Keep the icon vocabulary and category-name resolver in a pure utility module, and render the icons through one typed React SVG component family using `currentColor`. Integrate the family at customer-facing category cards, category navigation, trust items, header actions, cart, and account actions without replacing unrelated editor, media, social, or admin icon systems.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, MUI, inline SVG, Vitest.

**Spec:** `docs/tebahmadi-icon-system.md`

## Global Constraints

- Use `viewBox="0 0 24 24"`, rounded strokes, and `currentColor` for the SVG icon family.
- Preserve the Tab Ahmadi palette: `#2A5A44`, `#1F4635`, `#C5A059`, `#F9F8F6`, and `#F4F3E5`.
- Do not modify banner components or add a new external image/font dependency.
- Keep all category and action icons readable from 16px through 48px.
- Preserve RTL layout, keyboard focus, and existing link/button semantics.

## Review Focus

- Unknown or newly added category names must render the generic category icon instead of crashing — covered by the resolver test.
- The icon component must inherit color and support explicit sizes — covered by the SVG render test.
- Category cards without media must still have a distinctive visual — covered by the category integration test.
- Trust items must retain their Persian labels and use the new icon family — covered by the trust-bar source/render test.
- Header/cart/account actions must retain accessible labels and navigation while changing only their visual icon — covered by targeted source checks and the full test suite.

### Task 1: Define the icon vocabulary and SVG components

**Files:**
- Create: `src/lib/brand-icons.ts`
- Create: `src/components/brand-icons/index.tsx`
- Test: `src/lib/brand-icons.test.tsx`

**Interfaces:**
- `BrandIconName` is the canonical union of category, service, and storefront action names.
- `resolveBrandIconName(...values: unknown[]): BrandIconName` maps category names, paths, and legacy preview keys to the closest icon.
- `BrandIcon({ name, size, title, ...svgProps }: BrandIconProps)` renders a typed inline SVG.

- [x] Write the failing resolver and SVG render tests first.
- [x] Run `npm test -- --run src/lib/brand-icons.test.tsx` and confirm the expected missing-module failure.
- [x] Implement the resolver and the custom botanical/commerce/service SVG paths with a shared base renderer.
- [x] Run the focused test and confirm it passes.

### Task 2: Replace category visuals and category navigation icons

**Files:**
- Modify: `src/views/home/components/categories.tsx`
- Modify: `src/layout/components/category-menu.tsx`
- Test: `src/views/home/components/categories.test.tsx`

**Interfaces:**
- Consume `BrandIcon` and `resolveBrandIconName` from Task 1.
- Keep existing category hrefs, labels, ordering, and fallback behavior unchanged.

- [x] Add a failing assertion that category markup includes the resolved brand icon and keeps the category link.
- [x] Replace image-only category tiles with the responsive brand-icon tile and preserve accessible labels.
- [x] Use the resolver in the drawer/menu for root categories and keep the generic fallback for unknown names.
- [x] Run the focused category tests and confirm they pass.

### Task 3: Replace trust and customer action icons

**Files:**
- Modify: `src/views/home/components/trust-bar.tsx`
- Modify: `src/layout/core/desktop-header.tsx`
- Modify: `src/layout/core/mobile-header.tsx`
- Modify: `src/layout/components/cart-button.tsx`
- Modify: `src/layout/components/user-button.tsx`
- Modify: `src/components/search/index.tsx`
- Modify: `src/components/ui/MobileBottomNav.tsx`
- Test: `src/components/brand-icons/integration.test.ts` plus existing component tests.

**Interfaces:**
- Consume the same `BrandIcon` names from Task 1.
- Preserve all existing button labels, hrefs, click handlers, badges, tooltips, and RTL layout.

- [x] Replace the inline trust SVGs and generic header/cart/account icons with the brand family.
- [x] Pass the brand search glyph into the mounted storefront `SearchBox` and use the family in mobile bottom navigation.
- [x] Keep close, editor, media, and social icons unchanged because they are outside this icon-system scope.
- [x] Run component tests, lint, and type checking through the project test/build commands.

### Task 4: Verify, document, commit, and push

**Files:**
- Verify: all files from Tasks 1–3 and `docs/tebahmadi-icon-system.md`

- [x] Run `npm test` and confirm all tests pass.
- [x] Run `npm run lint` and `npm run build` and confirm both pass.
- [x] Run `git diff --check` and inspect the final diff for banner changes or unrelated files.
- [x] Commit with `feat: add Tab Ahmadi brand icon system`.
- [x] Push `main` to `origin` and verify local `HEAD` equals `origin/main`.
