# Content and design record

## Request and owner asks

The user authorized a complete Next.js dealership rebrand and delegated visual direction. The supplied conversation is reference material, not an instruction to contact anybody, add chat participants, log in, or request credentials. Its relevant asks are: reserve a couple of easily replaceable talking-head video positions; current placeholder video choice is flexible; domain registration is at Namecheap; dealr.cloud currently operates the website and DMS; Buddy can facilitate provider contact.

Private screenshots and raw media remain in the ignored `research/source-media/` directory. Personal phone numbers in those screenshots are not used in the website.

## Page parity

| Existing page | New page | Treatment |
|---|---|---|
| `/`, `/home` | `/` | Layered cinematic hero, prominent inventory/financing/consignment routes, drive-style selection, owner video and visit |
| `/inventory` | `/inventory` | Search, body/make/budget/style filters, sort, pagination, saved vehicles |
| `/inventory/<slug>/<id>` | Same route pattern | Full-width gallery, keyboard lightbox, original facts/history, calculator, inquiry/test drive, related vehicles |
| `/financing` | `/financing` and `/financing/apply` | Budget calculator, credit-range explanations, provider-supplied dealr.cloud credit application iframe |
| Application authorizations | `/financing/terms` | On-site credit authorization information; dealer/provider review required before enabling submission |
| `/sell-your-vehicle` | Same | Vehicle and contact fields, valuation process and honest submission state |
| `/contact-us` | Same | Contact form, existing public channels, hours and map |
| Global Text Us form | `/contact-us/text` | First/last name, phone, message and explicit text consent; uses the general lead relay |
| `/privacy-policy` | Same | Updated notice reflecting actual build behavior |
| New | `/our-story` | Rebrand story, transparent logo reveal and two replaceable video slots |
| New client request | `/consignment` | Process, photo carousel, vehicle/contact form and FAQs; terms agreed with the dealer |

The source site navigation, footer, contact fields, trade form and financing field groups were inspected. No additional public content pages were found in that navigation. Unknown and inactive vehicle routes use the designed not-found page.

The September 24 re-audit also inspected the financing form script, vehicle inquiry controls and Text Us modal. Application links no longer navigate to the old website. CARFAX, maps and social links remain intentional third-party destinations. Production lead and credit delivery still require approved provider connections; on-site page parity is not a claim that these are connected.

## September 24 client feedback

The supplied screenshot asks for prominent homepage inventory, financing from great credit through buy here, pay here, and professional consignment. Those three routes now come immediately after the hero/brand strip. Selling directly and trading remain separately available. Consignment copy explains the service without inventing fees, guaranteed prices or timelines; financing copy avoids guaranteed approval or terms.

The shared accent is now richer logo-inspired gold (`#e5aa3d`), with warmer highlights in the existing scroll sheen. Desktop hero heights, section spacing, the driving-style stage, service card images and visit section were tightened. The accepted uppercase Inter/IBM Plex Mono system, black/charcoal surfaces, original footage, motion and DMS boundary remain.

## Source facts

- [Current dealership home](https://www.utahusedcarfactory.com/)
- [Current contact page](https://www.utahusedcarfactory.com/contact-us)
- [Current inventory](https://www.utahusedcarfactory.com/inventory)
- [Acura Integra example detail page](https://www.utahusedcarfactory.com/inventory/2024-acura-integra-a-spec-technology/1173076)
- [Current secure financing page](https://www.utahusedcarfactory.com/financing)

Public source facts, checked September 23, 2026: 7036 S High Tech Dr, Midvale UT 84047; (801) 906-8111; utahusedcarfactory@gmail.com; Monday through Saturday 10 AM–7 PM, Sunday closed. No invented awards, ratings, customer counts, reviews or financing promises were added.

## Reference research

- Semler Premium: full-bleed vehicle footage, a small wordmark, thin display type and a contained navigation control. Adapted the hierarchy and restraint. The initial automated capture encountered its cookie panel, so that capture is not evidence of every scroll state.
- Vincent & Dussault: architectural aerial film with large corner typography; below, clear black surfaces and client/media sections. Adapted the space and image hierarchy, not its pill navigation.
- ZKR: instrument-like circular loading display and cinematic asset loading. Adapted the instrument reference into a useful drive-style selector; did not copy a blocking preloader.
- Ultraviolet Awwwards reference was read for the supplied visual direction; no assets were copied.

Browser screenshots are in ignored `research/frames/reference-*`. Creative brief and feeling curve: `scrollcraft/builds/revdistrict/BRIEF.md`.

## Asset provenance

- RevDistrict logo: `public/images/revdistrict-original.png` is a byte-for-byte copy of the original user-supplied `RevDistrict Logo.png`. The shared header, footer and District page preserve its metallic gold, silver and red artwork. CSS screen blending integrates the original black background into the dark site; the source PNG is not redrawn or recolored. The District animation uses two SVG-clipped copies of this same image to isolate and rotate its needle around the original hub. GSAP ties the angle to scroll position in both directions; reduced motion restores the original static angle. No generated video is needed. The earlier flat white recreation is no longer rendered.
- Vehicle photos: existing authorized dealer website/CDN, corresponding to each listing. No AI-generated image is used as evidence of a listed car.
- `public/video/meet-the-district.mp4`: supplied Instagram showroom tour, encoded at 540px width, original audio and burned captions retained.
- `public/video/behind-the-scenes.mp4`: 16-second showroom excerpt beginning at 00:20 in the supplied “Taking delivery of my new Durango Hellcat” video. The matching original audio was restored on October 7, 2026 as stereo AAC at 128 kbps; the existing video stream is unchanged. Both opt-in films start with sound when opened, while atmospheric loops remain silent.
- Team and story posters: frames from the supplied YouTube videos.
- Fonts: Inter variable (weight and optical-size axes), locally served through Next.js `next/font/local`, and IBM Plex Mono via Fontsource. The user explicitly rejected the previous Bodoni serif/italic direction and requested uppercase technical typography like Nexola. Nexola’s source identifies Inter Display; the current open-source Inter uses display optical sizing for headings and text optical sizing for body copy. Old Bodoni and Manrope packages were removed. Font licenses travel with their packages.
- Icons: lucide-react; bespoke monochrome favicon is a code-native R monogram, while the supplied logo is shown in the header and story page.

## Current homepage film

`public/video/district-hero.mp4` is a silent 22-second edit of the supplied YouTube originals: car details, showroom culture, detailing and a Mustang driving shot. It has no subtitles or graphic text. Natural vehicle badges and signs within the photographed scenes remain. `district-hero-mobile.mp4` has a separately authored portrait crop. Six current web stills were extracted from these same sources. The timeline and reproducible local render command are in [VISUAL-REFINEMENT.md](VISUAL-REFINEMENT.md).

## Previous generated brand hero

The original design used three aligned imagegen assets: a Utah landscape, an alpha coupe and a combined frame. The redesign replaces these with the actual dealership footage. Those unused web files are archived in ignored `research/retired-design-assets/`; original generated PNGs remain in ignored research. They are not shipped or used as evidence of listed inventory.

## Earlier reference refinement (superseded typography)

The user’s supplied Ultraviolet screenshot guided the serif headline, photographic scale, thin frame and film chapter navigation. The current live Ultraviolet page differs from that screenshot, so its historical display font could not be verified. Bodoni Moda is an independently selected open-source interpretation of the supplied reference, not a claim to be its original face. Manrope carries body text and IBM Plex Mono carries technical labels. Browser research also confirmed the current references use `italian` (Semler), `objektiv-mk2` (Vincent & Dussault) and `Aeonik Pro` with `IBMPlex Mono` (ZKR). No proprietary font files or reference-site media were copied.

## Latest client direction and asset additions

The client rejected all serif/italic display text. [Nexola](https://nexola.framer.website/) was inspected on September 23, 2026: its headline declarations use Inter Display. RevDistrict now uses uppercase, heavier Inter headings, sans-serif film chapters, and the requested IBM Plex Mono labels. All former italic emphasis is upright. Gold sheen and real dealership footage remain.

The three silent interior loops reuse reviewed cuts from the client’s montage: Mustang driving for Sell / Trade; Porsche cabin for Financing and Inventory; showroom/people for The District and Contact. `scripts/build-interior-films.py` renders these H.264/24 fps/fast-start loops without audio, at approximately 728 KB, 228 KB and 463 KB respectively. The FAQ photo is frame 175.5 seconds from the supplied Durango video. No stock footage was needed.

The earlier flat logo (superseded by the September 29 original-logo restoration) was made with the built-in image-generation edit tool, using the original supplied logo as reference. Final prompt: “Redraw this brand mark as a clean flat BLACK logo on a truly TRANSPARENT background. Use solid #000000 ink shapes. Keep exact REV/DISTRICT lettering composition and speedometer arc with needle, eliminate metallic lighting, 3D edges, shadows, reflected floor, red and gold. Glyphs and gauge uniformly opaque black, no texture. Background alpha 0 / intentional gaps transparent. No distress, stray dots, grain, speckles. Smooth sharp vector-like shapes. Compact centered composition with small margins. PNG actual alpha. Will be inverted to white in website CSS.” The selected output was checked on the actual site; unused generations are not shipped.
