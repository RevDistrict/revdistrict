# Hosting

**Update:** the site is planned for Vercel with a Neon Postgres database; Namecheap remains the domain registrar and DNS host. The hourly inventory import is a Vercel Cron job (`vercel.json`, `/api/cron/inventory` at :15), which requires a Pro plan. See [the inventory handoff](DEALR-INVENTORY.md) for the environment variables, including `DATABASE_URL`, `CRON_SECRET`, `S3_*`, `AWS_*` (set `AWS_REGION` explicitly) and `DEALR_DEALER_ID`.

The Namecheap/cPanel notes below are a fallback only. A cPanel host can run `server.cjs`, but it has no Vercel Cron: schedule `npm run inventory:import` with the host's cron and keep `tsx` installed (`npm ci`).

The owners' screenshot says Namecheap is their **domain host** and dealr.cloud currently runs the website. That establishes the registrar, not a web-hosting plan.

This app requires a supported Node.js runtime. It is not a static HTML export: live inventory and lead delivery run on the server. Use Node 24 LTS (the locked Next.js release requires at least Node 20.9). Check the installed Next.js package's engine requirements when changing framework versions.

Namecheap documents custom Next.js servers under cPanel's **Setup Node.js App**: [Namecheap Next.js deployment guide](https://www.namecheap.com/support/knowledgebase/article.aspx/10686/29/how-to-deploy-reactjs-vitejs-react-native-and-nextjs-applications-in-cpanel/). The article's sample version table is old; use the requirements of the version in this project's lockfile.

## Local development

```sh
npm ci
npm run db:migrate   # DATABASE_URL pointing at a local Postgres
npm run inventory:import -- --input tests/fixtures/dealr-inventory.csv   # see DEALR-INVENTORY.md
npm run dev
```

Open http://localhost:3000. `DATABASE_URL` is required: with no database or no import, inventory pages show the error state. Forms will not claim delivery without configured SMTP delivery.

## Production build

Set production environment variables in the host's secret settings, using `.env.example` as a checklist. Never commit actual values. `SITE_URL` must be the final HTTPS origin (no trailing slash). Keep `SITE_INDEXABLE=false` until the live import and lead flow have been tested.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run start
```

For cPanel Passenger, use the included `server.cjs` as the application startup file and `NODE_ENV=production`. The custom server uses `PORT` from the host. Install dependencies and build in a compatible Linux environment; do not upload macOS native node_modules to Linux. If cPanel's build limits are too low, create the `.next` build on a matching Linux build runner, then deploy it with source configuration and Linux dependencies.

Upload `src/`, `public/`, `.next/`, `package.json`, `package-lock.json`, `next.config.ts`, `server.cjs`, and runtime dependencies. Do not upload private research, conversation screenshots, original source-video archives, local Python environments, test screenshots, or secrets. The `research/` directory is gitignored and never imported by the app.

## Launch sequence

Inventory arrives through the dealership's S3 bucket; follow [the current inventory handoff](DEALR-INVENTORY.md). The supplied dealr.cloud iframe and ADF email adapter are integrated. Configure the host-owned SMTP account before enabling inquiry delivery.

1. Run the S3 import against the production database and validate the authenticated SMTP sender on a staging origin.
2. Verify the supplied dealr.cloud credit iframe at `/financing/apply` on the final domain and confirm a provider-authorized test receipt. Confirm ADF inbox/routing, sender-domain authentication and provider-enforced onward TLS. See `INTEGRATIONS.md` for configuration and remaining checks.
3. Confirm the new domain, business email, logo treatment, phone/hours and legal copy with the dealer.
4. Replace the two temporary video slots if the new films are ready. Review captions and posters.
5. Configure HTTPS, environment variables, trusted proxy headers and shared abuse protection. Disable request-body capture in proxy, server and monitoring logs; verify no lead or financial payloads appear. Confirm encrypted storage and access controls at the provider/relay.
6. Smoke-test home → inventory → vehicle → inquiry, individual/joint applications, consignment/trade/contact/text-back forms, phone/maps, and provider-confirmed CRM/application test receipts. Use approved synthetic test identities and destinations.
7. Point the new domain through Namecheap DNS. This app redirects the `/home`, `/contact`, and `/trade-in` aliases.
8. Enable `SITE_INDEXABLE=true` only with the live import running, then redeploy. Check canonical URLs, sitemap, robots, and structured vehicle data.
9. Monitor cron runs (a failed import keeps old data for up to 72 hours before the site errors) and relay delivery. Ensure sold vehicles disappear and source photo links remain valid.

No DNS changes or public deployment were made during this build.
