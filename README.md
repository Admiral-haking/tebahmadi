# Catalog Backend (Next.js App Router)

This repository contains a backend-only catalog stack built on **Next.js 15 App Router** running in Node.js with **Mongoose** for persistence and **Zod** for runtime validation. It delivers:

- A dynamic product model driven by reusable **ProductType** definitions.
- Variant-aware **Product** documents with price, inventory, and offer logic.
- A hierarchical **Category** tree with efficient subtree queries.
- REST-style route handlers under `/app/api/catalog/**` for product types, products, and categories.

> ⚠️ **Currency policy:** the storefront is permanently denominated in **Iranian Toman**. Prices and offers are stored as integers representing Toman amounts. No currency field is exposed anywhere in the API or the database.

## Implementation Guardrails

- Auth enforcement: Add an Edge middleware that verifies `auth_token` via `jose`, maps roles→permissions, and blocks unauthorized POST/PATCH/DELETE to admin routes. Keep handler-level `requirePermission()` checks for defense in depth. Public routes: `/api/auth/*`, `/api/media/[id]` (GET), `/api/offers/apply` (GET/POST), `/api/transport/quote` (GET/POST), and the `/payments/verify` page.
- All currency inputs/outputs remain integer Toman amounts—never introduce alternate currency fields.
- Cache reads must opt into Next.js tags/`unstable_cache`; write paths call `revalidateTag` / `revalidatePath` for affected resources.

## Architecture Overview

```
ProductType ─┐
             ├─> buildProductValidator() ─┐
Product      ┘                            ├─ materialize filterable attrs
                                          └─ compute searchable text
Category ─ hierarchical adjacency list with path + ancestors
```

1. **ProductType** documents register attribute definitions (global & variant). Each definition controls validation, filtering, search behaviour, and variant handling.
2. **Product** creation/update loads the matching ProductType, builds a Zod schema on the fly, validates the payload, and then materialises:
   - `attributeValues` (global attributes)
   - `variants[].attributeValues` (variant-driving attributes)
   - `attrs.*` map for hot filters (only attributes flagged `filterable: true`)
   - `searchableText` derived from title, brand, and searchable attributes
3. **Category** stores `path`, `ancestors`, and `depth` to allow fast subtree lookups and breadcrumb construction. Moves/renames cascade to all descendants.

All data flows through `/lib/mongoose.ts` to re-use a single MongoDB connection in development.

## Data Models

### ProductType (`catalog/models/ProductType.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| `name` | `string` | Unique, required |
| `version` | `number` | Defaults to `1`; can be bumped manually |
| `attributes[]` | `AttributeDef` | Drives validation/search/filter logic |

`AttributeDef` fields:

- `key` – unique per ProductType, alphanumeric/underscore.
- `kind` – one of `text`, `number`, `boolean`, `enum`, `multi-enum`, `json`.
- `required`, `variant`, `filterable`, `searchable` – booleans controlling behaviour.
- `enumValues`, `min`, `max`, `regex`, `unit` – optional metadata/constraints.

Index: `{ name: 1 }` (unique).

### Product (`catalog/models/Product.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| `productTypeId` | `ObjectId` | Reference to ProductType |
| `typeVersion` | `number` | Snapshot of ProductType.version |
| `title` | `string` | Required |
| `slug` | `string` | Unique |
| `attributeValues[]` | `{ key, value }` | Global attributes |
| `attrs` | `Map<string, Mixed>` | Materialised filterable attributes |
| `variants[]` | `Variant` | At least one variant |
| `categories[]` | `ObjectId` | Many-to-many relationship |
| `searchableText` | `string` | Lowercased string for MongoDB full-text |
| `status` | `draft` \\ `active` \\ `archived` | Defaults to `draft` |

`Variant` subdocument:

| Field | Type | Notes |
| --- | --- | --- |
| `sku` | `string` | Unique across catalog |
| `attributeValues[]` | `{ key, value }` | Only variant-driving attributes |
| `price` | `{ model, amount, unitOfMeasure? }` | `amount` in Toman |
| `offer?` | `{ amount, startsAt?, endsAt?, label? }` | Absolute discount (Toman) |
| `inventory` | `{ trackingUnit, quantity, lowStockThreshold? }` | Numbers in physical units |
| `mediaIds?` | `ObjectId[]` | Optional binary references |
| `barcode?` | `string` | |
| `active` | `boolean` | Defaults to `true` |

Indexes (selected):

- `{ slug: 1 }` unique
- `{ categories: 1 }`
- `{ brand: 1 }`
- `{ searchableText: 'text' }`
- `{ 'attrs.size': 1 }`, `{ 'attrs.color': 1 }` (example hot filters)
- `{ 'variants.sku': 1 }` unique
- `{ 'variants.offer.startsAt': 1 }`, `{ 'variants.offer.endsAt': 1 }`

### Category (`catalog/models/Category.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| `name` | `string` | Required |
| `slug` | `string` | Unique among siblings |
| `parentId?` | `ObjectId` | Nullable |
| `path` | `string` | e.g. `men/shoes/running` |
| `ancestors[]` | `ObjectId[]` | Ordered root → parent |
| `depth` | `number` | Root = 0 |
| `position` | `number` | Sibling ordering |
| `isActive` | `boolean` | Defaults to `true` |
| `seoTitle?`, `seoDescription?`, `imageId?` | Metadata |

Indexes: `{ path: 1 }` unique, `{ parentId: 1, slug: 1 }` unique, `{ ancestors: 1 }`, `{ parentId: 1, position: 1 }`.

## Category Hierarchy Strategy

Categories implement an **adjacency list** (`parentId`) plus **materialised path** (`path`) and **ancestor chain** (`ancestors`). This enables:

- Constant-time breadcrumb queries (`ancestors` + self).
- Efficient subtree expansion via `ancestors` (single indexed query).
- Simple path slug generation (`parent.path + '/' + slug`).

When a category moves or renames, `categoryService.updateCategory()` recalculates the path/ancestors/depth for the node and cascades the update down the entire subtree, ensuring paths remain consistent.

## Validation & Pricing Rules

- Zod schemas are built dynamically from each ProductType via `buildProductValidator()`.
- Attribute arrays only accept keys defined in the ProductType; duplicates or missing required keys raise validation errors.
- `offer.amount` is an absolute discount in Toman. Active window checks require `startsAt <= endsAt` when both provided.
- Effective unit price helper:

```ts
function effectiveUnitPrice(variant, now = new Date()) {
  const base = variant.price.amount;
  const o = variant.offer;
  const active = !!o && (!o.startsAt || now >= o.startsAt) && (!o.endsAt || now <= o.endsAt);
  const discount = active ? o.amount : 0;
  return Math.max(0, base - discount);
}
```

- Inventory quantities & low-stock thresholds are integers tied to the specified `trackingUnit`.

## API Endpoints

All endpoints live under `/api/catalog/**` and return JSON with `{ error: string }` on failures. Remember to set `Content-Type: application/json` on mutating requests.

### Product Types

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/catalog/product-types` | List all product types |
| `POST` | `/api/catalog/product-types` | Create a product type |
| `GET` | `/api/catalog/product-types/:id` | Read a single product type |
| `PATCH` | `/api/catalog/product-types/:id` | Update name/version/attributes |
| `DELETE` | `/api/catalog/product-types/:id` | Delete (only if unused by products) |

**Create ProductType**

```bash
curl -X POST http://localhost:3000/api/catalog/product-types \
  -H 'Content-Type: application/json' \
  -d '{
        "name": "Shoes",
        "version": 1,
        "attributes": [
          { "key": "gender", "label": "Gender", "kind": "enum", "enumValues": ["men","women"], "filterable": true },
          { "key": "material", "label": "Material", "kind": "text", "searchable": true }
        ]
      }'
```

### Products

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/catalog/products` | List products with filtering |
| `POST` | `/api/catalog/products` | Create a product (validates against ProductType) |
| `GET` | `/api/catalog/products/:id` | Read product detail |
| `PATCH` | `/api/catalog/products/:id` | Update a product (send a full payload) |
| `DELETE` | `/api/catalog/products/:id` | Soft delete (status → `archived`) |

Query parameters for listing:

- `productTypeId=<ObjectId>`
- `categoryId=<ObjectId>` (expands to subtree automatically)
- `q=<text>` (MongoDB `$text` search against `searchableText`)
- `status=draft|active|archived` (repeatable)
- `attr.<key>=<value>` (repeatable for OR matching)
- `limit`, `skip`

**Create Product** (prices & offers in Toman)

```bash
curl -X POST http://localhost:3000/api/catalog/products \
  -H 'Content-Type: application/json' \
  -d '{
        "productTypeId": "662ea1a4fe31c5c7c7f5f310",
        "title": "Air Runner",
        "slug": "air-runner",
        "brand": "Flux",
        "attributeValues": [
          { "key": "gender", "value": "men" }
        ],
        "variants": [
          {
            "sku": "AIR-RUNNER-42",
            "attributeValues": [ { "key": "size", "value": "42" } ],
            "price": { "model": "fixed", "amount": 2150000 },
            "inventory": { "trackingUnit": "pair", "quantity": 24 }
          }
        ],
        "categories": ["662ea3935e4b1c8fd6c0a912"],
        "status": "active"
      }'
```

**Filter Products** by subtree & attribute:

```bash
curl 'http://localhost:3000/api/catalog/products?categoryId=662ea3935e4b1c8fd6c0a912&attr.gender=men&attr.size=42'
```

**Archive Product**

```bash
curl -X DELETE http://localhost:3000/api/catalog/products/6630a0e7a4f3a1bdb0a3c9e1
```

> **PATCH behaviour:** send a full product payload (same shape as creation) so the catalog can revalidate and re-materialise attributes. Partial updates are not supported at the moment.

### Categories

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/catalog/categories` | List roots (default) or pass `parentId`, `q`, `pathPrefix` |
| `POST` | `/api/catalog/categories` | Create a category |
| `GET` | `/api/catalog/categories/:id` | Read category + breadcrumb |
| `PATCH` | `/api/catalog/categories/:id` | Update/move/rename (cascades to descendants) |
| `DELETE` | `/api/catalog/categories/:id` | Delete only when leaf |

**Create root category**

```bash
curl -X POST http://localhost:3000/api/catalog/categories \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Shoes", "slug": "shoes" }'
```

**Move category under a new parent & rename**

```bash
curl -X PATCH http://localhost:3000/api/catalog/categories/6630a3c7a4f3a1bdb0a3cc11 \
  -H 'Content-Type: application/json' \
  -d '{ "slug": "running", "parentId": "6630a2eaa4f3a1bdb0a3cb01" }'
```

**List children of a parent**

```bash
curl 'http://localhost:3000/api/catalog/categories?parentId=6630a2eaa4f3a1bdb0a3cb01'
```

## Indexing & Performance

- All critical indexes defined in the schemas (unique slugs, `searchableText` text index, category path/ancestors, variant SKU uniqueness).
- `attrs.*` indexes exist for `size` and `color` as defaults; expand with additional `productSchema.index({ 'attrs.<key>': 1 })` entries when a filter becomes hot.
- Product listing limits to 100 per request to protect the database.
- Category subtree queries rely on `{ ancestors: 1 }` index for fast lookups.

## Local Development

1. Ensure dependencies are installed (root `package.json` already references `mongoose`, `zod`, `sharp`, etc.):
   ```bash
   npm install
   ```
2. Provide required environment variables via `.env.local` (or any environment loader supported by Next.js):
   ```
   MONGO_URI=mongodb://127.0.0.1:27017/catalog
   JWT_SECRET=dev-placeholder
   GHASEDAK_API_KEY=your-ghasedak-api-key
   GHASEDAK_OTP_TEMPLATE=your-otp-template-name
   ```
   Only `MONGO_URI` is required for the catalog; additional secrets may be present for other parts of the project.
3. Run the API locally:
   ```bash
   npm run dev
   ```
4. Use the REST endpoints documented above to seed product types, categories, and products.

## Future Extensions

- **Promotions engine:** layer campaign rules on top of the absolute offer model (percentage discounts, buy-one-get-one, etc.).
- **Search indexing:** push `searchableText`, filterable attributes, and availability into a dedicated search service (Meilisearch/Elastic) for richer querying.
- **Inventory reservations:** integrate with order workflow to hold stock during checkout.
- **Media pipeline:** link `variants.mediaIds` to GridFS asset management for richer galleries.
- **Analytics hooks:** emit domain events on product/category mutations for further processing.

With these building blocks you can manage an extensible catalog with variant-aware pricing, precise validation, and hierarchy-aware category navigation—entirely within the Next.js App Router backend.

## Payments (ZarinPal)

The checkout flow now supports ZarinPal payments using the dedicated `PaymentTransaction` model and service layer. All values remain in **Iranian Toman** (integers).

### Flow Overview

1. **Invoice finalisation** – Create an invoice using the orders module (grand total already computed in Toman).
2. **Create payment** – Call `createPaymentForInvoice({ invoiceId, userId, amount, ... })`. The service validates the invoice, creates a `PaymentTransaction`, calls ZarinPal's `PaymentRequest`, and returns `{ gatewayUrl, authority, transactionId }`.
3. **Redirect customer** – Send the shopper to `gatewayUrl` (or show a button). Optionally call `markRedirected(transactionId)` when rendering the redirect link.
4. **Gateway interaction** – Customer completes (or cancels) payment on ZarinPal.
5. **Callback** – ZarinPal redirects back to `APP_BASE_URL + PAYMENT_CALLBACK_PATH` with `Authority`, `Status`, `invoiceId`, and `tx` query params.
6. **Verification page** – `/payments/verify` parses the query, calls `verifyAndFinalize()`, and renders success or failure. Successful verifications mark the transaction as `paid` and update the linked invoice to `status='paid'`.

### Transaction lifecycle

`initiated → requested → redirected → paid | failed | canceled`

- `createPaymentForInvoice()` moves a transaction from `initiated` to `requested` after a successful PaymentRequest.
- `markRedirected()` records that the customer was sent to ZarinPal.
- `verifyAndFinalize()` marks the record `paid` on ZarinPal codes **100** (success) and **101** (already verified). Any other code records the payload and marks the transaction `failed`.
- The verify page marks `canceled` when the gateway returns `Status=NOK`.

### Idempotency

- Re-running verification on the same Authority returns the stored `refId` without double-charging.
- ZarinPal code **101** is treated as a successful, already-verified payment.
- Transactions are tied to invoices; once an invoice becomes `paid`, subsequent payment attempts for that invoice are rejected as `invoice_already_paid`.

### Environment configuration

| Variable | Required | Description |
| --- | --- | --- |
| `MONGO_URI` | ✅ | MongoDB connection string |
| `APP_BASE_URL` | ✅ | Public site origin (e.g. `https://example.com`) |
| `PAYMENT_CALLBACK_PATH` | optional | Defaults to `/payments/verify` |
| `ZARINPAL_MERCHANT_ID` | ✅ | MerchantID from ZarinPal |
| `ZARINPAL_SANDBOX` | optional | `'true'` (default) for sandbox, `'false'` for production |

`callbackURL` is computed as `APP_BASE_URL + PAYMENT_CALLBACK_PATH + '?invoiceId=...&tx=...'`.

### Usage snippets

```ts
import { createPaymentForInvoice, verifyAndFinalize } from '@/payments/paymentService';

// Server action / route handler: create payment
const { gatewayUrl, transactionId } = await createPaymentForInvoice({
  invoiceId,
  userId,
  amount: invoice.grandTotal,
  description: `Invoice ${invoice.number}`,
  mobile: '+989123456789',
});
// Redirect shopper to gatewayUrl

// Verification (already handled in /payments/verify)
await verifyAndFinalize({ authority, invoiceId, transactionId });
```

### Security notes

- Always validate the payment amount against the invoice total server-side; never trust client-submitted amounts.
- Capture and persist `verifyPayload` for audit trails, but do not expose the raw payload to clients.
- Treat the verification endpoint as the source of truth. Even if you later consume asynchronous webhooks, keep server-side verification in place.
- Store sensitive configuration (`ZARINPAL_MERCHANT_ID`, `APP_BASE_URL`) in environment variables and avoid bundling them client-side.

## Content & SEO Platform

The content subsystem adds a full blogging stack, custom pages, and granular SEO controls layered on top of the existing Next.js backend. All models are designed for direct use within Server Components or Route Handlers (no REST round-trips required when composing pages).

### Domain Overview

- **BlogCategory** – hierarchical taxonomy with adjacency pointers plus materialised `path`/`ancestors` for fast subtree queries.
- **BlogPost** – rich article document linking to categories, tags, and author metadata with embedded SEO overrides.
- **Page** – arbitrary custom pages (`/about`, `/policies/refund`, etc.) with their own publish lifecycle and SEO fields.
- **MetaOverride** – slug-based SEO overrides for routes that don’t map to a direct entity (e.g. `/`, `/blog`, `/store`).
- **SiteInfo** – global copy and contact/social metadata consumable across layouts.
- **SiteConfig** – runtime configuration bucket (replaces `.env` overrides) with first-run/onboarding enforcement.
- **Metadata Resolver** – merges SEO inputs from entity → override → category → site info in that precedence order.

### Data Models

| Model | Key fields | Notes |
| --- | --- | --- |
| `BlogCategory` | `name`, `slug`, `parentId`, `path`, `ancestors[]`, `depth`, `position`, `isActive`, `seo` | Unique `path`, sibling-unique `slug`. `ancestors` stores ordered ObjectId chain root→parent. |
| `BlogPost` | `title`, `slug`, `excerpt`, `content`, `coverImageId`, `categories[]`, `tags[]`, `authorId`, `status`, `publishedAt`, `seo` | Text index on `title/excerpt/content`. `status` workflow (`draft`→`published`→`archived`). |
| `Page` | `title`, `slug`, `content`, `status`, `publishedAt`, `seo` | Supports nested slugs such as `policies/refund`. |
| `MetaOverride` | `slug`, `seo` | Slug must start with `/` (`/`, `/blog`, `/store`). Used when no primary entity exists. |
| `SiteInfo` | `appName`, `description`, `addresses[]`, `bio`, `phones[]`, `socials[]`, `customData` | Singleton document (service upserts). `customData` accepts arbitrary JSON for front-end experiments. |
| `SiteConfig` | `isOnboardingComplete`, `requiredKeys[]`, `values` | Singleton document. `requiredKeys` lists configuration keys that must be present before onboarding completes. |

### Category Hierarchy Strategy

Categories combine an adjacency list (`parentId`) with materialised metadata:

- **`path`** – concatenation of ancestor slugs (`root/child/grandchild`).
- **`ancestors`** – ordered ObjectId chain used for breadcrumbs and subtree fetches.
- **`depth`** – cached level (root = 0).

When a category is created or moved, `categoryService` recomputes `path`, `ancestors`, and `depth`, then cascades updates to descendants via bulk writes.

```
Root: { slug: 'insights', path: 'insights', depth: 0 }
Child: { slug: 'guides', path: 'insights/guides', depth: 1 }
Grandchild: { slug: 'devops', path: 'insights/guides/devops', depth: 2 }
```

Moving `guides` under a new parent automatically rewrites every descendant path and ancestor chain.

### SEO Metadata Resolution

`resolveSeoForRoute({ slug, entitySeo?, categorySeo? })` merges metadata using the following precedence (highest first):

1. **Entity SEO** – blog post or page level overrides (`BlogPost.seo`, `Page.seo`).
2. **MetaOverride** – route-level overrides stored in `MetaOverride` (`/`, `/blog`, `/store`).
3. **Category SEO** – useful when rendering a category archive listing.
4. **SiteInfo defaults** – falls back to `SiteInfo.appName` and `SiteInfo.description`.
5. **Hard defaults** – empty fields.

Example: rendering `/blog/devops-guide` with a post-level title will return that title. If the post omits a description, the resolver inspects the `/blog` override, then the category’s SEO description, and finally the global site description.

### Service Usage from Server Components

All services are safe to import server-side:

```ts
import { listPosts } from '@/content/services/postService';
import { resolveSeoForRoute } from '@/seo/services/metaResolve';

export default async function BlogPage() {
  const posts = await listPosts({ status: 'published', limit: 10 });
  const seo = await resolveSeoForRoute({ slug: '/blog' });
  // Render using posts + seo
}
```

`settingsService.assertConfiguredOrThrow()` can guard routes/actions that require onboarding to be complete.

### First-Run / Onboarding Flow

- `SiteConfig.values` stores arbitrary configuration key/value pairs (API tokens, theme colours, etc.).
- `SiteConfig.requiredKeys` names the keys that must be populated.
- `isOnboardingComplete` flips to `true` once admins finish setup.
- `settingsService.isConfigured()` returns `{ ok, missingKeys }` and `assertConfiguredOrThrow()` raises an error with `code='SETUP_REQUIRED'` when configuration is incomplete.

### REST Endpoints & Examples

All handlers live under `/app/api` and validate payloads with Zod.

**Create root category**

```bash
curl -X POST http://localhost:3000/api/blog/categories \
  -H 'Content-Type: application/json' \
  -d '{ "name": "Insights", "slug": "insights" }'
```

**Move category under a new parent**

```bash
curl -X PATCH http://localhost:3000/api/blog/categories/6650f8f6e1b5f6dea4c1e101 \
  -H 'Content-Type: application/json' \
  -d '{ "parentId": "6650f8b3e1b5f6dea4c1e0f5", "slug": "guides" }'
```

**Create & publish a blog post**

```bash
curl -X POST http://localhost:3000/api/blog/posts \
  -H 'Content-Type: application/json' \
  -d '{
        "title": "DevOps in 2025",
        "slug": "devops-2025",
        "content": "# Future of DevOps...",
        "status": "published",
        "categories": ["6650f8f6e1b5f6dea4c1e101"]
      }'
```

**Create a published custom page**

```bash
curl -X POST http://localhost:3000/api/pages \
  -H 'Content-Type: application/json' \
  -d '{
        "title": "About Us",
        "slug": "about",
        "content": "<p>Our story…</p>",
        "status": "published"
      }'
```

**Set a meta override for `/blog`**

```bash
curl -X POST http://localhost:3000/api/seo/meta-overrides \
  -H 'Content-Type: application/json' \
  -d '{ "slug": "/blog", "seo": { "title": "All Blog Posts", "description": "Latest insights" } }'
```

**Update global site information**

```bash
curl -X PATCH http://localhost:3000/api/settings/site-info \
  -H 'Content-Type: application/json' \
  -d '{
        "appName": "Acme Store",
        "description": "Beautiful commerce experiences",
        "phones": [{ "label": "Support", "number": "+98-21-123456" }]
      }'
```

**Complete onboarding**

```bash
curl -X PATCH http://localhost:3000/api/settings/site-config \
  -H 'Content-Type: application/json' \
  -d '{
        "requiredKeys": ["primaryColor", "supportEmail"],
        "values": { "primaryColor": "#ff7744", "supportEmail": "support@example.com" },
        "isOnboardingComplete": true
      }'
```

### Indexing & Performance Notes

- `BlogCategory` indexes: unique `path`, `{ parentId, slug }`, `{ ancestors }`, `{ parentId, position }` for fast sibling ordering & subtree lookups.
- `BlogPost` indexes: text index on `title/excerpt/content`, `{ status, publishedAt }`, `{ categories }` for archive filters.
- `Page` indexes: `{ status, publishedAt }` plus unique `slug`.
- `MetaOverride` unique `slug` ensures one override per route.
- `SiteInfo`/`SiteConfig` rely on services to enforce singleton semantics (no additional indexes required).

### Extensibility Ideas

1. **Multi-language support** – introduce per-locale slugs and metadata fields, possibly via embedded translations.
2. **Scheduled publishing** – extend services to support `publishAt` timestamps and background jobs.
3. **Draft previews** – generate signed preview URLs that bypass publish-state checks.
4. **Caching** – tag responses in Next.js RSC with cache tags (e.g., `revalidateTag('blog-posts')`) after service mutations.
5. **Content revisions** – store historical versions of posts/pages for audit and rollback.

---

## Deployment & Server Migration

A full, step-by-step migration guide (prerequisites, dependencies, environment
variables, database/media transfer, PM2, Nginx, and cron automation) lives in
**[DEPLOYMENT.md](DEPLOYMENT.md)**.

### Quick reference

- **Runtime:** Node.js 20 LTS or 22 (production currently runs Node 24).
- **Install:** `npm ci` — all public packages are pinned in `package-lock.json`.
- **Config:** copy `.env.example` → `.env.production` and fill in secrets. Next.js
  loads `.env.production` automatically when `NODE_ENV=production`.
- **Build & run:** `npm run build`, then `pm2 start ecosystem.config.js` (two
  processes: public `app` on `:3000` and background `worker` on `:3001`).
- **Database:** MongoDB; media is stored in **GridFS**, so a single
  `mongodump`/`mongorestore` migrates everything — no media files on disk.
- **Automation:** `./cron.sh` installs the inventory/order sync cron jobs that hit
  `/api/sync/*`.

### Tab Ahmadi backup service

The production backup service stores a compressed dump of only the `tebahmadi`
database. GridFS media is included automatically because it lives in the same
database. Backups are written to `/var/backups/tebahmadi`, protected with a
checksum, and directories older than 48 hours are pruned.

Install the versioned units as root on the production host:

```bash
install -m 0755 scripts/backup-tebahmadi.sh /home/ali/tebahmadi/scripts/backup-tebahmadi.sh
install -m 0644 deploy/systemd/tebahmadi-backup.service /etc/systemd/system/tebahmadi-backup.service
install -m 0644 deploy/systemd/tebahmadi-backup.timer /etc/systemd/system/tebahmadi-backup.timer
install -d -o ali -g ali -m 0700 /var/backups/tebahmadi
systemctl daemon-reload
systemctl enable --now tebahmadi-backup.timer
systemctl start tebahmadi-backup.service
```

Inspect the timer and verify the latest archive without printing environment
values:

```bash
systemctl status tebahmadi-backup.timer --no-pager
systemctl list-timers tebahmadi-backup.timer --no-pager
journalctl -u tebahmadi-backup.service -n 80 --no-pager
sha256sum -c /var/backups/tebahmadi/<timestamp>/SHA256SUMS
```

For a planned restore, stop application writes first and use the matching
archive with `mongorestore --gzip --archive=...`; never use `--drop` without a
fresh backup of the current database.

### Scripts (`package.json`)

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest test suite |
| `npm run lint` | ESLint |
| `npm run clear:carts` | Clear stale carts |
| `npm run digikala:fetch` / `:import` / `:sync-daily` | Digikala catalog sync |
| `npm run check:torob` / `:torob-products` | Torob feed checks |
