# dealr.cloud inventory handoff — October 14, 2026

Josh asked for the CSV inventory integration to be built while the dealership arranges SFTP. **Update:** dealr.cloud delivers through AWS Transfer Family into an S3 bucket the dealership owns. The importer now reads that bucket with the AWS SDK and upserts vehicles into Postgres (Neon in production); the inventory browser and vehicle pages read from the database. Vehicles missing from the latest CSV are deleted. The older SFTP and snapshot-file text below is superseded by the production steps in this section. No live connection, hosting account, DNS change or SMTP delivery has been configured. The supplied credit iframe and ADF email adapter are integrated; see `INTEGRATIONS.md`.

## What the conversation establishes

- The dealership will host/deploy the website and provide the FTP/SFTP destination. dealr.cloud sends inventory files to that destination; it is not offering a server for us to pull from.
- Adam at dealr.cloud confirmed standard CSV delivery, hourly by default. His `Generic-CSV-Sample.csv` contains **58 column names and one entirely empty row**, not a populated vehicle example. The exact supplied file is preserved as `tests/fixtures/dealr-schema.csv`.
- Adam’s latest reply confirms each export includes all currently Active vehicles and sends the same filename hourly. The server owner decides whether to archive old uploads or replace the stored file.
- The supplied credit iframe is `https://staging.dealr.website/39984`. The supplied ADF inbox is `dealer-the-used-car-factory@leads.dealrcloud.com`, with an ADF 1.0 spec and example. Both are now implemented in the website.

Sources: [Josh's Slack request](https://agentboostmarketing.slack.com/archives/C0C9UNS3A1W/p1792005605437029), [Adam's clarification](https://mail.google.com/mail/u/0/#all/1a13b895bb58bccb), [Adam's latest confirmation](https://mail.google.com/mail/u/0/#all/1a13c11e7e54cf2d).

## Review locally

The populated fixture contains two fictional vehicles with existing public dealer photo URLs. It is test data, not the dealership's current stock.

```sh
npm run db:migrate   # needs DATABASE_URL, e.g. postgres://localhost/revdistrict
SITE_URL=https://dealer.example DEALR_DEALER_ID=demo-dealer \
  npm run inventory:import -- --input tests/fixtures/dealr-inventory.csv --preview
npm run dev
```

Open http://localhost:3000/inventory, then the Acura demo listing. Verify the preview notice, photos, price, mileage and specifications. The Toyota example exercises missing photos and unknown price/mileage. The importer persists the preview flag in JSON, so preview records do not become active stock when the website reads them. Keep `SITE_INDEXABLE=false` for review.

## Production connection

The host must support the project's Node.js version, a scheduled job, and outbound HTTPS to S3 and Postgres. The job uses `tsx`; retain this dependency on the worker (`npm ci`, not `npm ci --omit=dev`). Credentials belong in host-managed environment variables, never source or messages. The CLI reads the process environment; it does not automatically load `.env.local`.

1. Set `DEALR_FEED_MODE=full` (complete active-inventory exports; delta feeds are unsupported), `SITE_URL` (final HTTPS origin) and `DEALR_DEALER_ID` (expected CSV DealerID).
2. Set `DATABASE_URL` and run `npm run db:migrate` once (idempotent).
3. Set `S3_BUCKET_NAME`, `S3_INVENTORY_KEY` (find the key with `node --env-file=.env.local --import tsx scripts/list-s3-inventory.ts`), `AWS_REGION`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. The IAM user needs only `s3:GetObject` and `s3:ListBucket` on the bucket.
4. Schedule `npm run inventory:import` hourly after each upload; the scheduler must load the same environment and report nonzero exits.

The importer validates the whole file, then upserts and deletes in one transaction under an advisory lock. Failed imports leave the previous inventory in place and exit nonzero. `capturedAt` is the S3 object's `LastModified`; data older than 72 hours (or over five minutes in the future) is rejected, and the site shows its error state once the last good import ages out. The website reads the database per request, so imports need no rebuild or restart.

## Mapping and remaining assumptions

- `VehicleID` is the stable identity. URLs use year/make/model/trim plus that ID. Known preview IDs with matching VINs preserve their legacy slug, including nested trim segments. The existing detail route redirects a changed slug for the same ID. Confirm production `VehicleID` matches the old website's IDs; different IDs need an explicit redirect map.
- `ListPrice` is the displayed price. `SpecialPrice`, `SpecialPrice1/2`, `CostPrice` and `WholesalePrice` do not override it. Confirm promotional pricing rules before changing this. Internal cost/wholesale/dealer contact fields are never written into the public vehicle model.
- `PhotoURL` supports one HTTPS URL or pipe/newline-separated HTTPS URLs in supplied order. No comma splitting or URL rewriting occurs. Confirm separators using a populated row. `OptionDescription` uses pipe/newline separation under a single Features group; confirm that format too.
- Body categories come from `BodyType`/`BodyStyle`, never model-name guesses. Unknown values remain Other. Blank price/mileage stay unknown in the existing UI. Blank photos use the existing placeholder.
- Dealer comments become plain text. CARFAX is omitted because the sample has no confirmed CARFAX column. Extra fields are not interpreted without a specification.
- Missing/duplicate IDs, duplicate VINs, wrong DealerID, malformed numbers/CSV, non-HTTPS photos and oversized files reject the whole import. Limits are 10 MB and 1,000 vehicles. Empty/schema-only files are rejected to avoid wiping stock; a genuine zero-stock export needs an agreed explicit empty-inventory policy.
- A confirmed full export replaces the inventory. Missing vehicles disappear and their detail pages show the noindex not-found state. Next.js returns 404 before streaming, or 200 with the not-found state once streaming has begun. There is no sold/status field in the supplied header, and Adam confirmed that the file contains only Active vehicles.

## What the team still needs

**Dealership / Omar:** hosting plan, server owner, SFTP destination, secure access for dealr.cloud delivery and our reader, and final production domain.

**dealr.cloud / Josh:** populated CSV, exact filename/directory, a sold-vehicle test, completed-upload convention, photo/option separators, promotional-price precedence, old/new ID correspondence, credit iframe allowed domains/prefill support, SMTP sender configuration and a safe ADF test destination with confirmed CRM routing.

Before launch, verify new listing, price change, photo reorder, removal of a sold listing, rejected/partial file, stale-feed failure and recovery against the provider's real test export. Local fixtures do not establish a live provider connection.

The available dependency security patches are applied. The production dependency audit is clean, but the full audit still flags the development-only ESLint/braces chain (one unpatched advisory across five packages). CI retains that failure and no security exception has been granted. See `VERIFICATION.md`.
