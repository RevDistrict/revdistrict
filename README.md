# RevDistrict

Next.js dealership website for the rebrand of The Used Car Factory in Midvale, Utah. Neutral black/charcoal, warm gold, bold uppercase Inter display type and IBM Plex Mono. A custom reel of the dealership’s cars and people, lightweight interior background films, GSAP scene depth, drawn icons, an oversized interactive instrument, responsive listing photography and replaceable owner-video slots.

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. Start with home → inventory → Acura Integra → gallery → request a test drive. Also review financing, sell/trade, contact, and the story page at phone width.

The homepage now prioritizes inventory, financing and consignment. On-site routes include a consignment consultation, text-back request, and dealr.cloud’s embedded credit application at the existing `/financing/apply` route. Desktop sections are more compact and the gold accent is closer to the original logo.

The build contains a clearly labeled 262-vehicle preview captured September 23, 2026. Live dealr.cloud inventory and CRM delivery need dealer-authorized configuration. Unconfigured lead forms fail honestly and offer the existing phone/email. Credit applications go directly to the provider through its supplied iframe. Inquiry delivery uses ADF email and needs host-managed SMTP credentials; see `.env.example`. No lead is silently stored or falsely acknowledged. See the integration handoff before enabling production applications.

- [Integration contract and provider handoff](docs/INTEGRATIONS.md)
- [dealr.cloud CSV/S3 importer and October 14 handoff](docs/DEALR-INVENTORY.md)
- [Namecheap deployment](docs/DEPLOYMENT.md)
- [Content, page parity and asset provenance](docs/CONTENT-AND-SOURCES.md)
- [Validation evidence and review notes](docs/VERIFICATION.md)
- [September visual refinement and film edit](docs/VISUAL-REFINEMENT.md)

## Saved vehicles

Saving a vehicle does not require an account. The site stores vehicle IDs in browser `localStorage` under `revdistrict-saved`, not in an HTTP cache or a customer database. Saved choices survive reloads and later visits on the same browser, device and site origin. They do not sync between devices or browsers, and clearing site data removes them. Private browsing generally keeps them only for that private session. There is no customer login or separate logged-in behavior in this app.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:inventory
npm run test:integrations
npm audit --audit-level=high
npm run test:e2e
```

Browser tests expect the app on localhost:3000. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` for a different installed Chromium path; on other systems use a Playwright-installed browser and adjust the launch setting. `TEST_BASE_URL` selects an alternate running environment. No tests send production leads.

Integration tests require OpenSSL, Chromium and the compiled build. On Linux, run `npx playwright install --with-deps chromium` first; CI does this automatically. They start an isolated HTTPS inventory fixture, authenticated STARTTLS mail fixture and temporary app process, verify every inquiry type and the iframe wrapper, then clean up. The provider iframe is intercepted in automated tests; no live applications or emails are submitted. Screenshot reviews are reproducible with `scripts/visual-review.mjs`, `scripts/motion-review.mjs`, `scripts/interior-motion-review.mjs` and `scripts/performance-review.mjs` against the running site.

Key edits: `src/lib/site.ts` for public contacts; `src/lib/media.ts` for video swaps; `src/app/globals.css` for shared design tokens; `src/app/editorial.css` for the film, instrument and editorial layouts; `src/app/atmosphere.css` for interior films, the transparent mark and section details. Font loading is in `src/app/layout.tsx`; provider photo sizing is in `src/lib/vehicle-images.ts`. `.env.example` lists production settings. Never expose feed or lead-relay tokens through `NEXT_PUBLIC_` variables.
