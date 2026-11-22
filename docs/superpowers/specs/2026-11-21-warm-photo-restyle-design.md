# Warm, photo-led restyle — design

Branch: `restyle-warm-photos`

## Intent

The owner saw https://chicks-on-wheels.vercel.app/ and prefers its look. What he likes about it:

- warm colours
- big pictures
- it works well on a phone

The site itself is too messy and noisy: eight nav items, four fonts, icon strips, a gallery, a carousel and a long scroll. The goal is to show him that a clear, simple site does his business better than that. It should have:

- easy navigation
- the few things the business does, shown plainly
- the key facts (where the truck is today, what it sells, how to call) findable within seconds on a phone

We take **the reference's warmth and its photos, not its layout or its noise.**

## Goals

- Adopt the reference's warm palette and its slab-serif display voice.
- Lead with big real photographs (from `raw_pictures/`) instead of the SVG illustrations on the public pages.
- Phone-first: every page reads top to bottom on a 375 px screen with no hunting.
- No pop-ups. The Menu and Forudbestilling content currently behind `Panel.astro` overlays moves inline onto the front page.
- Keep the entire current feature set unchanged:
  - the live today card and the rest of the week (from D1)
  - the banner
  - the SMS-open/closed state at 16:00
  - the "schedule unavailable" fallback
  - `/ydelser` driven by markdown
  - `/kontakt`
  - `/admin` and its Access protection

## Non-goals

- No new content sections from the reference: no catering page, gallery, "Om os", carousel, icon strip or booking-CTA band. That is new copy and it is the noise we are avoiding.
- No copy rewrites. Danish copy stays as is, except labels that only existed for the pop-ups ("Luk").
- No changes to `src/lib/*`, the DB, the middleware, Access or the deploy.
- No admin redesign. Admin only picks up the new tokens and fonts so it doesn't look broken.

## Anti-goals (a failure even if it works)

- It ends up as busy as the reference.
- Body text that fails WCAG AA contrast. Orange is pretty and easy to misuse.
- A heavy front page. Unoptimised 2048 px JPEGs on a phone connection.
- Any feature silently lost, such as the SMS state, the fallback or the banner.

## Approaches considered

- **A. Restyle in place (chosen).** Keep the pages, components and data flow. Swap the tokens and fonts, put in photos, remove the overlays. This is the smallest change, keeps every feature and makes the "simple and warm" point.
- **B. Port the reference's one-pager layout** and wire in our live data. Rejected: it brings back the noise and needs new content.
- **C. A single long page with jump links** that absorbs `/ydelser` and `/kontakt`. Rejected: a long scroll, and the existing URLs break.

## Design

### Tokens (`src/styles/global.css`)

Replace the market-stall palette with the reference's warm values. Several of them are the truck's own colours: the brown body and the cream. Contrast has been computed for every pair below.

| Role | Value | Use |
| --- | --- | --- |
| page bg | `#f6ead8` | cream page |
| surface | `#efdfc6` | quiet alternate section bg |
| border | `#d8c3a4` | rules, hairlines |
| text | `#2a140c` | body text |
| text-muted | `#5a3d30` | secondary text |
| accent | `#e8640c` | primary button fill (with **text-colour** label `#2a140c`, 5.2:1; never white on it, 3.35:1) and large type |
| accent-strong | `#a33f00` | small accent text and links on cream (5.4:1); the reference's `#c24d00` fails at 4.06:1 |
| inverse-bg | `#1f0e08` | the nav bar, the footer and the phone call bar only |
| inverse-text | `#fbefe0` | text on dark |
| focus | `#ffb347` on dark / `#2a140c` on cream | 3 px outline, offset 2 px. Orange focus on cream is 1.5:1, which is invisible |
| smiley green | `#2f8a3e` | only if the Fødevarekontrol link gets a badge |

- **Danger red** (our addition; the reference has none): `#b3261e`, which gives 6.5:1 with white and 5.5:1 on cream. It plus a light tint replace `tomat-dyb`/`tomat-lys` for the "Lukket" badges, the after-16:00 SMS notice and the admin validation errors. Orange never signals danger.
- **Banner**: dark inverse band, inverse text and an orange marker. It is an announcement, not an error, and orange on an orange-accented page would not stand out.
- Rename the tokens to these meanings across all files. This is a mechanical search-and-replace; `gul` meaning orange would mislead the next reader.
- Delete the illustration-only colours once nothing uses them.
- Remove the chequer band (`ternet`) and the ticket notches (`hak-*`). They are the old identity.
- **Photos have square corners**: no rounding and no filters. Buttons get a small radius (about 0.5 rem), and there is one button style plus one secondary style, sitewide.
- **Flat colour only.** Banned, because the critique flagged each of them on the reference:
  - gradient buttons or gradient section backgrounds
  - coloured glow shadows
  - italic serif display type
  - pill tags in white-on-orange
- Body copy gets `text-wrap: pretty`, so no lone last word sits on a line by itself. Headings get `text-wrap: balance`.
- **Dark surfaces:** only the nav, the footer and the phone call bar. No dark sections in the page body.
- This deliberately replaces `docs/design-brief.md`. Add a one-line note at the top of that file saying it has been superseded by this spec.

### Type

Two families, self-hosted in `/public/fonts` and preloaded the way they are now:

- **Alfa Slab One** (400): page headings, the town name on the today card, the logo wordmark. It is very wide, so the town name gets its own clamp, smaller than h1, and keeps the `skiltbrud` wrap behaviour. Test it against the longest real stop name at 320 px.
- **Source Sans 3** (variable): everything else, including times and dates. Use `tabular-nums` where digits align.

Drop Archivo, Roboto Mono and the reference's Kaushan Script and Source Serif. Use the reference's clamp scale for h1/h2/h3/base (`--text-h1: clamp(2.4rem, 1.5rem + 4.2vw, 5rem)` and so on).

### Photos

The sources live in `raw_pictures/`. Shipped files need resizing and compressing (WebP or AVIF, the hero at its native 960 px plus a smaller phone size and about 800 px for teasers), with `width`/`height` set to avoid layout shift.
- The hero photo is never lazy-loaded; it gets `fetchpriority="high"`.
- Everything below the first screen gets `loading="lazy"`.

| Where | Photo |
| --- | --- |
| Front page hero | `fb3.jpg` (chickens on the spit) |
| Front page "Om os" section (replaces the `Foodtruck` drawing) | `fb4.jpg` (the truck with "TLF. 50 70 80 90" painted on it) |
| `/ydelser` header and Foodtruck | `fb8.jpg` (landscape, hatch open). Not `fb7`, which is portrait and mostly sky |
| `/ydelser` Pølsevogn | `fb9_lej_en_poelsevogn.jpg` |
| `/kontakt` beside the owner's name | `owner.jpg` (user's call; **confirm with the owner before go-live** that he's happy to be shown) |

`fb2.jpg` (335 px) is too small to use.

- Every photo gets a Danish `alt`.
- No captions under photos.
- No text on top of any photo.

### Front page (`src/pages/index.astro`), top to bottom on a phone

1. Banner, as now, restyled.
2. **Hero**: the spit photo as a full-width band (about 220–260 px tall on a phone, cropped with `object-fit: cover`), with **nothing on it**. The today card follows directly below it on the page ground, never laid over the photo. The card's existing content stays:
   - the label "I dag" (with the `sr-only` prefix)
   - the town in big slab type
   - the time and the place
   - the "Vis på kort" button

   It keeps every state it has now (open, and closed with the next open day) and gains no new buttons. *(Critique call: the card is 350–450 px tall, and the photo is busy everywhere, so text on it would be illegible. Calling is handled by the phone call bar, below, and SMS stays in Forudbestilling, so the SMS button never appears twice.)*
3. **Resten af ugen**: a plain list on cream. One row per day, no boxes around each row.
4. **Menu** (inline, was a pop-up): the four menus as a simple two-column grid on desktop and one column on a phone. Heading plus lines, no prices, as now.
5. **Forudbestilling** (inline, was a pop-up): the two rules, the live "Lige nu" state, the phone button and, when SMS is open, the SMS button. Keep it short.
6. **Om Chicks on Wheels**: the existing copy, a truck photo and the "Se ydelser" button.

**Desktop (≥ lg), chosen by the user:** a split layout. The spit photo goes in a square-cornered frame on one side, never stretched past its native 960 px. Today's card and "Resten af ugen" sit on the other side, as the current side-by-side layout does. On a phone the same pieces stack in this order: photo band, today card, week list. It is one composition, not two.

The "schedule unavailable" fallback replaces sections 2–3 with its message, as it does now.

Delete `Panel.astro` and the two top buttons that opened the panels. Section headings make the content findable. There are no jump links in the hero.

### `/ydelser`

Header with a photo instead of the drawings. Keep the markdown content as the source of truth. Pairing a photo with a markdown section is the builder's call; the simplest version is a header photo plus the existing two-column prose. The CTA ("Kontakt os for et tilbud") goes on the light `surface` band, not a dark band, with the primary button.

### `/kontakt`

Same structure: the big phone button (accent), the e-mail and the owner's name, now with `owner.jpg` beside or above the name. Otherwise restyle only.

### Nav, phone call bar and footer

- **Nav:** dark brown bar, the slab-type wordmark and the same three links. On desktop, the phone number sits in the bar as a link. Keep `aria-current`.
- **Phone call bar (phones only, under `sm`)** — the user's call:
  - a bar fixed to the bottom of the screen, on inverse-bg, with one full-width link: "Ring 50 70 80 90", using `TELEFON` and `TELEFON_HREF` from `src/lib/kontakt.ts`
  - at least 48 px tall, and it respects `env(safe-area-inset-bottom)`
  - the page gets matching bottom padding, so the bar never covers the footer or the last button
  - CSS only, no JS
  - on every public page, not in admin
- **Footer:** dark brown. Same legal info (CVR, address) and links.

### Motion

Calm, and hover feedback only:
- buttons darken or step down slightly on hover and press
- a linked photo zooms 1.02 inside its frame
- links draw an underline

There is no entrance animation, no scroll-triggered animation and no auto-playing anything. Everything is off under `prefers-reduced-motion`. *(This deliberately overrides the taste skill's "every hero enters and every page gets a dealt moment" rule: the user's goal is calm.)*

### Admin

Token and font swap only. Must remain usable. No layout work. Grep admin for white or light text on the old `gul`: on the new orange it would be 3.35:1, so switch it to the text colour.

### Illustrations

Remove them from the public pages. Keep the `src/components/art/*` files in the repo for now, even ones nothing imports any more; the user asked to keep them. `Ikon.astro` (UI icons) stays in use.

## Constraints

- Astro 7 on Cloudflare Workers. The front page is rendered on demand (`no-store`), and `/ydelser` and `/kontakt` are prerendered.
- If image optimisation uses `astro:assets`, it must work with the Cloudflare adapter at build time. Otherwise pre-generate the optimised files into `public/` (builder's choice).
- Everything must work without JavaScript, as now.
- Every existing test (`pnpm test:all`) must pass, and `pnpm check` must stay clean.
- Accessibility: AA contrast, visible focus, touch targets ≥ 44 px, the skip link kept.

## Left to the builder

- The exact image pipeline and the file names of the optimised photos.
- Whether the hero uses an `<img>` with `object-fit` or a background. Prefer `<img>`, for `alt`.
- Small spacing and size decisions within the scale above.
- Whether to keep a small chicken-head mark next to the wordmark or go text only.

## Verification

- `pnpm test:all` and `pnpm check` pass.
- Run locally with seeded data (see README). Screenshot `/`, `/ydelser`, `/kontakt` and `/admin` at 375 px and 1280 px, covering the open, closed and SMS-after-16:00 states and the fallback.
- The front page's total transferred image weight on a phone is under about 400 kB.
- Run the impeccable detector against the **running** local server at 390×844 and 1440×900. Scanning the `.astro` source alone can't check contrast. No low-contrast, glow or gradient findings may remain.
- Optionally run the taste skill's checker scripts as advisory input. Their motion, contact-detail and "moment" rules are knowingly waived (see Motion; the real phone and CVR are required).
- Check the phone call bar at 320 px and 390 px: it covers nothing, and the footer stays reachable.
