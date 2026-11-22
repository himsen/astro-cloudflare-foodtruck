# Top bar with logo, and a /book page — design (short)

Branch: `restyle-warm-photos`. This extends `2026-11-21-warm-photo-restyle-design.md`; its Global Constraints still apply.

## Intent
After seeing the restyle, the user wants:
- the brand logo in the top bar
- a "Menu" jump link
- a prominent "Book foodtruck" button, as on the reference site
- a top bar that works on small screens

Booking needs its own page. We can't send or save forms, so the page tells people what to include and gives them a call button or a pre-filled e-mail.

## Approaches
- **Booking:**
  - Chosen: a page with contact cards in a sidebar, plus a checklist and a `mailto:` button that pre-fills the subject and body.
  - Rejected: a real form. There's no backend, and the user said no.
  - Rejected: a fake form that builds a `mailto:` link, as the reference does. It needs JavaScript and pretends to be a form.
- **Phone nav:**
  - Chosen (user): a hamburger menu.
  - Rejected: two always-visible rows.

## Design

### Top bar (`Nav.astro`, public pages)
- **Logo:** `public/logo.webp` (and a 2x version), made from the reference's `logo.png`, which is the owner's own logo (the mascot painted on the truck), downscaled with `cwebp`.
  - `alt="Chicks on Wheels – Danish Quality"`, inside a link to `/` with `aria-label="Chicks on Wheels — forside"`.
  - About 44 px tall on phones and about 56 px on desktop.
  - The source has a small dark speck in the bottom-right corner. Crop it off if a 2–4 px crop removes it.
- **Links:** Hvor er vi? (`/`) · Menu (`/#menu`) · Ydelser · Kontakt. Keep `aria-current`; Menu is never marked current.
- **Right side:** the `TELEFON` link (desktop only), then the primary "Book foodtruck" button to `/book`. Book is `aria-current` on `/book`.
- **Under `lg`:** one row of logo, a compact primary "Book" button (visible text "Book", `aria-label="Book foodtruck"`) and a ☰ toggle.
  - The toggle is `<details>`/`<summary>` and needs no JS.
  - The summary has an accessible name ("Menu") and a 44 px tap target.
  - The open panel lists the four links stacked, full width, in the page flow below the bar (not overlaid).
  - `summary::-webkit-details-marker` is hidden.
- **Admin:** keeps a plain bar, with no Book button and no menu toggle. Add a `Base` prop if needed.
- **Banner:** unchanged.

### `/book` (`src/pages/book.astro`, prerendered)
- **h1:** "Book foodtruck".
- **Intro:** "Ring eller skriv til os med dato, sted og antal gæster – så vender vi tilbage med et tilbud."
- **Layout:** at `lg` and up, two columns: main content plus a sidebar (`lg:sticky lg:top-6`). Under `lg`, the sidebar comes first.
- **Sidebar cards** (flat `flade` panels, square, no shadow):
  1. "Ring eller send SMS": the line "Den hurtigste vej til en booking.", the `TELEFON` primary button and a secondary SMS button (`SMS_HREF`).
  2. "Skriv til os": the `EMAIL` link.
- **Main content:**
  - h2 "Sådan booker du".
  - The line "Fortæl os det her, når du ringer eller skriver:".
  - A list: Dato · Sted / adresse · Antal gæster (ca.) · Type arrangement · Foodtruck, pølsevogn eller begge · Dit navn og telefonnummer.
  - The primary button "Skriv en mail": `mailto:${EMAIL}?subject=Booking af foodtruck&body=…`, URL-encoded with `encodeURIComponent`. The body is the list as `Label: ` lines, one per line, built once in the frontmatter from the same array the list renders from.
  - A closing line: "Book i god tid – især til weekender og i højsæsonen."
- **Not included:** FAQ, prices, payment methods, Facebook (unconfirmed), "Se også", tip cards.
- **Copy:** this is new Danish copy drafted by Claude. The owner should proofread it.

### Other
- `/ydelser`: the CTA stays "Kontakt os for et tilbud" but now points to `/book`. *(Claude's call: booking is that CTA's purpose. `/kontakt` stays until the user decides its future.)*

## Verification
- `pnpm test:all` and `pnpm check` are green.
- A worker test checks that `/` has a link to `/book` and a link to `/#menu`, plus a `<details>` nav toggle.
- A unit or worker check verifies that the `mailto` href is encoded (no raw spaces or newlines).
- Screenshots at 320, 390, 1024 and 1440 of `/` and `/book`, with the menu both open and closed.
- The impeccable detector, run against the live dev server, shows no contrast or tap-size problems.
