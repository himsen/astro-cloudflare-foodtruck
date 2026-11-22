# Warm Photo Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the public site and admin in the warm, photo-led, calm look described by the spec, without changing any behaviour.

**Architecture:** This is a restyle in place. New design tokens are added next to the old ones first, so every commit builds. Each surface is then moved onto the new tokens, and a final cleanup task removes the old tokens, fonts and the overlay component. Photos are pre-generated as WebP files into `public/photos/` by a committed script; we don't use `astro:assets`, because the front page is rendered on demand on Workers.

**Tech Stack:** Astro 7 (`output: 'server'`, Cloudflare adapter), Tailwind v4 `@theme` tokens in `src/styles/global.css`, `cwebp` for images, vitest and `@cloudflare/vitest-pool-workers`.

**Spec:** `docs/superpowers/specs/2026-11-21-warm-photo-restyle-design.md`. Read it in full; this plan does not repeat its rationale.

## Global Constraints

- All copy stays Danish and unchanged, except removing the pop-up-only "Luk" label.
- No changes to `src/lib/*`, `src/middleware.ts`, `migrations/`, `wrangler.jsonc` or the Access setup.
- Everything works without JavaScript. Add no client `<script>`.
- **Tokens:** add these to `@theme` in `src/styles/global.css` as `--color-<name>`. They are used as Tailwind utilities (`bg-creme`, `text-tekst` and so on).

  | name | value | use |
  |---|---|---|
  | `creme` | `#f6ead8` | page background |
  | `flade` | `#efdfc6` | quiet alternate band |
  | `kant` | `#d8c3a4` | rules and hairlines; this replaces the old `kant` value |
  | `tekst` | `#2a140c` | body text, and labels on orange buttons |
  | `daempet` | `#5a3d30` | secondary text |
  | `orange` | `#e8640c` | primary button fill and large type; **never white text on it** |
  | `orange-dyb` | `#a33f00` | small accent text and links |
  | `mork` | `#1f0e08` | nav, footer and call bar only |
  | `mork-tekst` | `#fbefe0` | text on `mork` |
  | `mork-daempet` | `#d4bfa8` | secondary text on `mork` (10.5:1) |
  | `fokus` | `#ffb347` | focus ring inside `[data-mork]` |
  | `fare` | `#b3261e` | "Lukket", the after-16:00 notice and admin errors (6.5:1 with white) |
  | `fare-lys` | `#fbe4e1` | tint behind a failed admin field |
  | `papir` | `#ffffff` | form-field backgrounds only; keep the existing token |

- **Contrast**, computed on the pairs above: orange-dyb on creme is 5.41 and on flade 4.91; tekst on orange is 5.2; daempet on creme is 8.24. A new colour pair not in this table needs its contrast computed and recorded in a code comment.
- **Focus:** a 3 px solid `tekst` outline with a 2 px offset on light backgrounds, and `fokus` inside `[data-mork]`. Never removed.
- **Fonts:** exactly two families, self-hosted and preloaded.
  - `--font-display`: `'Alfa Slab One', Georgia, serif`, weight 400.
  - `--font-sans`: `'Source Sans 3', ui-sans-serif, system-ui, sans-serif`, variable 200–900.
  - Drop `font-mono` everywhere and use `tabular-nums` instead.
- **Type scale** (from the reference CSS):
  - `--text-h1`: `clamp(2.4rem, 1.5rem + 4.2vw, 5rem)`
  - `--text-h2`: `clamp(1.75rem, 1.35rem + 1.8vw, 2.75rem)`
  - `--text-h3`: `clamp(1.2rem, 1.1rem + .5vw, 1.5rem)`
  - `--text-by` (the town name on the today card): `clamp(2rem, 1.4rem + 3vw, 3.5rem)` with line-height 1.05
  - keep the existing `--text-etiket`
  - body text ≥ 16 px
- **Banned:** gradients, coloured or glow shadows, italic display type, rounded or filtered photos, text on photos, captions under photos, and dark sections in the page body.
- **Buttons:** one primary style (`bg-orange text-tekst`, about 0.5 rem radius, 48 px minimum height, `hover:bg-orange-dyb hover:text-white`; white on `#a33f00` is 7.1:1) and one secondary style (2 px `tekst` border on a transparent background). No others.
- **Motion:** hover and press feedback only. Linked photos zoom 1.02. Everything is wrapped in `@media (prefers-reduced-motion: no-preference)`. No entrance or scroll animation.
- **Text wrapping:** `text-wrap: pretty` on body `p`, `text-wrap: balance` on `h1`–`h3`, both in `@layer base`.
- Touch targets ≥ 44 px. Keep the skip link.
- `pnpm test:all` and `pnpm check` pass after every task.

**User decisions (already made):**
- Approach A: restyle in place and keep every current feature, including admin.
- The look comes from the reference's warm colours and big photos, but calm, with none of the reference's noise.
- No pop-ups: Menu and Forudbestilling go inline on the front page.
- Desktop hero is a split layout, with the photo never upscaled past 960 px.
- Apply all the critique fixes: a photo band with no text on it, a fixed call bar on phones, the contrast fixes, square photos, fewer dark bands, calm hover only.
- Put `owner.jpg` on /kontakt. Confirm with the owner before go-live.
- Drawings come off the public pages but the `src/components/art/*` files stay in the repo.

## Review Focus

1. **Long town names at 320 px.** A stop named e.g. "Skanderborg Torv" must wrap between words in Alfa Slab One and never overflow sideways. Tested in Task 3 (worker test for `skiltbrud` on the town element) and checked visually in Task 6.
2. **Closed today.** With today closed (the fresh-migration state), the hero must still show the photo, a legible "Lukket" in `fare` and the next open day. Tested in Task 3, since the fresh DB is all closed.
3. **After 16:00.** The SMS button must disappear and the notice show in `fare`. The SMS button may appear only once on the page. Tested in Task 3 (no more than one `sms:` link in the HTML).
4. **The call bar covers content.** On a phone, the last button and the footer's legal text must stay reachable above the fixed bar, and the bar must not appear on `/admin`. Front-page presence is tested in Task 2. Admin can't be fetched in tests (Access returns 403), so its absence is checked by grep in Task 2 and visually in Task 6.
5. **Schedule fallback.** When the DB fails, the page shows the "Planen kan ikke vises" message with the phone number, still on the new look. Checked visually in Task 6 by temporarily pointing the page at a missing table, or by reading the branch.

---

### Task 0: Photo and font assets

**Goal:** Committed optimised WebP photos in `public/photos/`, a script that regenerates them, and the two new font files in `public/fonts/`.

**Files:**
- Create: `scripts/photos.sh`
- Create: `public/photos/*.webp` (generated)
- Create: `public/fonts/alfa-slab-one-latin-400.woff2`, `public/fonts/source-sans-3-latin-wght.woff2`

**Acceptance Criteria:**
- [ ] `scripts/photos.sh` regenerates exactly these files from `raw_pictures/` with `cwebp -q 78 -resize <w> 0`:
  - `hero-640.webp` and `hero-960.webp` (from `fb3.jpg`)
  - `truck-800.webp` and `truck-1200.webp` (from `fb4.jpg`)
  - `ydelser-800.webp` and `ydelser-1200.webp` (from `fb8.jpg`)
  - `polsevogn-800.webp` (from `fb9_lej_en_poelsevogn.jpg`)
  - `ejer-600.webp` (from `owner.jpg`)
- [ ] `hero-640.webp` + `truck-800.webp` together are under 250 kB.
- [ ] The two font files are fontsource's latin subsets, downloaded from jsDelivr at a pinned version:
  - `@fontsource/alfa-slab-one@<v>/files/alfa-slab-one-latin-400-normal.woff2`
  - `@fontsource-variable/source-sans-3@<v>/files/source-sans-3-latin-wght-normal.woff2`
  - get `<v>` from `npm view <pkg> version`
  - the URLs and versions are recorded as comments in `scripts/photos.sh`, and repeated in the font comment in `global.css` (Task 1)
- [ ] The latin subset covers æ, ø and å (U+00C0–00FF). Check by rendering "Ærøskøbing" in Task 6.

**Verify:** `sh scripts/photos.sh && ls -l public/photos && du -ch public/photos/hero-640.webp public/photos/truck-800.webp`, which lists 8 files with a total under 250K.

**Steps:**
- [ ] Write `scripts/photos.sh` (`set -eu`, `cd` to the repo root, one `cwebp` line per output). Run it.
- [ ] Download both fonts with `curl -fL -o`.
- [ ] Commit: `git add scripts/photos.sh public/photos public/fonts && git commit -m "chore: add optimised photos and new font files"`

---

### Task 1: Tokens, fonts and base layer

**Goal:** `global.css` carries the new tokens, fonts, type scale, focus rules and wrapping rules **next to** the old ones, and `Base.astro` preloads the new fonts. Nothing visible changes except the body font, colours and preloads.

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/layouts/Base.astro`

**Acceptance Criteria:**
- [ ] `@font-face` blocks are added for `'Alfa Slab One'` (400) and `'Source Sans 3'` (200 900), with `font-display: swap`.
- [ ] Every token in Global Constraints is in `@theme`. The old tokens stay for now, except `kant`, which takes its new value.
- [ ] `--font-sans` is redefined to Source Sans 3. `--font-display` is added.
- [ ] `--text-h1`, `--text-h2`, `--text-h3` and `--text-by` are added.
- [ ] The base layer has:
  - focus rules using `tekst`, with `[data-mork]` using `fokus`
  - `::selection` set to `bg orange` and `color tekst`
  - `text-wrap` rules for `p` and `h1`–`h3`
  - `h1`, `h2` and `h3` default to `font-family: var(--font-display)` with weight 400
  - inside `@media (prefers-reduced-motion: no-preference)`: `a, button { transition: background-color .15s, color .15s, transform .15s }` and `:where(a, button):active { transform: translateY(1px) }`. There are no linked photos, so there is no zoom rule.
- [ ] `Base.astro`:
  - preloads the two new woff2 files instead of Archivo and Roboto Mono
  - `<body>` uses `bg-creme text-tekst font-sans`
  - `theme-color` is `#1f0e08`
- [ ] `pnpm check` and `pnpm test:all` pass.

**Verify:** `pnpm check && pnpm test:all`, with 0 errors and all tests passing.

**Steps:**
- [ ] Edit `global.css`. Replace the header comment blocks for fonts and palette with short new ones, noting the contrast pairs and the font source and version.
- [ ] Edit `Base.astro`.
- [ ] Commit: `feat(style): add warm palette, fonts and type scale`

---

### Task 2: Nav, footer and phone call bar

**Goal:** A dark brown nav and footer with a slab wordmark, plus a CSS-only phone call bar fixed to the bottom on phones, on public pages only.

**Files:**
- Modify: `src/components/Nav.astro`, `src/components/Footer.astro`, `src/layouts/Base.astro`
- Create: `src/components/Ringebar.astro`
- Test: `tests/worker/restyle.test.ts`

**Acceptance Criteria:**
- [ ] **Nav:**
  - `data-mork`, `bg-mork`, with the "Chicks on Wheels" wordmark in `font-display` (text only; drop `Hoene`)
  - the same three links, keeping `aria-current`, with the active link underlined in `orange`
  - on `sm` and up, the `TELEFON` link (`TELEFON_HREF`) sits at the right of the bar
  - no `ternet` band
- [ ] **Footer:** `data-mork`, `bg-mork`, `text-mork-daempet`, the same legal lines and links, no `ternet` and no `Hoene`. `font-mono` is replaced by the normal sans with `tabular-nums`.
- [ ] **`Ringebar.astro`:**
  - `<a data-ringebar href={TELEFON_HREF}>`, reading "Ring {TELEFON}" with `Ikon navn="telefon"`
  - `fixed inset-x-0 bottom-0 z-40 sm:hidden`, `bg-mork text-mork-tekst`, inside a `data-mork` wrapper
  - at least 48 px tall plus `padding-bottom: env(safe-area-inset-bottom)`
- [ ] **`Base.astro`:**
  - gets a prop `ringebar?: boolean` (default `true`) and renders `<Ringebar />` when it's true
  - adds bottom padding on `<body>` under `sm`, equal to the bar height plus the safe area, only when the bar is on
- [ ] `src/pages/admin/index.astro` passes `ringebar={false}`.
- [ ] The tests pass:

```ts
// tests/worker/restyle.test.ts
import { exports } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';

const html = async (path: string) =>
  (await exports.default.fetch(`https://example.dk${path}`)).text();

describe('phone call bar', () => {
  it('is on the front page and links to the phone', async () => {
    const page = await html('/');
    expect(page).toMatch(/<a[^>]*data-ringebar[^>]*href="tel:/);
  });
});
```
The admin page returns 403 in tests (Access), so checking "no bar on admin" is done in Task 6 by reading the source: `grep -n "ringebar={false}" src/pages/admin/index.astro`.

**Verify:** `pnpm test:worker` passes, including `phone call bar`.

**Steps:**
- [ ] Write the test. Run `pnpm test:worker`; it FAILs (no `data-ringebar`).
- [ ] Implement Ringebar, Nav, Footer and Base.
- [ ] Run `pnpm test:worker`; it PASSes. Run `pnpm check`.
- [ ] Commit: `feat(style): warm nav and footer, phone call bar`

---

### Task 3: Front page

**Goal:** The front page becomes, in order: banner, then a photo band plus the today card, then Resten af ugen, then Menu inline, then Forudbestilling inline, then Om os with a truck photo. There are no overlays and every state is kept.

**Files:**
- Modify: `src/pages/index.astro`, `src/components/DayCard.astro`, `src/components/WeekRow.astro`, `src/components/BannerNotice.astro`
- Delete: `src/components/Panel.astro`
- Test: `tests/worker/restyle.test.ts`

**Acceptance Criteria:**
- [ ] **Hero:**
  - `<img src="/photos/hero-960.webp" srcset="/photos/hero-640.webp 640w, /photos/hero-960.webp 960w" sizes="(min-width: 1024px) 50vw, 100vw" width="960" height="781" fetchpriority="high" alt="Spydstegte BBQ-kyllinger på grillspyd">`
  - square corners, `object-fit: cover`, 240 px tall under `lg`
  - at `lg` and up: a two-column grid with the photo (natural ratio, `max-width: 960px`) beside today's card and the week list, as in today's `lg:grid-cols-[…]`
  - under `lg`: stacked in the order photo, today card, week list
  - nothing is positioned over the photo
- [ ] **`DayCard`:**
  - same states and same content (including the `sr-only` "I dag" prefix, note and "Vis på kort")
  - the town in `font-display text-by skiltbrud`
  - "Lukket" in `bg-fare text-white`
  - the next open day stays legible
  - "Vis på kort" uses the primary button style
  - no `border-sort` plate and no `shadow-plade`
- [ ] **`WeekRow`:**
  - a plain row with a 1 px `kant` bottom rule
  - the weekday in `daempet`, the town in semibold sans, times in `tabular-nums`
  - "Lukket" in `fare` text (not a filled badge)
  - no `font-mono`
- [ ] **`BannerNotice`:** a `bg-mork text-mork-tekst` band with `data-mork` and an orange marker block in place of the yellow one. It is not a page-body section, so it is allowed under the "dark only nav/footer/bar" rule. *(Plan call: the spec says the banner goes on the dark band.)*
- [ ] **Menu:**
  - `<section id="menu" aria-labelledby="menu-titel">` with `h2` "Menu"
  - the four `menuer` entries as `dl` groups, `md:grid-cols-2`, 16 px rows
  - no `Kyllingespid`
- [ ] **Forudbestilling:**
  - `<section id="forudbestilling">` with `h2` "Forudbestilling" and the same copy, the "Lige nu" state and the phone and SMS links as in the old panel
  - the notice: when open, `bg-flade text-tekst`; when closed, `bg-fare text-white`
  - the two rule icons are kept (`Hoene` → `Ikon navn="telefon"`, since `Hoene` is leaving the public pages)
- [ ] **Om os:** the same copy, with `<img src="/photos/truck-800.webp" srcset="… 800w, …-1200.webp 1200w" loading="lazy" alt="Chicks on Wheels foodtruck med lugen åben">` replacing `<Foodtruck>`. "Se ydelser" uses the secondary style. The section sits on `bg-flade` with no `border-y-2`.
- [ ] The two top buttons, both `<Panel>`s and `Panel.astro` are removed. No imports of `Foodtruck`, `Kyllingespid` or `Hoene` remain in `index.astro`.
- [ ] The failure fallback uses the new tokens.
- [ ] The tests pass (append to `restyle.test.ts`):

```ts
describe('front page', () => {
  it('shows menu and pre-order inline, with no overlay dialog', async () => {
    const page = await html('/');
    expect(page).toContain('id="menu"');
    expect(page).toContain('id="forudbestilling"');
    expect(page).not.toContain('role="dialog"');
  });

  it('loads the hero photo eagerly and first', async () => {
    const page = await html('/');
    expect(page).toMatch(/<img[^>]*hero-960\.webp[^>]*fetchpriority="high"|<img[^>]*fetchpriority="high"[^>]*hero-960\.webp/);
    expect(page).not.toMatch(/<img[^>]*hero-[^>]*loading="lazy"/);
  });

  it('shows the SMS link at most once', async () => {
    const page = await html('/');
    expect((page.match(/href="sms:/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it('still renders a closed today (fresh DB is all closed)', async () => {
    const page = await html('/');
    expect(page).toContain('Lukket');
  });
});
```

**Verify:** `pnpm test:worker && pnpm check`. All tests in `front page` pass, and `grep -rn "Panel" src` returns nothing.

**Steps:**
- [ ] Append the tests. Run them; `inline` and `hero` FAIL.
- [ ] Restyle `BannerNotice`, `WeekRow` and `DayCard`, then rewrite the `index.astro` markup. Keep all the frontmatter logic as it is.
- [ ] Delete `Panel.astro`.
- [ ] Run the tests and `pnpm check`; they PASS.
- [ ] Commit: `feat(style): photo-led front page, menu and pre-order inline`

---

### Task 4: /ydelser and /kontakt

**Goal:** Both prerendered pages on the new look, with photos.

**Files:**
- Modify: `src/pages/ydelser.astro`, `src/pages/kontakt.astro`

**Acceptance Criteria:**
- [ ] **/ydelser:**
  - the header is an `h1` "Ydelser" on `creme`, followed by the `ydelser-*.webp` photo, full width inside the content column, square, eager (it is above the fold), with `alt="Foodtrucken parkeret med lugen åben"`
  - the markdown prose keeps its descendant-selector styling, re-tokened: the `h2` gets `font-display`, the old `border-gul` underline becomes a 3 px `orange` rule and `p` stays 16–18 px
  - after the "Tonny's" section, or beside the prose at `md`, `polsevogn-800.webp` with `loading="lazy"` and `alt="Tonny's pølsevogn"`
  - the CTA "Kontakt os for et tilbud" is a primary button on a `bg-flade` band, not `bg-sort`
  - no `Foodtruck` or `Polsevogn` imports
- [ ] **/kontakt:**
  - the same `dl`
  - the phone is a primary button with a large `tabular-nums` number
  - the e-mail is a secondary-style box
  - the owner row shows `ejer-600.webp` (square, about 160 px, `loading="lazy"`, `alt={INDEHAVER}`) next to the name
  - `font-mono` is gone
  - the smiley link stays, in `orange-dyb`
- [ ] `pnpm check` and `pnpm test:all` pass.

**Verify:** `pnpm build && pnpm check && pnpm test:all`, with 0 errors. `grep -n "font-mono\|bg-gul\|bg-sort" src/pages/ydelser.astro src/pages/kontakt.astro` returns nothing.

**Steps:**
- [ ] Rewrite both pages' markup.
- [ ] Verify.
- [ ] Commit: `feat(style): ydelser and kontakt with photos`

---

### Task 5: Admin re-token and old-token cleanup

**Goal:** Admin on the new tokens. Every old token, utility, font file and stale reference is removed, and the old design brief is marked as superseded.

**Files:**
- Modify: `src/pages/admin/index.astro`, `src/components/admin/Field.astro`, `src/components/admin/StopRow.astro`, `src/styles/global.css`, `docs/design-brief.md`
- Delete: `public/fonts/archivo-latin-var.woff2`, `public/fonts/roboto-mono-500-subset.woff2`

**Acceptance Criteria:**
- [ ] Admin class mapping (mechanical):

  | old | new |
  |---|---|
  | `bg-ben` | `bg-creme` |
  | `bg-sort` | `bg-mork` |
  | `text-sort` | `text-tekst` |
  | `border-sort` | `border-tekst` |
  | `text-ben` on dark | `text-mork-tekst` |
  | `text-dis` | `text-mork-daempet` |
  | `bg-gul` | `bg-orange`, with any text on it `text-tekst` |
  | `*-gul-dyb` | `*-orange-dyb` |
  | `*-tomat`, `*-tomat-dyb` | `*-fare` |
  | `*-tomat-lys` | `*-fare-lys` |
  | `text-rist` | `text-daempet` |
  | `font-mono` | removed, with `tabular-nums` added where there are digits |
  | `text-skilt`, `text-plakat` | `font-display text-h1` / `text-h2` |
  | `shadow-plade*` | removed |

  Layout is unchanged.
- [ ] No light text sits on `bg-orange` anywhere in `src`. Check with `grep -rn "bg-orange[^-]" src | grep -E "text-(white|ben|mork-tekst)"`, which must return nothing.
- [ ] `global.css` no longer defines `sort`, `ben`, `gul`, `gul-dyb`, `tomat`, `tomat-dyb`, `tomat-lys`, `rist`, `dis`, `brun`, `himmel`, `hud`, `blaa-skilt`, `--font-mono`, `--text-skilt*`, `--text-plakat*`, `--shadow-plade*`, `ternet` or `hak-*`, nor the Archivo or Roboto Mono `@font-face`. Art components keep working through their hard-coded `var(--x, #fallback)` values. `Hoene` in admin, if used, must still render; check it.
- [ ] `docs/design-brief.md` gets a first line: `> Superseded by docs/superpowers/specs/2026-11-21-warm-photo-restyle-design.md (2026-11-21).`
- [ ] Check with `grep -rnE "(bg|text|border|outline|fill|stroke)-(sort|ben|gul|tomat|rist|dis)\b|font-mono|ternet|hak-|shadow-plade|text-skilt|text-plakat" src --exclude-dir=art`, which must return nothing.

**Verify:** run the grep above (no output), then `pnpm build && pnpm check && pnpm test:all` (all green).

**Steps:**
- [ ] Re-token the admin files with the mapping.
- [ ] Delete the old tokens, utilities, `@font-face` blocks and font files.
- [ ] Run the greps and fix any leftovers outside `art/`.
- [ ] Verify.
- [ ] Commit: `refactor(style): admin on new tokens, remove old palette and fonts`

---

### Task 6: Visual and quality verification

**Goal:** Evidence that the restyle looks right, stays fast and accessible, and keeps every state, at phone and desktop widths.

**Files:**
- Fix-ups anywhere in the files above, as findings require.
- Screenshots go to the session scratchpad and are not committed.

**Acceptance Criteria:**
- [ ] Seed the local D1 as in the README:
  - open on weekdays
  - one stop named "Skanderborg Torv"
  - one named "Ærøskøbing Havn"
  - one exception with a note
  - an active banner
- [ ] Run `pnpm dev`, then take screenshots of `/`, `/ydelser` and `/kontakt` at 320, 390 and 1440 wide. Also capture:
  - today open
  - today closed (set today's weekday closed)
  - after 16:00 (temporarily hard-code `smsAaben = false`, then revert)
  - the DB-failure fallback (temporarily throw in the `try`, then revert)

  Read every screenshot against the spec:
  - no text on any photo
  - the town wraps at 320 with no sideways scroll
  - æ, ø and å render in both fonts
  - the call bar covers nothing and the footer is reachable
  - "Lukket" is legible
  - only the nav, footer and call bar are dark (plus the banner)
- [ ] `/admin` with the dev Access bypass the README describes: the form is usable and errors show in `fare`, with no call bar.
- [ ] The impeccable detector, run against the running server: `<impeccable>/scripts/impeccable detect --json http://localhost:4321/ --viewport 390x844`, and again at `1440x900`, for `/`, `/ydelser` and `/kontakt`. No `low-contrast`, `dark-glow` or gradient findings remain. List any other finding in the report, fixed or with a reason it stays.
- [ ] Front-page image bytes at 390 wide, eager images only, are under 400 kB (sum the eager `<img>` files at their 390-wide `srcset` choice).
- [ ] Keyboard: Tab reaches the skip link first, and a focus ring is visible on creme and on mork.
- [ ] Reverting every temporary hack leaves `git diff` clean of it. `pnpm test:all` and `pnpm check` are green.

**Verify:** `pnpm test:all && pnpm check` is green. The detector JSON at both viewports has no `low-contrast`, `dark-glow` or gradient rule ids. The screenshot set is listed in the report.

**Steps:**
- [ ] Seed, run, capture, read and fix. Loop until clean, three rounds at most, then report what's still open.
- [ ] Commit any fix-ups: `fix(style): verification fixes`

---

## Notes for the executor

- `src/components/art/*` stay in the repo even when nothing imports them; the user said so. Don't delete them.
- `owner.jpg` on the live site needs the owner's consent. Flag it in the final report; it is not a code task.
