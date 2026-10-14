# RevDistrict integrations and launch handoff

The app is a working Next.js build. It is not yet connected to RevDistrict's production DMS or deployed to the dealership domain. No production messages were sent while building it.

**October 14 update:** Adam confirmed full active-inventory CSV exports hourly under the same filename and supplied the credit iframe and ADF destination. The CSV/SFTP importer, provider iframe and ADF email delivery are implemented. Hosting/SFTP access, a populated export, SMTP credentials and provider-confirmed receipts remain outstanding. See [the inventory handoff](DEALR-INVENTORY.md).

## Inventory: keep dealr.cloud as the source of truth

The preview contains 262 vehicles captured from the public dealer site on September 23, 2026, including original photos, prices, mileage, specifications, descriptions and equipment. These are review data, not a live feed. Preview pages label this clearly and are noindex by default. All old vehicle paths resolve through the catch-all route, including slashes and punctuation in trim names.

The source dealer site's body-type filters were used to classify vehicles: 92 cars, 113 SUVs, 35 trucks, 10 vans, and 12 other vehicles. Do not infer classes from model-name substrings. A few source records advertise mileage as zero; these display as mileage on request instead of implying an unused vehicle.

Dealr.cloud documents inventory export feeds and receiving leads from third-party providers. The dealer authorizes feed setup in Manage → Settings → Feeds; custom destinations require coordination with their support team. This is an available integration route, not evidence that a RevDistrict feed is already approved or active.

Sources, checked September 23, 2026:
- [dealr.cloud inventory advertising and feed setup](https://help.dealr.cloud/docs/inventory/advertising/)
- [dealr.cloud inventory details and active/inactive status](https://help.dealr.cloud/docs/inventory/details/)
- [dealr.cloud product FAQ](https://dealr.cloud/product/faq)

### What is implemented

`src/lib/inventory.ts` loads a server-only HTTPS JSON endpoint from `INVENTORY_FEED_URL`, optionally using `INVENTORY_FEED_TOKEN` as a bearer credential. A Zod contract in `src/lib/vehicle.ts` validates it; only active records display. Responses are cached for five minutes. Missing configuration uses the clearly labeled preview. A configured but failed, invalid, or older-than-36-hours feed raises the page's designed error state instead of silently substituting the preview.

**The normalized JSON contract is ours. It is not a claimed dealr.cloud API schema.** `npm run inventory:import` now maps the supplied CSV columns into that contract, reading a local delivery file or downloading through verified SFTP. `INVENTORY_FILE_PATH` lets the site consume the resulting private snapshot without a separate HTTPS adapter service. The existing HTTPS feed remains an alternative. See [the current importer handoff](DEALR-INVENTORY.md) before enabling live imports; only a header-only sample was available. No undocumented private API or marketplace scraper is used.

The feed envelope is:

```json
{
  "capturedAt": "2026-09-23T20:00:00Z",
  "source": "RevDistrict authorized inventory feed",
  "vehicles": []
}
```

Use `vehicleSchema` for every record. Important fields: stable provider ID, legacy slug, VIN, stock, advertised price, mileage, make/model/trim, body type, drivetrain, transmission, engine, colors, ordered HTTPS image URLs, description paragraphs, equipment groups, CARFAX link, canonical source URL, and active/sold/inactive status. IDs and slugs must be mapped consistently from old listings. Do not index the preview as inventory for sale.

### Photo delivery contract

`src/lib/vehicle-images.ts` builds responsive photo widths only for the verified HTTPS `cdn.dealrimages.com` host, preserving all other URL parameters. Other provider image URLs remain unchanged, including signed URLs. The gallery preloads its first image, prepares only the next full photo after load (unless save-data is enabled), and loads small thumbnails lazily. These are presentation changes; the inventory schema, source of truth and feed adapter are unchanged.

Ask the production provider for stable, cacheable HTTPS image URLs and documented resizing behavior. If the final feed uses another CDN, add only its documented transform to the image helper after checking it against a real sample. Do not rewrite arbitrary hosts or signed query strings.

### Dealer/provider handoff, prepared for sending by the project owner

Ask Buddy to arrange the dealr.cloud introduction. The conversation screenshots establish that he offered to help; they are not permission to send messages or use the private phone numbers in those screenshots.

Remaining provider/host requests:
1. A populated export, exact CSV path, DealerID, delivery access and completed-upload convention.
2. Confirmation of photo/option separators, promotional-price precedence and old/new vehicle-ID correspondence.
3. An SMTP account and verified sending address, a safe ADF test destination, and confirmation that each inquiry type reaches the correct dealership workflow.
4. Confirmation that the supplied credit iframe is approved for the final domain, plus a provider-authorized application receipt test and any supported vehicle-prefill parameters.

Validate a price change, one new listing, reordered images, and a sold vehicle in a provider test feed before launch. Agree the sold-vehicle policy: removed records render the noindex not-found page and offer inventory navigation (404 before streaming, or a streamed 200 response). A sold archive/410 response can be added if the dealer wants it.

Scraping Facebook or KSL back into this site is not the recommended architecture. It would make downstream listings the source of truth and add duplication and stale-availability problems. Feed marketplaces outward from dealr.cloud as they do today.

## Leads: ADF email to dealr.cloud

Contact, trade valuation, consignment, text-back, vehicle inquiry and test-drive forms all post to `/api/leads`. The server retains origin/content-type checks, bounded request validation, consent requirements, honeypot and in-process rate limiting. `src/lib/adf.ts` maps every intent to the supplied ADF 1.0 specification. `src/lib/adf-delivery.ts` sends it through authenticated, certificate-verified SMTP using Nodemailer. No lead contents are stored locally or logged.

Adam supplied `dealer-the-used-car-factory@leads.dealrcloud.com` in his [October 14 reply](https://mail.google.com/mail/u/0/#all/1a13c11e7e54cf2d). It is the default destination. `ADF_LEAD_TO` allows a host-controlled, dealer-approved destination or isolated test inbox; visitors cannot choose recipients. Josh noted that the dealership may want particular routing, so confirm the inbox and CRM assignment with them before launch.

Configure `SITE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` in the host's environment. `SMTP_FROM` is a single verified email address whose bounces the dealership monitors. Port 465 uses implicit TLS; other ports require STARTTLS. Certificate verification cannot be disabled by an application setting. Use an SMTP provider that enforces encrypted onward delivery to the lead mailbox; STARTTLS here protects the website-to-SMTP hop. The host must verify that provider's onward TLS policy, storage encryption, retention, access controls and sender-domain SPF/DKIM/DMARC configuration. No provider account is created by this code.

Each message has a generated reference in its Message-ID and ADF prospect ID, a brief text part, and an `application/xml` attachment named `lead.xml`, as specified in the supplied ADF transfer mechanism. The ADF contains contact details, request intent, customer message, separate contact/text consent and requested test-drive date/time. Inquiry vehicle facts (ID, VIN, stock, year/make/model) come from server inventory rather than browser-supplied names. Customer trade/consignment information is identified separately. General inquiries or unavailable inventory leave required vehicle facts empty instead of inventing a vehicle; confirm those messages import correctly with dealr.cloud. Consignment is a selling consultation, not a signed agreement; text-back requests preserve SMS consent but do not send an SMS automatically.

Missing or invalid SMTP configuration returns 503 and offers the existing phone/email. A positive response is returned only after SMTP accepts the message. SMTP acceptance is not proof of CRM ingestion; bounces and provider-confirmed receipts must be checked during handoff. Rejection or timeout returns an unconfirmed-delivery response and reference; there are no automatic retries. Remove obsolete `LEAD_WEBHOOK_URL` / `LEAD_WEBHOOK_TOKEN` configuration.

Before production, configure trusted proxy headers and shared edge/WAF abuse protection. The in-process limiter does not coordinate replicas. Keep request-body capture disabled in hosting and monitoring. No financial application data belongs in these general inquiry forms. The public business contact email remains unchanged.

## Financing: provider-hosted credit application

The existing `/financing/apply` route embeds Adam's supplied `https://staging.dealr.website/39984`, titled **Credit Application**, with a responsive frame and direct new-tab fallback. Despite its hostname, this is the exact provider-supplied URL; do not guess a production replacement. Confirm allowed domains and final URL with dealr.cloud before launch. `/apply` and `/credit-application` continue redirecting to the existing route.

Vehicle-page links retain `?entry_id=<provider ID>` for context on our page. Because no vehicle-prefill API was supplied, the page tells the visitor which vehicle to choose inside the provider application. It does not append undocumented query parameters or claim automatic vehicle association. The application continues to work when inventory is unavailable.

The custom credit form, financial schema/configuration and relay have been removed. `POST /api/finance` returns 410 without reading or forwarding a body, protecting old clients from using the retired flow. Remove old `FINANCE_APPLICATION_ENABLED`, `FINANCE_WEBHOOK_URL` and `FINANCE_WEBHOOK_TOKEN` settings. The provider iframe owns collection, validation, authorizations and delivery; this website's API receives no application fields. `/financing/terms` directs visitors to the provider's current disclosures, and `/privacy-policy` describes this arrangement. The page remains noindex, no-store and no-referrer. The calculator remains browser-only.

No real application or lead was submitted during development. `npm run test:integrations` uses a local HTTPS inventory feed and authenticated STARTTLS SMTP fixture, and intercepts the provider frame with local test content. Provider receipt and its own form's accessibility/behavior require separate authorized checks.

## Video replacement

Two independent slots live in `src/lib/media.ts`. Change `src`, `poster`, title and caption there. The home and story pages share the welcome slot; the story page adds the second slot. Supplied media is hosted locally, opt-in, and has native playback controls. No third-party social embeds, autoplay audio, or social feeds are needed.

- Welcome slot: the supplied Instagram showroom tour, compressed for web, with its original burned-in speech captions retained.
- Story slot: a short silent behind-the-scenes excerpt from the supplied YouTube video.

For future spoken replacements, provide accurate captions (WebVTT via `<track>` or burned captions) and a transcript. Do not use the old clip's captions for new footage.

## Contact and privacy

Address, phone, email and opening hours were verified against the current dealership contact page. The privacy page covers the implemented data paths rather than copying assertions about systems that are not connected. The dealer should review its policy and actual providers before launch.

## Decorative background films

The header/background films are separate from listing photos and the two opt-in owner slots. `AmbientFilm` supplies local posters, muted loops and explicit pause controls for Sell / Trade, Financing, Inventory, Contact and The District. They have no dependency on the DMS. Their sources and rebuild script are recorded in `CONTENT-AND-SOURCES.md` and `VISUAL-REFINEMENT.md`.
