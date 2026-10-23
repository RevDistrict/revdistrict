# Verification and review handoff

## October 23 inventory move to S3 and Postgres

Inventory now comes from the dealership's S3 bucket into Postgres on an hourly Vercel cron, replacing the SFTP importer and JSON snapshot below (those sections are historical). Checks: TypeScript, lint, formatting, build, 19 unit tests, `npm run test:inventory` (fake S3, throwaway Postgres, the authenticated cron route, stale-file and missing-object retention, removal) and `npm audit` (zero vulnerabilities after updating Next.js to 16.4.3 and zod). A real import of the live 271-vehicle CSV into a local database succeeded. `npm run test:integrations` intermittently fails an axe color-contrast check on the animated "FINDING YOUR NEXT DRIVE" label, also on the previous commit and Next.js version; it is not caused by this change and is unresolved. Not yet verified: the Vercel deployment and cron, Neon SSL, and a production run with the real IAM key.

## October 14 latest provider email: iframe and ADF

Read all nine messages in the **New Website & FTP Feed** thread, including [Adam’s 20:19 UTC reply](https://mail.google.com/mail/u/0/#all/1a13c11e7e54cf2d), and the supplied ADF example/specification. `/financing/apply` now embeds his exact credit-application URL. The old native credit collection/relay was removed; its endpoint returns 410. All six inquiry types share the new authenticated TLS SMTP/ADF adapter and the supplied dealership destination. Inventory setup now records confirmed full Active exports hourly with the same filename. Configuration and outstanding host/provider checks are in `INTEGRATIONS.md`.

Validation passed: TypeScript, lint, formatting, production build, 19 unit/domain tests, the local SFTP inventory suite and the updated HTTPS/SMTP/browser integration suite. All 24 website browser tests passed, including automated accessibility checks on the site-owned pages. Tests intercept the credit provider; they do not audit the provider’s form or send live leads/applications. The actual provider iframe was separately loaded and visually inspected in Chrome at desktop width and 390px, with its fields empty. It rendered inside the site at both sizes. No financial application was entered or submitted.

The fresh reviewer found the mapping/delivery split appropriately small. Its SMTP finding was reproduced: without `forceAuth`, an AUTH-less TLS relay accepted a lead (201) when the test expected rejection (502). Authentication is now forced and that regression passes. The reviewer’s other suggestions—use the existing color token and skip inventory loading when there is no selected vehicle—were applied.

The production audit reports zero vulnerabilities. The full audit still reports the existing unpatched development-only braces advisory across five packages; the CI audit remains unchanged. Live email delivery is not configured: the host must provide SMTP credentials and a verified sender, confirm onward TLS and mailbox routing, and verify dealr.cloud receives each inquiry type. SFTP access and a populated real export are also still outstanding. No DNS change or deployment occurred.

Review locally at http://localhost:3006/financing/apply while the preview server is running, or run `npm run dev` and use http://localhost:3000/financing/apply. Open a vehicle’s financing link to check its context, inspect the provider form and new-tab fallback on desktop/phone, then review contact, inquiry/test-drive, trade, consignment and text-back forms. Do not submit a live credit application as a routine development check.

## October 14 security-audit follow-up

[GitHub run 38629393404](https://github.com/xianwilliams/revdistrict/actions/runs/38629393404) passed formatting, types, lint, unit tests, the production build and both integration suites. Its only failed step was `npm audit --audit-level=high`.

Updated Next.js and its ESLint configuration from 16.3.6 to 16.3.8, sharp from 0.35.4 to 0.35.5, and source-map-js from 1.2.1 to 1.2.2. The production audit (`npm audit --omit=dev --audit-level=high`) now reports zero vulnerabilities. Formatting, lint, TypeScript, all 19 unit tests, the production build, local SFTP inventory checks and the HTTPS/browser integration suite pass with these versions. This patch changes dependency versions only; the fresh-agent simplicity review was skipped for that contained change. No new manual visual review was performed.

The full audit still fails on [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): the development-only chain `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. npm counts the one underlying advisory across five affected packages. No patched braces version is published. npm's proposed fix downgrades the Next.js lint configuration to 14.2.35; that is not a compatible maintenance update for this Next.js 16 project. The existing lint configuration does not accept external root-directory glob patterns. CI retains the full audit and its failure threshold, no security exception was granted, and the remaining finding is still a launch blocker.

## October 14 CSV/SFTP integration

The supplied dealr.cloud file has 58 headers and no populated vehicles. The importer was checked using two synthetic rows with those headers. Nineteen unit/domain tests, TypeScript, ESLint, formatting and the production build passed. `npm run test:inventory` verifies the actual importer against a temporary local SFTP server, including host-key rejection, stale-file rejection, stalled shutdown/lock cleanup, private snapshot loading, price updates without rebuilding, slug redirects, removal and preview labeling. It is included in CI after the build. Unit tests used `node --import tsx --test tests/*.test.ts` because the sandbox blocks the tsx CLI's IPC socket.

The compiled site was opened in Chrome at http://localhost:3005/inventory. The two imported vehicles, preview banner, Acura detail specifications, ordered gallery and canonical redirect were checked; the main vehicle image was visually inspected. This was a data integration review, not a new full-site responsive/accessibility audit. The existing full browser and financial-relay suites were not rerun for this change.

The fresh-agent simplicity review found the adapter/CLI/file-reader split appropriate. Its two findings—valid image proxy URLs being rejected and potentially unbounded SFTP shutdown—were fixed and covered by regression checks. The production SFTP connection remains untested because credentials and a populated provider export have not arrived. Eight high-severity findings in existing dependencies were recorded as a launch blocker; no exception was granted and no deployment occurred. See [the current handoff and review commands](DEALR-INVENTORY.md).

## Previous review environment

The September 29 revision was checked against the compiled Next.js application through `server.cjs` at http://localhost:3001. Normal development uses `npm run dev` at http://localhost:3000.

## September 29 website revision

Review at **http://localhost:3001** (production build); development remains at **http://localhost:3000**. Home now presents the three service links inside the video hero, with the duplicated service section removed. The original colored PNG bridges the navigation and hero; the footer and District page use the same source. The gauge quantity is removed and the inventory stage is more compact. The inventory sidebar follows max price → make → model → body style → max mileage, with multiple makes/models applied together on Search. README documents account-free local saved vehicles.

The District logo uses the unchanged original PNG in SVG layers, with only the needle rotating as scroll position changes. Its stationary mask clears the needle’s highlight and shadow; its tighter moving clip avoids lifting an adjacent gauge tick. Reduced motion restores the original orientation. Final stills, mobile filters, and forward/reverse needle states are in ignored `research/client-review/`. Home, inventory and District were inspected at 1440px, 390px and 360px with no horizontal overflow. Normal-motion needle captures showed no JavaScript errors; reversal returned to the same angle.

The fresh-agent review found two draft-reset defects: sorting remounted unsubmitted filters, and reset left unsubmitted text in the search box. Both have regression coverage. Visual review also reproduced an existing GSAP hydration race. Motion now mounts at the end of each applicable page’s hydration boundary, and collects reveal targets without writing HTML attributes. Normal and reduced-motion hydration tests pass. The reviewer confirmed that a shared template would remain outside Next’s loading boundary and would not reliably solve this race; the page-local component is the smaller reliable approach.

Validation: production build, TypeScript, ESLint, formatting and 13 domain tests passed. All 23 browser checks passed in the final production suite, including automated WCAG checks on eleven routes. One development-only finance cache-header mismatch passes under the production server. One existing phone-layout test needed an explicit visible-content wait before measuring a streamed page. Domain tests were invoked with `node --import tsx --test tests/*.test.ts` because the sandbox blocks the tsx CLI’s IPC socket. No test sends live dealership leads. Real phone hardware and human visual approval remain outside these automated checks.

## Earlier completed checks (September 24)

| Check | Result |
|---|---|
| TypeScript, ESLint, Prettier | Passed |
| Production build and custom-server startup | Passed |
| Dependency audit | 0 reported vulnerabilities |
| Domain tests | 13 passed: original 7 plus individual/joint application validation, two-year history, conditional trade data, consent, inactive data stripping, consignment and text intents |
| Browser tests | 18 passed: original 14 journeys plus homepage priorities/internal application links, safe unconfigured application, consignment/text submissions, and stacked phone service headings |
| Accessibility scan | Zero Axe WCAG 2 A/AA and 2.1 AA violations across ten routes, including the four new pages; zero violations on all five enabled joint-application steps in the isolated fixture |
| HTTPS integration fixtures | Passed: authenticated feed and leads, plus authenticated financial delivery, durable receipt, rejected/cross-origin/oversize/honeypot requests, sensitive error redaction, native POST fallback without JavaScript, and a complete joint application in Chromium |
| Responsive route captures | 42 page/viewport combinations returned 200 with no horizontal overflow, page JavaScript errors or broken loaded images |
| Motion captures | Original 51 home and 30 interior states, plus 9 new client-feedback states across desktop, touch-emulated phone and reduced motion; latest states have no overflow or page errors |

Commands and fixtures live in `tests/` and `scripts/`. The local integration fixtures use temporary certificates and synthetic data; they send nothing to the dealership or provider.

## September 24 feedback pass

Homepage priorities now appear before the driving-style selector. The application is native, preserves vehicle selection from car pages, supports individual/joint applicants, conditionally requests prior residence/employment and trade information, and uses a dedicated authenticated delivery contract. The preview blocks financial information entry while that contract is unconfigured. New consignment and text-back requests extend the existing lead form; general contact, valuation and vehicle inquiry remain available. No application links return to the legacy dealership website.

`research/client-feedback/` contains fresh full-page captures for all twelve content routes at 1440×1000, 1366×768 and 390×844, plus six routes at 360×640. Desktop hero/section density, gold, homepage priorities, financing, consignment, application and phone service headings were visually inspected. `motion-results.json` and its nine viewport captures cover the new service section, finance options and consignment process with normal and reduced motion. Icons below the viewport remain unrevealed until reached; reduced motion keeps all content visible.

Regression checks first reproduced the finance header-order override, unsafe native GET fallback when JavaScript is unavailable, and two-column phone service headings. The fixes move the application-specific header after the global rule, provide an explicit POST fallback and no-script guidance, and stack the new phone headings. Automated accessibility scans also caught two links relying on color alone; both now have persistent underlines.

## Visual evidence

Ignored `research/technical-type/` contains the final uppercase Inter complete-page and opening captures at 1440×1000 and 390×844 for all content pages, plus home/inventory/vehicle at 360×640. Images were allowed to decode before captures. `results.json` records response status, overflow, page errors and broken images.

Ignored `research/editorial-motion/` contains six hero scroll positions, four home scenes and seven representative film frames for each of three modes: 1440×1000 standard motion, 390×844 touch emulation and 1440×1000 reduced motion. `results.json` records media, headline, vertical rail and dial transforms, sheen position, and each selected video source and dimensions. Reduced motion leaves the film paused by default and disables the scroll transforms. The static tilted instrument and all controls remain usable.

Final uppercase Inter pixels were inspected for home, inventory, vehicle detail, story, finance, trade and contact, including intermediate hero states and the brightest film cuts. The revision corrected a streamed-layout measurement race affecting gold sheen, unstable SVG rounding during hydration, phone chapter sizing, a team-film caption overlap and a distracting road cut. The text scrim was strengthened behind the desktop headline. Original inventory photography remains factual and varies by listing.

Source cut review and the final replacement road sequence are retained in ignored `research/montage-proof/` and `research/montage-final-proof/`. Both final MP4s are 22 seconds at 24 fps with no audio stream: desktop 1600×800, 5.55 MB; phone 540×720, 1.91 MB. No burned subtitles or graphic titles appear in the hero reel.

## Latest interior and typography evidence

`research/interior-motion/` contains 30 final captures of the new interior sections at 1440×1000 standard motion, 390×844 touch emulation and 390×844 reduced motion. The recorded states cover Financing intro/process/FAQ, Sell / Trade intro/carousel, The District intro/settled logo, Contact intro/details and Inventory intro. All states have no horizontal overflow or JavaScript errors. Drawn icons finish at zero stroke offset; the logo finishes at opacity 1; background films pause when offscreen and default to paused under reduced motion.

The client rejected the previous serif direction. All main headings, film chapters, display captions and vehicle titles now use upright Inter, with uppercase display roles. Bodoni and Manrope are removed from dependencies. The font is self-hosted and preloaded through `next/font/local`; body text stays sentence case and labels retain IBM Plex Mono. The final 19-route capture pass confirmed no broken loaded images, page errors or overflow at desktop, 390px and selected 360px layouts.

## Local loading comparison

The repeatable script is `scripts/performance-review.mjs`. It uses a fresh Chromium context, disabled HTTP cache, 1.6 Mbps download/150 ms latency/4× CPU throttling, a 1440px desktop or 390px DPR2 phone viewport, and reduced motion. It waits for the first photo to decode, then 1.2 seconds, and measures the next-photo click through decode. Both comparison runs use the Acura listing.

| Measurement | Before | Final |
|---|---:|---:|
| Phone LCP | 3,288 ms | 2,440 ms |
| Phone next-photo click to decoded image | 433 ms | 113 ms |
| Desktop LCP | 3,504 ms | 3,644 ms |
| Desktop next-photo click to decoded image | 452 ms | 113 ms |
| Phone primary image width | 1,600px | 1,080px |
| Desktop primary image width | 1,600px | 1,440px |

Raw evidence is in ignored `research/performance/before.json` and `research/performance/technical-type.json`. These are individual local lab runs, not a production Core Web Vitals pass. Phone LCP and photo changes improved; desktop LCP did not improve in this run. Confirm deployed caching, host response time and real-device performance before launch. Background videos defer until the page has loaded, and only play while visible.

## Design and feel check

The brief was self-authored under the user's explicit creative delegation. A multi-entry showroom was chosen because many visitors land directly on a car. An uninterrupted film, locked narrative, or pinned scroll sequence would obstruct that route; a plain document or utility-only dashboard would underserve the requested brand experience. The implementation uses native Next.js markup and custom GSAP choreography rather than shipping the unused standalone Scrollcraft engine.

The signature is the driving-style selector: a rev-counter needle changes with the selected collection, the real cars change, and the choice continues into inventory search. The revised hero has independently moving film, typography and fine framing planes. Its three chapter controls expose the cars, people and driving scenes. Two separate supplied-video slots provide the personal introduction. The current type system, film edit and user-directed refinement are documented in `VISUAL-REFINEMENT.md`.

The latest inspected sequence reads as arrival → service choice → driving-style selection → inventory → people → invitation. The client-requested service priorities now precede the interactive stage, while the car-selection section remains the experiential peak. No empty pinned scrolling was added. The ending resolves with a visit invitation, hours and phone. Phone composition uses a separately framed portrait reel, large headline and clear primary action. The fingerprint registry was empty before this build; its first row records the result.

## Independent review

The engineering-standard simplicity review found the component structure appropriately small. Its concrete findings were addressed: source mileage/body parsing, phone validation, test-drive intent including repeated clicks, unknown facts in metadata, and generated imagery as a missing-photo fallback. Missing listing images now receive neutral text. The supplied welcome clip already has burned speech captions; the second excerpt is silent. The independent second-pass editorial review found the component structure appropriately simple and identified a remounted live region; its changing key was removed so selection announcements use a stable region. The third-pass review caught a duplicated Story hero tween and insufficient FAQ-photo overscan for parallax; both were fixed. A final read-only review of local Inter loading and the mounted next-photo prefetch found no new actionable issues. No unresolved review finding is being hidden behind the passing tests.

The September 24 independent review found the shared finance descriptors and LeadForm extensions appropriately simple. It identified the native GET fallback and header order described above; both were fixed with regressions. No new framework or generic provider abstraction was introduced.

## What remains unverified

- Real dealr.cloud export/API authorization, mapping, update cadence and CRM lead receipt. The app's normalized JSON contract is not a claim that dealr.cloud already exposes that shape. The provider handoff is in `INTEGRATIONS.md`.
- Namecheap hosting-plan capability, server limits, DNS, TLS and deployed performance. A registrar account alone does not establish Node hosting. No public deployment or DNS changes were made.
- The approved financial relay, provider field mapping, lender routing, production receipt and disclosure approval. Native application code is complete and tested against an isolated fixture; live information entry remains disabled until configured. Provider/host encryption, access controls, request-body logging restrictions and shared abuse protection must be confirmed before enabling it.
- Real iPhone/Android hardware, Safari, low-power video behavior and manual screen-reader evaluation. Phone checks here are Chromium emulation, not physical-device testing.
- Dealer approval of rebrand copy, retained business contact details, video choices, privacy notice and final live inventory/lead flow.

For the human review, start at home and open each of the three prominent service links. Review Consignment and its consultation form, Financing and its application steps, then Contact → Request a text back. Open the Acura listing and use its financing button to confirm the vehicle carries into the application. Also check the smaller desktop sections and phone layouts. The unconfigured preview deliberately does not claim that any form message was sent; credit fields remain disabled until an approved connection exists.
