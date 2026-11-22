# Top Bar and Booking Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A top bar with the logo, a Menu jump, a prominent Book button and a no-JS hamburger menu on small screens, plus a new `/book` page with contact cards and a pre-filled e-mail.

**Architecture:** Nav changes stay inside `Nav.astro` (with a small `Base` prop for admin). `/book` is a prerendered Astro page. The mailto builder is a pure function in `src/lib/booking.ts` so it can be unit-tested.

**Tech Stack:** Astro 7, Tailwind v4 tokens (see `src/styles/global.css`), vitest (unit), `@cloudflare/vitest-pool-workers` (worker), `cwebp`.

**Spec:** `docs/superpowers/specs/2026-11-21-nav-and-booking-design.md`, which extends `docs/superpowers/specs/2026-11-21-warm-photo-restyle-design.md`.

## Global Constraints
- All the Global Constraints in `docs/superpowers/plans/2026-11-21-warm-photo-restyle.md` still bind: tokens, two fonts, one primary and one secondary button style, contrast, focus, no client JS, square photos, ≥ 44 px targets.
- Primary button classes: copy from `src/components/DayCard.astro` ("Vis på kort"). Secondary: copy from the SMS link in `src/pages/index.astro`.
- Contact values come only from `src/lib/kontakt.ts` (`TELEFON`, `TELEFON_HREF`, `SMS_HREF`, `EMAIL`). Never hard-code them.
- Danish copy for `/book` is exactly the copy in the spec.

**User decisions (already made):**
- Logo from the reference site (it's the owner's).
- Add a Menu jump link.
- A "Book foodtruck" button on the right that goes to a new `/book` page.
- No form. Directions plus call or e-mail.
- Contact options in a sidebar ("vertical bar").
- A hamburger menu on phones.
- `/kontakt`'s future is undecided, so leave the page as it is.

## Review Focus
1. **320 px top bar:** the logo, Book and ☰ must fit on one row with no overflow; the ☰ tap target is ≥ 44 px. Checked in Task 3 with screenshots.
2. **Menu panel open:** the four links are each ≥ 44 px tall, readable on `mork`, and keyboard-reachable with a visible `fokus` ring. Checked in Task 3.
3. **Mailto encoding:** the subject and body contain spaces, `/`, `(`, `)` and newlines, so they must be percent-encoded. "æ" and "ø" must survive. Covered by the Task 2 unit test.
4. **Sidebar on phones:** it comes before the checklist, and the sticky positioning is off under `lg`, so it never covers content. Checked in Task 3.
5. **Admin bar:** no Book button and no ☰. Checked in Task 1 (grep for the prop) and in Task 3 with a screenshot.

---

### Task 1: Top bar with logo, Menu link, Book button and hamburger

**Goal:** `Nav.astro` matches the spec's "Top bar" section on all widths, and admin keeps a plain bar.

**Files:**
- Create: `public/logo.webp`, `public/logo@2x.webp` (from `https://chicks-on-wheels.vercel.app/logo.png`, 1080×279 RGBA; `cwebp -q 85 -alpha_q 100 -resize 220 0` and `-resize 440 0`; crop the bottom-right speck if `-crop` of a few px removes it)
- Modify: `src/components/Nav.astro`, `src/layouts/Base.astro` (prop `bookknap?: boolean`, default `true`, passed to Nav), `src/pages/admin/index.astro` (pass `bookknap={false}`)
- Modify: `scripts/photos.sh` (add a comment with the logo source URL and the cwebp lines)
- Test: `tests/worker/restyle.test.ts`

**Acceptance Criteria:**
- [ ] The logo `<img src="/logo.webp" srcset="/logo.webp 1x, /logo@2x.webp 2x" alt="Chicks on Wheels – Danish Quality" width height>` sits inside `<a href="/" aria-label="Chicks on Wheels — forside">`. It is `h-11` under `lg` and `h-14` from `lg` up, with `w-auto`. The text wordmark is gone.
- [ ] At `lg` and up, the links Hvor er vi? (`/`), Menu (`/#menu`), Ydelser and Kontakt are inline, followed by the `TELEFON` link and the primary "Book foodtruck" button (`href="/book"`, `aria-current="page"` on `/book`). Menu never gets `aria-current`.
- [ ] Under `lg`, the top row is logo, a compact primary button (visible "Book", `aria-label="Book foodtruck"`) and `<details data-navmenu><summary aria-label="Menu">` with a ☰ icon (inline SVG, three lines, `aria-hidden`).
  - The summary is ≥ 44 × 44 px, and its default marker is hidden (`list-none` plus `[&::-webkit-details-marker]:hidden`).
  - When open, the panel shows the four links stacked, each ≥ 44 px tall, `text-mork-tekst`, in the flow beneath the row.
  - The `open:` state swaps the icon to an ✕, or else keeps ☰ (either is fine).
- [ ] With `bookknap={false}`, Nav renders no Book button and no `<details>`, and shows the four links inline at every width. Admin passes it.
- [ ] Tests (append to `tests/worker/restyle.test.ts`):

```ts
describe('top bar', () => {
  it('links to the booking page and the menu section, with a no-JS menu toggle', async () => {
    const page = await html('/');
    expect(page).toMatch(/<a[^>]*href="\/book"/);
    expect(page).toMatch(/<a[^>]*href="\/#menu"/);
    expect(page).toMatch(/<details[^>]*data-navmenu/);
    expect(page).toContain('src="/logo.webp"');
  });
});
```
- [ ] `grep -n "bookknap={false}" src/pages/admin/index.astro` matches.

**Verify:** `pnpm test:worker && pnpm check`. The `top bar` test passes and there are 0 errors.

**Steps:**
- [ ] Download the logo into the scratchpad with `curl -fL`, make the two WebPs, and view them to confirm the speck is gone.
- [ ] Write the test. Run it; it FAILs.
- [ ] Implement Nav, Base and admin.
- [ ] Run the tests and check; they PASS.
- [ ] Commit: `feat(nav): logo, menu jump, book button, no-JS hamburger`

---

### Task 2: `/book` page

**Goal:** A prerendered `/book` page per the spec, with the mailto built and unit-tested in `src/lib/booking.ts`. The /ydelser CTA points to it.

**Files:**
- Create: `src/lib/booking.ts`, `src/pages/book.astro`, `tests/unit/booking.test.ts`
- Modify: `src/pages/ydelser.astro:48` (`href="/kontakt"` becomes `href="/book"`)

**Acceptance Criteria:**
- [ ] `src/lib/booking.ts` exports:
  - `BOOKING_PUNKTER: readonly string[]` = `['Dato', 'Sted / adresse', 'Antal gæster (ca.)', 'Type arrangement', 'Foodtruck, pølsevogn eller begge', 'Dit navn og telefonnummer']`
  - `bookingMailto(email: string): string`, which returns `mailto:${email}?subject=${enc('Booking af foodtruck')}&body=${enc(BOOKING_PUNKTER.map(p => `${p}: `).join('\n'))}` with `enc = encodeURIComponent`
- [ ] Unit tests:

```ts
import { describe, it, expect } from 'vitest';
import { bookingMailto, BOOKING_PUNKTER } from '../../src/lib/booking';

describe('bookingMailto', () => {
  const href = bookingMailto('a@b.dk');
  it('targets the address with an encoded subject', () => {
    expect(href.startsWith('mailto:a@b.dk?subject=Booking%20af%20foodtruck&body=')).toBe(true);
  });
  it('has no raw spaces or newlines', () => {
    expect(href).not.toMatch(/[ \n]/);
  });
  it('round-trips every checklist line, including æ and ø', () => {
    const body = decodeURIComponent(href.split('&body=')[1]);
    expect(body.split('\n')).toEqual(BOOKING_PUNKTER.map((p) => `${p}: `));
  });
});
```
- [ ] `book.astro` (`export const prerender = true`, `<Base title="Book foodtruck" description="Book Chicks on Wheels' foodtruck eller pølsevogn til dit arrangement.">`) has, with copy exactly as in the spec:
  - the h1 and intro
  - an `lg:grid-cols-[minmax(0,1fr)_20rem]` grid with the sidebar (`<aside>`) placed first in the DOM order on phones and in the right column at `lg` via `lg:order-2`, `lg:sticky lg:top-6 lg:self-start`
  - the two flat `bg-flade` cards: Ring/SMS with the primary `TELEFON` button and a secondary SMS button; "Skriv til os" with the `EMAIL` link in `orange-dyb`
  - main: the h2 "Sådan booker du", the lead line, a `<ul>` from `BOOKING_PUNKTER`, the primary button "Skriv en mail" with `href={bookingMailto(EMAIL)}`, and the closing line
- [ ] `/ydelser` CTA goes to `/book`, with its text unchanged.

**Verify:** `pnpm test && pnpm build && pnpm check && pnpm test:all`. The booking unit tests pass and everything is green.

**Steps:**
- [ ] Write the unit test. Run it; it FAILs (module missing).
- [ ] Implement `booking.ts`. Run it; it PASSes.
- [ ] Build `book.astro` and change the ydelser href.
- [ ] Verify.
- [ ] Commit: `feat(book): booking page with contact sidebar and prefilled mail`

---

### Task 3: Visual verification

**Goal:** Evidence that the top bar and `/book` look right and are accessible at every width.

**Files:** fix-ups only. Screenshots go to the scratchpad.

**Acceptance Criteria:**
- [ ] With `pnpm dev` running (README), take impeccable `shot` screenshots of `/` and `/book` at 320x700, 390x844, 1024x768 and 1440x900, plus `/admin` at 390 and 1440. Take the open-menu state at 390 by temporarily adding `open` to the `<details>`, then revert it.
- [ ] Read every screenshot against the spec and Review Focus 1–5. The menu panel and its links are readable, nothing overflows at 320 and the logo is crisp.
- [ ] Run the impeccable `detect --json` at 390x844 and 1440x900 for `/` and `/book`. There must be no `low-contrast` or tap-size findings.
- [ ] Keyboard: Tab order is skip link → logo → (phone) Book → ☰ summary. Enter opens the menu, and the `fokus` ring is visible on `mork`.
- [ ] All temporary hacks are reverted. `pnpm test:all` and `pnpm check` are green.

**Verify:** `pnpm test:all && pnpm check` is green. The screenshot list and detector results are in the report.

**Steps:**
- [ ] Run, capture, read and fix. Loop until clean, three rounds at most.
- [ ] Commit fix-ups: `fix(nav,book): verification fixes`
