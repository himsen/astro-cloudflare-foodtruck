> Superseded by docs/superpowers/specs/2026-11-21-warm-photo-restyle-design.md (2026-11-21).

# Design brief — prompt to kick off UI work

Paste everything below the line into a fresh session.

---

I want you to redesign the look of the Chicks on Wheels website. The site works;
it just looks terrible. Read this whole brief before touching anything.

## What the site is

A Danish food truck's website. `chicksonwheels.dk`. Two vehicles: a chicken food
truck, which is the main business, and a **pølsevogn** (classic Danish hot dog
wagon). They also do catering for company and private events.

Three public pages plus an admin screen:

| Path | Purpose |
| --- | --- |
| `/` | Where the truck is today, then the next six days. The reason people visit. |
| `/ydelser` | Services — food truck, pølsevogn, company and private events |
| `/kontakt` | Phone, email, service area |
| `/admin` | The owner edits the weekly schedule, one-off exceptions, and a front-page banner |

All copy is Danish and must stay Danish. Do not translate anything, and do not
rewrite the copy unless the brief below asks you to.

Read `architecture.md` for how it fits together. `README.md` explains how to run
it locally, including seeding the database so the front page has something to
show — a fresh database renders every day as "Lukket", which is correct but
useless for design work.

## The problem

The current design is generic AI slop. That is the actual complaint, and it is
worth being precise about what makes it so, because the fix is not "add more
polish to the same thing."

Evidence, from the current code:

- The entire palette is Tailwind `stone-*` plus white. Grep it: `text-stone-600`,
  `text-stone-500`, `bg-white`, `border-stone-200`, `bg-stone-900`. There is no
  brand colour anywhere. `amber`, `green` and `red` appear only as status tints.
- `src/styles/global.css` is one line: `@import "tailwindcss";`. No design
  tokens, no typography, no identity.
- Every block of content is a `rounded-lg` card, white, with a hairline border,
  stacked vertically inside a centred `max-w-2xl` column.
- Default system font stack. No typographic voice at all.

That combination — neutral greys, rounded cards, centred column, system fonts,
even vertical rhythm with no hierarchy — is the house style of generated
websites. It reads as nobody-made-this.

Things to avoid, explicitly:

- `stone` / `slate` / `zinc` / `gray` as the primary palette
- Rounded rectangles containing everything
- A single centred column as the only layout idea
- System font stacks
- Gradient-on-dark hero sections
- Emoji standing in for icons
- Decorative blur blobs, glassmorphism, or a "shadcn-looking" card grid

## What it should feel like

Street food, not software. This is a small local business run by one person, in
Denmark. It should feel handmade, warm, and a bit loud — the visual equivalent
of a hand-painted sign on the side of a van. Think chicken-shop signage, Danish
hot dog stands, festival food stalls, enamel signs, screenprint.

It should be obviously *not* a template. Someone glancing at it should be able
to tell there is a person behind it.

Do not sacrifice legibility for style. See the hard constraints.

## Art and illustration

I want cartoon illustrations: **the chicken food truck, the pølsevogn, and the
owner herself.** The chicken truck is the hero — the pølsevogn is secondary.

Nobody has drawn these yet, and you cannot generate raster images. So:

1. **Design the slots.** Decide where illustrations go, at what aspect ratios,
   and what each one needs to communicate. Build real placeholders that are
   pleasant to look at on their own — not grey boxes with a cross through them.
   The site should look finished today and better later.
2. **Where you can author art directly, do.** Inline SVG you write by hand is
   fair game and encouraged: pattern fills, a chequer or awning stripe, a badge
   or roundel, a chicken silhouette, arrows, a route squiggle, hand-drawn
   dividers, a halftone texture. This is how you get personality in without
   commissioned art.
3. **Write down what to commission.** Produce a short list at
   `docs/illustrations.md`: each image, its purpose, aspect ratio, and a
   description good enough to hand to an illustrator or an image model.

Photographs will also appear eventually — the food, the truck at a location.
Design slots for those too.

Technical notes for images:

- The Cloudflare `IMAGES` binding is already configured. `<Image />` from
  `astro:assets` works with no further setup.
- Local images belong in `src/assets/` so they get hashed and optimised.
- The free tier covers 5,000 unique transformations per month, which is far more
  than this site will use.

## Hard constraints — do not break these

These are not style preferences. Breaking one is a bug.

1. **Mobile first, outdoors.** The main use is someone on a phone at midday
   deciding whether to walk over. Possibly in sunlight. High contrast, large
   type, no horizontal scrolling at any width.
2. **The front page answers one question fast:** where is the truck *today*.
   Today must dominate. The next six days are secondary. A closed day must
   clearly read `Lukket` — never an empty row.
3. **`/admin` must stay usable by someone who is not technical.** Big touch
   targets, plain Danish labels, visible focus states, errors in red next to the
   field they belong to. You may restyle it. Do not make it clever, and do not
   make anything smaller or lower contrast.
4. **Everything works with JavaScript disabled.** The only script on the site is
   one inline `confirm()` on the admin delete button. Do not add client-side JS
   for anything load-bearing. Decorative enhancement is fine if it degrades.
5. **`/ydelser` and `/kontakt` stay prerendered.** No per-request work, no
   runtime data fetching on those pages.
6. **The front page stays `Cache-Control: no-store`.** A stale schedule sends
   customers to the wrong place.
7. **Accessibility.** Meet WCAG AA contrast. Keep the `aria-current` on the
   current nav link, keep form labels bound to inputs, keep `aria-invalid` and
   `aria-describedby` on errored fields. Do not remove focus outlines without
   replacing them with something at least as visible.
8. **Danish copy stays.** Including error messages, which are tested by string.

## Tech

Astro 7, Tailwind v4, deployed on Cloudflare Workers.

Tailwind v4 has **no `tailwind.config.js`**. Define design tokens with `@theme`
in `src/styles/global.css`. That file is currently a bare import and is where
your palette, type scale and any custom tokens belong.

Fonts: self-host or use the system stack deliberately. Do not add a webfont
without checking what it costs in bytes on a phone.

Files you will most likely touch:

```
src/styles/global.css        design tokens — start here
src/layouts/Base.astro       page shell
src/components/Nav.astro     nav, has aria-current logic
src/components/Footer.astro
src/components/DayCard.astro     one day in the schedule
src/components/BannerNotice.astro
src/pages/index.astro        the front page
src/pages/ydelser.astro      + src/content/ydelser.md
src/pages/kontakt.astro
src/components/admin/*       Field.astro, StopRow.astro
src/pages/admin/index.astro
```

## Different hardware

The website should scale for both wide screens, normal screens, laptops, tablets, and mobile phones.

## How I want you to work

**Do not start editing.** First, show me two or three genuinely different art
directions — different palettes, different type pairings, different layout
ideas, different illustration styles. Distinct approaches, not one idea in three
shades. Show them as something I can actually look at, and say what each is
going for in a sentence.

Once I pick one, implement it across all four pages plus the admin screen.

## Verification

Before you tell me it is done:

```bash
pnpm test:all      # 71 tests must still pass (54 unit + 17 worker)
pnpm astro check   # must report 0 errors
pnpm build
```

Then actually look at the result — run the dev server, seed the database per
`README.md`, and check `/`, `/ydelser`, `/kontakt` and `/admin` at a narrow
phone width and at desktop width. Confirm:

- no horizontal scrolling at 320px
- today's card is unmistakably the most prominent thing on `/`
- a closed day reads `Lukket`
- the admin form still shows errors next to their fields, with the typed values
  preserved
- the nav marks the current page on both prerendered and server-rendered pages

Report what you changed and what you saw, not just that it built.
