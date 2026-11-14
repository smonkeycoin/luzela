# LUZELA V4 — The Suncare Edition

## Phase A — verified baseline, 2026-11-13 (America/Cancun)

Canonical release: `abd2a31ff5debe5d16444a042752551acadeb62b`, “Restore canonical landing and integrate a dedicated Summer Drop campaign”. Vercel project `luzela` / `prj_9B1AfeWR7sZfXjy4yt0TYhSY34kz`, team `team_LG4vLJ75SnXcNtNqKI61bIj9`, production deployment `dpl_FYGrGz57Kp9XEa8sn9S2Ds6T1KQy`. Vercel reports the same commit on `main`, READY, serving www.luzela.mx.

Original checkout: `/Users/smonkeycoin/Desktop/REPO/luzela shop`; the old Desktop/luzela shop path does not exist. Starting branch: `codex/landing-recovery`. Tracked working files and index were clean. Twelve untracked user documents/migrations were present; they are excluded from this change and retained. No stash/reset/cleanup of user files.

macOS had offloaded source/dependencies to iCloud. A fresh isolated clone at `/tmp/luzela-v4-build` is based on the exact canonical commit, on `feat/luzela-v4-suncare-edition`. Final source and QA evidence are copied back to the requested checkout.

Recovery archive: `docs/qa/v4/recovery/v3-abd2a31.tar` in the original checkout; 409 tracked entries. SHA-256: `888c65959b02c40c11b06d865de4d88ac13932dba8b53c97a364b5828d006b21`. `prechange.patch` is empty; `untracked.txt` records pre-existing files. Extract the archive into an empty directory to recover the exact baseline; never extract over pending user work.

## Preservation map

| V3 content/function | V4 treatment |
| --- | --- |
| Header, cart, mobile navigation, story and FAQ links | Keep current canonical wordmark pending master logo; retain all destinations |
| Hero, original bottle, beach lifestyle | Permanent brand hero; real bottle retained; CTA to selector |
| Benefits/trust strip | Mineral/SPF/Mexico remain; unverified broad claims are not repeated on the new strip; the existing FAQ and product sources remain unchanged |
| VISTO EN, official El Mundo en Pareja logo | Existing component retained |
| Summer Drop | Retain authorized campaign and dedicated route; presentation reads server product prices |
| 1X, 2X, 3X and any other active catalog SKU | All server-returned products remain selectable; no catalog/inventory edits |
| Marcel, Azu, Ana K., Ale G. | Exact quotes and names retained, controlled by existing publicReviewsEnabled; no unverified stars or purchase badges |
| DEL CARIBE A TU RUTINA DIARIA / about.luzela.mx | Keep original editorial copy and link, add approved coastal direction |
| VERANO FOREVER / LUZELA × CHAVOLINES | Existing original photo, official logo, copy and CTA retained |
| Footer, policies, payment marks | Existing component and destinations retained |
| Editorial articles | Baseline has no blog listing; six editorial entries = four reviews, brand story and collaboration story; all retained |
| Checkout, payment, inventory, coupons, emails, auth, dashboard, attribution, analytics | No implementation changes; regression tested within safe scope |

The traveling bottle animation is intentionally omitted from the new homepage to follow the requested restrained-motion direction; its component and other routes are retained. Unsupported review ratings are not evidence and are replaced by typography, while all actual review text is preserved.

## Asset audit

Sources: `/Users/smonkeycoin/Desktop/luzela v4/sot assets`.

| ID | Local file | Decision |
| --- | --- | --- |
| 01 | hero.png | Rejected as commercial product photography: typography, label contents and packaging differ from canonical bottle.webp |
| 02 | mineral texture.png | Editorial illustration only, optimized WebP; not proof of actual texture |
| 03 | skin app.png | Editorial illustration only, optimized WebP; not proof of actual application/finish |
| 04 | sunlight shadows.png | Approved decorative background, optimized WebP |
| 05 | buen fin campaign.png | Rejected: invented label incl. water-resistance/antioxidant claims; no verified Buen Fin backend campaign |
| 06 | product bundles.png / bundle.png | Duplicate files; rejected for altered labels and packaging. Use canonical bottle composition |
| 07 | brand story.png | Editorial coastal illustration, optimized WebP; not manufacturing-location evidence |
| 08 | luzela lifestyle.png | Byte-identical to hero.png; rejected as an independent commercial lifestyle asset |
| Reference | v4 sot.png | Direction only: do not copy prices, invented reviews, OME BARRE endorsement or unverified claims |

Real product source: existing `public/luzela/bottle.webp`, unchanged. Existing collaboration assets unchanged. No stock substitutions, generated replacement branding, invented videos or endorsements.

## Content blockers

- Master logo not found in current shop public assets; preserve existing header exactly until supplied/verified. Read-only history and related asset search documented in delivery.
- Back label / verified application and reapplication instructions not yet established. Do not introduce timing, quantities, water resistance or dermatological promises. Refer to the product label pending validation.
- Returns policy currently says “Política en preparación”. Retain destination and do not invent easy/free returns.
- No verified Buen Fin campaign activation, dates or prices. The concept is only available behind an explicit preview query, without promotional checkout or official event logo. Active Summer Drop remains separate.
- OME BARRE materials are proposals, not evidence of executed public endorsement; not displayed.

## Phase B — design system

Homepage-only tokens: ivory `#faf7f2`, deep teal `#153e40`, aqua `#dcece7`, sand `#e9dfcf`, warm gray `#606764`. Editorial Georgia serif for page headings (local system font, no font download), existing Montserrat for branding, navigation, commerce and controls. No font change to canonical wordmark.

Max content width 1280px; 24/40/64px gutters; generous 64–96px section rhythm; thin warm borders, restrained pill CTAs. Mobile hero has its own stacked composition and a visible real product; compact radio pack selector, minimum 44px touch targets. Native details/summary FAQs. Visible keyboard focus. No parallax, scroll hijacking or new dependencies. Images have intrinsic dimensions/reserved areas, responsive sizes and lazy loading below hero. Reduced motion disables optional transitions.

Production deploy, remote SQL, real payments and emails are not authorized. Stop after validated Preview and human visual acceptance report.


## Preview decision (user-approved)

Vercel has only production-scoped variables. Its public Supabase key cannot read inventory or the campaign availability function. The user selected **visual remote Preview + functional local QA**. No credentials are copied to Preview and no RLS/settings are changed. In an unconfigured Vercel Preview only, homepage rendering uses `preview-catalog.json`, captured through the unchanged `getActiveProducts` server function. The page visibly identifies the snapshot date and disabled commerce. Product selection remains interactive; checkout CTAs are disabled. Production never falls back to this snapshot, including when its backend is unavailable (unit tested).

## Branding follow-up

Read-only search covered the current shop, public/assets/docs, source and Git history reachable from canonical HEAD, plus related LUZELALANDING assets/Brand DNA. No standalone LUZELA México master logo or verified back-label instructions were identified. The old Desktop/luzela shop path does not exist. A separate iCloud-conflicted ref named `codex/landing-recovery 2` prevented an unrestricted `--all` history traversal; reachable canonical history was audited successfully, without repairing or deleting refs. Related Brand DNA assets contain a favicon and Montserrat files, not a verified full master wordmark. Existing header/footer branding is retained.
