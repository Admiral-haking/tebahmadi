# Plan: Stabilize Tab Ahmadi branding, loading, and SEO

## Goal

Make the public storefront load with a consistent Tab Ahmadi identity, remove generic/source-project fallbacks from customer-facing pages, and restore public health checks for reliable monitoring.

## Tasks

1. Add a single brand configuration and safe default site information; use it when MongoDB has no `site_info` document and seed only the missing server record.
2. Update root metadata, canonical/structured data, page-level SEO defaults, local logo fallback, footer copy, blog copy, and search copy for Persian natural products.
3. Add public `/api/health` and `/api/readiness` endpoints, exempt only those endpoints in middleware, and remove the external analytics preload/script from the no-external-service deployment.
4. Add focused tests, run lint/typecheck/test/build, inspect rendered title/metadata/health responses, commit and push.
5. Deploy the verified commit to the existing PM2 service on port 3210, preserve `.env.local`, and verify public pages and monitoring endpoints.

## Safety

- Do not change the Shamim source directory.
- Do not print or commit credentials.
- Do not delete existing MongoDB data; only upsert the brand defaults if the site-info document is absent.
