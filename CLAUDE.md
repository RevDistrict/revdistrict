# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — dev server on http://localhost:3000
- `npm run typecheck` (runs `next typegen` first), `npm run lint`, `npm run format:check` / `npm run format`
- `npm test` — unit tests (`tsx --test tests/*.test.ts`); single file: `npx tsx --test tests/adf.test.ts`
- `npm run test:e2e` — Playwright (`tests/*.spec.ts`); needs the app running on localhost:3000 against a test DB seeded by `npm run test:e2e:seed` (262-vehicle fixture; start the app with that `RD_DATABASE_URL` and `SITE_URL` unset), uses system Chrome (override with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, `TEST_BASE_URL`)
- `npm run build` then `npm run test:inventory` (needs `TEST_DATABASE_URL`, a throwaway Postgres DB whose name ends in `_test`; starts a fake S3 and the app) / `npm run test:integrations` (fake Resend API and temp app; needs Chromium and `TEST_DATABASE_URL`)
- `npm run inventory:import` — read the dealr.cloud CSV from S3 and upsert it into Postgres; `npm run db:migrate` applies `db/schema.sql` first (see `docs/DEALR-INVENTORY.md`)
- CI (`.github/workflows/checks.yml`) runs format:check, typecheck, lint, test, build, test:inventory, test:integrations, `npm audit --audit-level=high`.
- Vercel builds run `scripts/vercel-build.mjs` via `buildCommand` in `vercel.json` (env check, production-only `db:migrate`, then `next build`); `npm run build` is plain `next build`.
- Production runs `server.cjs` (custom Node server wrapping Next, see `docs/DEPLOYMENT.md`).

## Architecture

Next.js App Router dealership site (RevDistrict / The Used Car Factory, Midvale UT). Postgres holds inventory only; no customer accounts or lead storage; saved vehicles live only in browser `localStorage` (`revdistrict-saved`).

**Inventory** (`src/lib/inventory.ts`, `getInventory`): reads `vehicles` / `inventory_meta` from Postgres (`RD_DATABASE_URL`, pool in `lib/db.ts`, schema in `db/schema.sql`). With no `RD_DATABASE_URL` or no import it throws (no placeholder inventory); data older than 72 hours also throws. `lib/inventory-import.ts` is the only writer: it fetches the CSV from S3 (`S3_BUCKET_NAME`/`S3_INVENTORY_KEY`, standard `AWS_*` creds), parses it with `lib/dealr-inventory.ts`, upserts vehicles and deletes any not in the CSV. It runs hourly at :15 from the Vercel cron route `/api/cron/inventory` (`vercel.json`, Bearer `CRON_SECRET`), which emails `EMERGENCY_EMAIL` via Resend (`lib/inventory-alert.ts`) when an import fails and from the `scripts/import-inventory.ts` CLI. `src/data/legacy-vehicles.json` is only legacy slug data and test data. `vehicle.ts` holds the zod vehicle schema; `vehicle-images.ts` sizes provider photos.

**Leads** (`src/app/api/leads/route.ts`): validates origin, content type, size, per-IP rate limit, then `leadSchema` (`lib/leads.ts`, includes honeypot `website` field and consent), then delivers as ADF XML (`adf.ts`) by emailing it through the Resend HTTP API (`adf-delivery.ts`, config from `RESEND_API_KEY` / `RESEND_FROM` / `ADF_LEAD_TO`). Design rule: if delivery isn't configured the form fails honestly and points to phone/email — never silently store or fake-acknowledge a lead. Credit applications bypass this: `/financing/apply` embeds dealr.cloud's iframe directly.

**Styling/media**: plain CSS split across `src/app/globals.css` (design tokens), `editorial.css` (film/instrument layouts), `atmosphere.css` (interior films), `services.css`. Public contact info is in `src/lib/site.ts`; video slots in `src/lib/media.ts`. GSAP drives scene motion (`motion.tsx`, `film.tsx`, `use-film-playback.ts`).

Env vars are documented in `.env.example`; never expose database, AWS, cron or lead-relay secrets via `NEXT_PUBLIC_`. Further detail lives in `docs/` (INTEGRATIONS, DEALR-INVENTORY, DEPLOYMENT, VERIFICATION).
