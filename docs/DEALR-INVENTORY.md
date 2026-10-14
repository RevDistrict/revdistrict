# dealr.cloud inventory handoff — October 14, 2026

Josh asked for the CSV inventory integration to be built while the dealership arranges SFTP. The existing Next.js inventory browser and vehicle pages now read the importer's normalized snapshot. No live connection, hosting account, DNS change, lead delivery, or credit application has been enabled.

## What the conversation establishes

- The dealership will host/deploy the website and provide the FTP/SFTP destination. dealr.cloud sends inventory files to that destination; it is not offering a server for us to pull from.
- Adam at dealr.cloud confirmed standard CSV delivery, hourly by default. His `Generic-CSV-Sample.csv` contains **58 column names and one entirely empty row**, not a populated vehicle example. The exact supplied file is preserved as `tests/fixtures/dealr-schema.csv`.
- Josh's latest email asks whether exports contain the entire inventory or only changes, and whether each export overwrites one filename. Those questions remain unanswered in the thread reviewed.
- The credit application is a separate provider iframe. General contact/inquiry forms need the dealership's ADF lead forwarding details. Neither has been supplied yet. The native financial relay already in this repo is not the integration Adam proposed; keep it disabled while obtaining the iframe.

Sources: [Josh's Slack request](https://agentboostmarketing.slack.com/archives/C0C9UNS3A1W/p1792005605437029), [Adam's clarification](https://mail.google.com/mail/u/0/#all/1a13b895bb58bccb), [Josh's latest email](https://mail.google.com/mail/u/0/#all/1a13bd83de987bc4).

## Review locally

The populated fixture contains two fictional vehicles with existing public dealer photo URLs. It is test data, not the dealership's current stock.

```sh
SITE_URL=https://dealer.example DEALR_DEALER_ID=demo-dealer \
  npm run inventory:import -- --input tests/fixtures/dealr-inventory.csv \
  --output /tmp/revdistrict-inventory-demo.json --preview
INVENTORY_FILE_PATH=/tmp/revdistrict-inventory-demo.json npm run dev
```

Open http://localhost:3000/inventory, then the Acura demo listing. Verify the preview notice, photos, price, mileage and specifications. The Toyota example exercises missing photos and unknown price/mileage. The importer persists the preview flag in JSON, so preview records do not become active stock when the website reads them. Keep `SITE_INDEXABLE=false` for review.

## Production connection

The host must support the project's Node.js version, persistent private storage, a scheduled job, and outbound SFTP (unless CSVs arrive on the same filesystem). The job uses `tsx`; retain this dependency on the worker (`npm ci`, not `npm ci --omit=dev`). Credentials belong in host-managed environment variables, never source or messages. The CLI reads the process environment; it does not automatically load `.env.local`.

1. Get a populated export and confirm **complete current active inventory** and how sold/deleted vehicles disappear. Only then set `DEALR_FEED_MODE=full`. Delta feeds are deliberately rejected; they need a documented deletion/status contract before adding merge behavior.
2. Set `SITE_URL` to the final HTTPS origin, `DEALR_DEALER_ID` to the expected CSV DealerID, and `INVENTORY_FILE_PATH` to an absolute private snapshot path outside `public/` and the deployed web root. Create the parent directory first and allow only the import worker/web process to access it. Use encrypted storage offered by the host. Configure either this path or `INVENTORY_FEED_URL`, not both.
3. Set `DEALR_SFTP_HOST`, `DEALR_SFTP_PORT`, `DEALR_SFTP_USERNAME` and the exact completed CSV `DEALR_SFTP_PATH`. Authenticate with `DEALR_SFTP_PASSWORD` or `DEALR_SFTP_PRIVATE_KEY_PATH` (optional `DEALR_SFTP_PASSPHRASE`). Give our reader read-only access to this feed; dealr.cloud needs its separate delivery access.
4. Obtain the server's SHA256 **hex** host-key fingerprint independently from the server owner and set `DEALR_SFTP_HOST_SHA256`. Unknown/mismatched host keys are rejected. Do not blindly trust the first connection.
5. Run `npm run inventory:import`, then schedule the same command after each hourly upload. If the CSV arrives on the website host, use `npm run inventory:import -- --input /private/feed/inventory.csv` instead. The scheduler must load the same environment and report nonzero exits.
6. Ask the sender to upload to a temporary name and rename after completion. The importer checks size and modification time before/after reads, but that cannot prove a paused partial upload is complete. A new filename every hour needs an agreed way of identifying the latest **completed** export; no guessed wildcard/newest-file selection is implemented.

The importer validates the whole file before atomically replacing the snapshot. Concurrent jobs are excluded by an adjacent `.lock` file. Failed imports retain the previous snapshot and return a nonzero exit. After a machine/process crash, remove a leftover lock only after verifying no import is running. Regular errors release it automatically.

The snapshot's `capturedAt` uses the source file's modification time, not the import time or a vehicle's `LastModifiedDate`. Repeatedly reading an old file therefore does not make it fresh. Confirm the sender updates file modification time on each complete export. Data older than 36 hours (or over five minutes in the future) fails; the existing page error state appears once the last good live snapshot ages out. The website reads the private snapshot at request time, so successful imports require no rebuild/restart. Each website replica must read the same snapshot or receive an atomic copy.

## Mapping and remaining assumptions

- `VehicleID` is the stable identity. URLs use year/make/model/trim plus that ID. Known preview IDs with matching VINs preserve their legacy slug, including nested trim segments. The existing detail route redirects a changed slug for the same ID. Confirm production `VehicleID` matches the old website's IDs; different IDs need an explicit redirect map.
- `ListPrice` is the displayed price. `SpecialPrice`, `SpecialPrice1/2`, `CostPrice` and `WholesalePrice` do not override it. Confirm promotional pricing rules before changing this. Internal cost/wholesale/dealer contact fields are never written into the public vehicle model.
- `PhotoURL` supports one HTTPS URL or pipe/newline-separated HTTPS URLs in supplied order. No comma splitting or URL rewriting occurs. Confirm separators using a populated row. `OptionDescription` uses pipe/newline separation under a single Features group; confirm that format too.
- Body categories come from `BodyType`/`BodyStyle`, never model-name guesses. Unknown values remain Other. Blank price/mileage stay unknown in the existing UI. Blank photos use the existing placeholder.
- Dealer comments become plain text. CARFAX is omitted because the sample has no confirmed CARFAX column. Extra fields are not interpreted without a specification.
- Missing/duplicate IDs, duplicate VINs, wrong DealerID, malformed numbers/CSV, non-HTTPS photos and oversized files reject the whole import. Limits are 10 MB and 1,000 vehicles. Empty/schema-only files are rejected to avoid wiping stock; a genuine zero-stock export needs an agreed explicit empty-inventory policy.
- A confirmed full export replaces the inventory. Missing vehicles disappear and their detail pages show the noindex not-found state. Next.js returns 404 before streaming, or 200 with the not-found state once streaming has begun. There is no sold/status field in the supplied header, so this behavior depends on the provider confirming active-only full snapshots.

## What the team still needs

**Dealership / Omar:** hosting plan, server owner, SFTP destination, secure access for dealr.cloud delivery and our reader, and final production domain.

**dealr.cloud / Josh:** populated CSV, exact filename/directory, full-versus-delta and sold handling, completed-upload convention, photo/option separators, promotional-price precedence, old/new ID correspondence, credit iframe code and allowed domains, and ADF address/format plus a safe test destination.

Before launch, verify new listing, price change, photo reorder, removal of a sold listing, rejected/partial file, stale-feed failure and recovery against the provider's real test export. Local fixtures do not establish a live provider connection.

The October 14 dependency audit also reported eight high-severity package findings in existing Next.js, Sharp, source-map-js and the ESLint/braces chain. The new CSV/SFTP packages had no audit findings. These existing findings require a separate security update/review before deployment; no security exception or production approval has been granted.
