# dealr.cloud inventory handoff

dealr.cloud delivers an hourly full-inventory CSV through AWS Transfer Family into an S3 bucket the dealership owns. A scheduled import reads that object with the AWS SDK and syncs it into Postgres (Neon in production); the inventory browser and vehicle pages read only from the database. A vehicle missing from the latest CSV is deleted and disappears from the site. There is no SFTP client, no snapshot file and no placeholder inventory: if `RD_DATABASE_URL` is missing or nothing has been imported, inventory pages show the error state. The supplied credit iframe and ADF email adapter are integrated; see `INTEGRATIONS.md`.

## What the conversation establishes

- dealr.cloud sends inventory files to a destination the dealership owns (AWS Transfer Family backed by an S3 bucket). We read that bucket directly with an IAM key; we do not pull from a dealr.cloud server.
- Adam at dealr.cloud confirmed standard CSV delivery, hourly by default. His `Generic-CSV-Sample.csv` contains **58 column names and one entirely empty row**, not a populated vehicle example. The exact supplied file is preserved as `tests/fixtures/dealr-schema.csv`.
- Adam’s latest reply confirms each export includes all currently Active vehicles and sends the same filename hourly. The server owner decides whether to archive old uploads or replace the stored file.
- The supplied credit iframe is `https://staging.dealr.website/39984`, the default for `CREDIT_APPLICATION_URL`; set that variable to the production URL when dealr.cloud supplies it. The supplied ADF inbox is `dealer-the-used-car-factory@leads.dealrcloud.com`, with an ADF 1.0 spec and example. Both are now implemented in the website.

Sources: [Josh's Slack request](https://agentboostmarketing.slack.com/archives/C0C9UNS3A1W/p1792005605437029), [Adam's clarification](https://mail.google.com/mail/u/0/#all/1a13b895bb58bccb), [Adam's latest confirmation](https://mail.google.com/mail/u/0/#all/1a13c11e7e54cf2d).

## Review locally

Against a local Postgres, import the fictional two-vehicle fixture (test data, not the dealership's stock) or the real S3 object:

```sh
npm run db:migrate   # needs RD_DATABASE_URL, e.g. postgres://localhost/revdistrict
DEALR_FEED_MODE=full SITE_URL=https://dealer.example DEALR_DEALER_ID=demo-dealer \
  npm run inventory:import -- --input tests/fixtures/dealr-inventory.csv
npm run dev
```

Drop `--input` to download the S3 object instead (needs `S3_*`, `AWS_*` and the live `DEALR_DEALER_ID`, which is `452833`). The CLI reads the process environment; Node loads `.env` with `node --env-file=.env`. Open http://localhost:3000/inventory. Keep `SITE_INDEXABLE=false` for review.

## Production connection

Production runs on Vercel with a Neon Postgres database. `vercel.json` schedules `GET /api/cron/inventory` at 15 minutes past every hour. Vercel sends `Authorization: Bearer $CRON_SECRET`; the route returns 401 for anything else, and for everyone if `CRON_SECRET` is unset. Hourly crons need a Vercel Pro plan: Hobby is limited to one run per day and rejects an hourly schedule at deploy time. Vercel Cron sends a GET to the production deployment, does not follow redirects (so the production domain must not redirect `/api/cron/inventory`), does not retry a failed run, and may occasionally deliver a run twice; the import is idempotent and locked, so duplicates are harmless.

1. Set `RD_DATABASE_URL` to Neon's pooled connection string (the `-pooler` host; Neon recommends it for serverless functions), and optionally `RD_DATABASE_URL_UNPOOLED` to the direct string, which the migration uses when set (Neon recommends direct connections for schema changes). The import's transaction-level advisory lock is supported by Neon's transaction-mode pooler; session-level locks are not. Production Vercel builds apply `db/schema.sql` automatically (`scripts/vercel-build.mjs` runs `scripts/migrate.ts`, which is idempotent); locally run `npm run db:migrate`.
2. Set `CRON_SECRET` to a long random value.
3. Set `DEALR_FEED_MODE=full` (complete active-inventory exports; delta feeds are unsupported), `SITE_URL` (final HTTPS origin) and `DEALR_DEALER_ID=452833` (the CSV's DealerID).
4. Set `S3_BUCKET_NAME`, `S3_INVENTORY_KEY` (`FruitStand/theusedcarfactoryinventory.csv`; the bucket also holds a stray `FruitStandtheusedcarfactoryinventory.csv` and `FruitStand/hello.txt` that must not be used), `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. Set `AWS_REGION` explicitly to the bucket region (`us-east-2`); Vercel presets it to the function region. The IAM user needs only `s3:GetObject` on the object and `s3:ListBucket` on the bucket.
5. `vercel.json` sets `buildCommand` to `scripts/vercel-build.mjs`, which runs `scripts/check-env.mjs` first. On a production build (`VERCEL_ENV=production`) it fails if any of the variables above is missing, `DEALR_FEED_MODE` is not `full` or `SITE_URL` is not https. Other environments are not checked. The Resend variables are not checked because inquiry forms fail honestly without them.
6. Set `EMERGENCY_EMAIL`. When the cron route fails (download, CSV validation or database save), it emails that address through Resend with the failing stage and a safe detail (our own validation messages such as the CSV row and field; for S3 and database errors only the error name and code). It sends at most one alert per stage per hour, and skips quietly (logging only) if Resend is not configured. The route still returns 500 and the previous inventory stays live. A cron run that never starts sends nothing, so also watch Vercel's cron logs.

The same code runs from a terminal with `npm run inventory:import` (needs `tsx`, so install with `npm ci`, not `--omit=dev`) for manual runs or a host crontab.

The import validates the whole file, then upserts every vehicle and deletes any the CSV no longer lists in one transaction under an advisory lock. A failed import leaves the previous inventory in place. `captured_at` is the S3 object's `LastModified`; a file older than 72 hours (or over five minutes in the future) is rejected, and the site shows its error state once the last good import is older than 72 hours. The site reads the database per request, so imports need no rebuild or redeploy.

## Mapping and remaining assumptions

- `VehicleID` is the stable identity. URLs use year/make/model/trim plus that ID. Vehicles whose ID and VIN match the old site (`src/data/legacy-vehicles.json`, kept only as legacy slug data) preserve their legacy slug, including nested trim segments. The existing detail route redirects a changed slug for the same ID. Confirm production `VehicleID` matches the old website's IDs; different IDs need an explicit redirect map.
- `ListPrice` is the displayed price. `SpecialPrice`, `SpecialPrice1/2`, `CostPrice` and `WholesalePrice` do not override it. Confirm promotional pricing rules before changing this. Internal cost/wholesale/dealer contact fields are never written into the public vehicle model.
- `PhotoURL` supports one HTTPS URL or pipe/newline-separated HTTPS URLs in supplied order. No comma splitting or URL rewriting occurs. Confirm separators using a populated row. `OptionDescription` is split on pipes, newlines, and on commas that precede a new `Label: value` entry (the live export joins options that way), under a single Features group.
- Body categories come from `BodyType`/`BodyStyle`, never model-name guesses. Unknown values remain Other. Blank price/mileage stay unknown in the existing UI. Blank photos use the existing placeholder.
- Dealer comments become plain text. CARFAX is omitted because the sample has no confirmed CARFAX column. Extra fields are not interpreted without a specification.
- Missing/duplicate IDs, duplicate VINs, wrong DealerID, malformed numbers/CSV, non-HTTPS photos and oversized files reject the whole import. Limits are 10 MB and 1,000 vehicles. Empty/schema-only files are rejected to avoid wiping stock; a genuine zero-stock export needs an agreed explicit empty-inventory policy.
- A full export replaces the inventory. Missing vehicles are deleted and their detail pages show the noindex not-found state (404 before streaming, or 200 with the not-found state once streaming has begun). There is no sold/status column in the live file (all `IsNew`, certified and spare price/field columns are constant or empty), and Adam confirmed the file contains only Active vehicles, so a sold car is treated as removed. There is no sold display.

## What the team still needs

**dealr.cloud / Josh:** a sold-vehicle test (confirm a sold car leaves the export), completed-upload convention, promotional-price precedence, old/new ID correspondence, credit iframe allowed domains/prefill support, a safe ADF test destination (and confirmation that Resend-sent mail reaches it) with confirmed CRM routing.

**Dealership / Omar:** the production domain and the Vercel project.

Before launch, verify new listing, price change, photo reorder, removal of a sold listing, rejected/partial file, stale-file failure and recovery against the real export. Local fixtures do not establish a live provider connection. One bad row rejects the whole import by design, so a single malformed vehicle keeps the previous inventory until it is fixed; alert on failed cron runs.
