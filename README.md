# فروشگاه طب احمدی

A local-first Persian/RTL commerce application running on Vinext, Node.js and SQLite.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git and `tar` (including Windows `tar.exe`) are required for publishing; portable publication does not require Bash

## Local ecommerce workflow

Local development uses Node.js and a persistent SQLite database. Payment, shipping and SMS default to mock adapters; copy `.env.example` only when configuring local values and never commit real credentials.

`PAYMENT_PROVIDER=mock` and `SHIPPING_PROVIDER=mock` are the safe local defaults. Selecting `http`, `zarinpal`, or `tapin` without the required credentials does not silently fall back to mock: readiness returns `503` and the integration status exposes only the provider name and a boolean configuration flag. Public order creation also validates the request origin and is rate-limited per client IP.

Provider values are read from environment variables. Configure `PAYMENT_PROVIDER=zarinpal`, `SHIPPING_PROVIDER=tapin`, or `SMS_PROVIDER=sms_ir` only when the corresponding credentials are available; local mode remains deterministic with mock providers.

برای عملیات ارسال، ادمین مجاز می‌تواند مرسوله را از مسیر `POST /api/admin/shipping/tapin/register` ثبت و از مسیر `POST /api/admin/shipping/tapin/track` دوباره پیگیری کند. endpoint پیگیری، سفارش و کد رهگیری را اعتبارسنجی می‌کند و وضعیت shipment، سفارش و timeline را هم‌زمان به‌روزرسانی می‌کند. در Tapin مستقیم از endpoint رسمی `order/post/get-status/report` استفاده می‌شود.

```sh
pnpm install
pnpm build
pnpm db:migrate:local
pnpm db:seed:local
pnpm dev
```

Useful verification commands:

```sh
pnpm db:verify
pnpm smoke:local
pnpm smoke:local:with-server
pnpm config:verify:production
pnpm test:all
```

`smoke:local` یک سرور موجود روی `127.0.0.1:5173` را بررسی می‌کند؛ برای اجرای مستقل، از
`smoke:local:with-server` استفاده کنید تا dev server با providerهای mock بالا بیاید،
smoke اجرا شود و سپس server بسته شود.

`test:all` runs lint, unit tests, typecheck, Playwright E2E and build. The CI workflow also installs a clean local database, applies migrations, seeds only test data, and runs the same verification gates.

Before a production release, run `pnpm config:verify:production` with the provider values and secrets injected by the deployment environment. The command validates presence and provider names without printing secret values.

The complete non-deploying release gate is `pnpm verify:release`; it validates production configuration, runs lint/unit/typecheck/E2E/build, and verifies the local migration/schema contract. Run it in the release environment before applying production migrations.

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

Local development does not require `wrangler.jsonc`, a Cloudflare account, or a remote database.

Publish archives outside the source checkout or under its ignored `outputs/` directory. Local `.env*`, `.dev.vars*`, TypeScript build state, and tool runtime directories are ignored; keep the hosting manifest, migrations, and authored scripts in source control.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

The local runtime keeps application data in `.local/store.sqlite`; generated tool directories are disposable local state.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For managed Linux browser QA, follow the Sites skill's managed preview reference. The daemon runs the project's Vite dev script with `--host 0.0.0.0 --port 4173 --strictPort`; use the CLI's returned URL. The ignored local profile survives the daemon's cleared environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The application uses Vinext for rendering and runs locally on Node at `127.0.0.1`; it does not deploy the site or require a remote service. Use the URL printed by the server.

Local previews do not fetch remote request metadata or send usage metrics.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.local/store.sqlite` contains the local application database
- `lib/local-node-runtime.ts` provides the local runtime and D1-compatible query surface
- `scripts/vite/` contains the maintained Vite integrations and the vendored Sites plugin license
- the remaining `scripts/` files select execution profiles and run installation, development, and builds; the plugin's helpers orchestrate the Sites lifecycle
- `dist/` contains generated build output; `.local/`, `.vinext/`, and test reports contain ignored local state
- `db/index.ts` exposes the typed data access boundary used by the application
- `db/schema.ts` contains the typed Drizzle schema for the ecommerce tables
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local Node/SQLite database

Local development is independent of Cloudflare, Wrangler, and D1. `pnpm dev` and `pnpm start` run Vinext on the Node runtime and use the SQLite database at `.local/store.sqlite`. The existing route contracts are backed by a small D1-compatible adapter, so migrations and API behavior stay consistent while the application remains local-first.

Run `pnpm db:migrate:local` to apply the ordered SQL migrations, `pnpm db:verify` to inspect migration/table counts, and `pnpm db:seed:local` to create disposable local fixtures. Use `pnpm db:reset:node` only when intentionally resetting local state. The optional ZarinPal, Tapin, and SMS.ir adapters remain disabled unless their provider and credentials are explicitly configured.

## Diagnostic Commands

- `pnpm install`: install the locked dependencies
- `pnpm dev`: start the Vite/Vinext development server
- `pnpm build`: build the application with the local Node runtime
- `pnpm start`: start the local Node/Vinext preview with SQLite
- `pnpm db:generate`: generate Drizzle migrations after schema changes
- `pnpm db:migrate:local`: apply pending migrations to local SQLite
- `pnpm db:verify`: verify tables and migration tracking
- `pnpm test:e2e`: run browser smoke tests

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
# tebahmadi
