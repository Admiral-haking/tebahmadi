# Plan: Mobile load, catalog content and auth retention

## Spec

`docs/superpowers/specs/2026-11-24-mobile-load-catalog-auth-design.md`

## Tasks

### 1. Stabilize initial loading

- Replace the full-screen theme-variable loading overlay with a static, responsive skeleton in `src/app/loading.tsx`.
- Reserve header, hero, category and product-section space without depending on hydrated MUI variables.
- Keep the existing route streaming behavior and avoid adding a client-side loading loop.

### 2. Preserve and correct special discounts

- Keep `DiscountProducts` mounted in `src/views/home/index.tsx`.
- Change `loadDiscount` so an empty/error response returns an empty list, not preview products.
- Filter the returned list to active, in-stock, genuinely discounted entries before rendering.
- Keep preview fallback behavior for popular/newest unless it is independently empty.
- Add focused tests for empty and failed discount loading.

### 3. Improve mobile catalog and product purchase UI

- Make `ProductGallery` and the product detail gallery use a stable fluid aspect ratio, smaller mobile height, and horizontal thumbnail scrolling.
- Remove fixed-height behavior that creates large blank regions when an image is absent.
- Make product detail grid/panels use `minWidth: 0`, compact padding, and a mobile single-column purchase row.
- Make store/product card grids and images preserve aspect ratio at narrow widths.
- Verify no horizontal overflow is introduced.

### 4. Improve mobile admin entry and navigation

- Add a compact mobile admin header with title, storefront link and menu trigger.
- Keep drawer-only developer items hidden from the main list and make drawer close/navigation behavior touch-friendly.
- Preserve the existing admin auth guard and the mobile bottom shortcuts.

### 5. Extend login session and update catalog draft content

- Change the default JWT TTL to 30 days while preserving `JWT_TTL_SECONDS` override.
- Keep OTP TTL, cooldown and attempt limits unchanged.
- Update the catalog seed/data path with the supplied descriptions and a third draft hair-removal oil, keeping sensitive supplier notes non-public and all three products inactive until complete data is supplied.

### 6. Verify

- Run focused tests, full tests, lint, `npx tsc --noEmit`, and production build.
- Run a local production smoke test at narrow viewport sizes and inspect the generated HTML for the discount section behavior.
- Report any deployment work separately; do not deploy until explicitly requested after verification.
