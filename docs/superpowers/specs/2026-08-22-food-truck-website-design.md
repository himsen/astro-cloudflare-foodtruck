# Chicks on Wheels — Website Design

**Date:** 2026-08-22
**Status:** Approved

## 1. Purpose

A small public website for a local Danish food truck. Two audiences:

- **Customers** need to know where the truck is today, what it offers, and how to get in touch.
- **The owner**, who is not technically confident, needs to change the schedule herself without help and without any way to break the site.

Everything in this design is subordinate to the second point. Where simplicity and capability conflict, simplicity wins.

## 2. Scope

**In scope**

1. Public page showing where the truck is, today and for the coming week.
2. Public pages for services offered — the food truck, the pølsevogn, and events for companies and private customers.
3. Contact information.
4. An admin screen where the owner edits the weekly pattern, adds one-off exceptions, and sets a short news banner.

**Explicitly out of scope (YAGNI)**

- Online ordering or payment.
- A general-purpose CMS. Services copy, contact details, and images live in the repository and change when the owner asks.
- User accounts for customers.
- A mobile app.
- Multi-language. The site is Danish only (`da-DK`).

**Designed for, but not built now**

- Reservations — customers reserving a pickup slot.
- Notification signups — customers subscribing to schedule updates.

Section 12 records how each of these attaches without restructuring.

## 3. Technology decisions

| Concern | Decision | Why |
| --- | --- | --- |
| Framework | Astro 5 + TypeScript | Content-heavy site, ships zero JS by default, fast on a phone with poor signal. Supports UI-framework islands later if a reservation picker needs one. |
| Styling | Tailwind CSS v4 | Integrates via the Vite plugin, no config file needed. |
| Hosting | Cloudflare Workers with Static Assets, `@astrojs/cloudflare` adapter | Cloudflare's documented recommendation for new projects. Pages lacks Durable Objects, Cron Triggers, and full observability, all of which the deferred features want. |
| Database | Cloudflare D1 | SQLite at the edge, free at this volume, same store the future tables land in. |
| Migrations | `wrangler d1 migrations` with plain SQL | Three small tables. An ORM would be more machinery than schema. |
| Admin auth | Cloudflare Access | No authentication code to write or maintain. Recovery is a dashboard action, not a code change. |
| JWT verification | `jose` | Workers-compatible, handles JWKS fetching and validation. |
| Testing | Vitest, plus `@cloudflare/vitest-pool-workers` for anything touching D1 | Tests run in the real Workers runtime against a real local D1 rather than against mocks. |
| Package manager | pnpm | |
| CI/CD | Workers Builds, deploying on push to `main` | No pipeline to author. |
| DNS & domain | Cloudflare Registrar and DNS | Single account for domain, hosting, database, and Access. |

**Rejected:** React Native (there is no app), a React SPA (nothing here benefits from client-side routing), Cloudflare Pages (see above), a custom magic-link login (owning security-critical code for no gain).

## 4. Site structure

| Route | Rendering | Contents |
| --- | --- | --- |
| `/` | On demand (SSR) | News banner, today's location prominently, then the next six days. |
| `/ydelser` | Prerendered | Food truck, pølsevogn, company and private events. |
| `/kontakt` | Prerendered | Phone, email, social links, service area. |
| `/admin` | On demand, behind Access | The owner's editing screen. |
| `/api/admin/*` | On demand, behind Access | Form POST targets. |

Astro's Cloudflare adapter defaults to `output: 'server'`; prerendered pages are marked with `export const prerender = true`.

### Rendering and caching

The front page queries D1 on every request and is not cached. At this traffic that is trivially within D1's free tier, and it means an edit by the owner is visible immediately. Introducing a cache would add an invalidation step that, when it fails, shows customers a wrong location — the single worst failure this site can have. The trade is deliberate.

## 5. Data model

```sql
-- The recurring weekly pattern. Exactly seven rows, always present.
CREATE TABLE weekly_stops (
  weekday       INTEGER PRIMARY KEY,  -- 0 = Monday ... 6 = Sunday
  location_name TEXT,                 -- NULL means closed this weekday
  address       TEXT,
  map_url       TEXT,
  start_time    TEXT,                 -- 'HH:MM', 24-hour
  end_time      TEXT,                 -- 'HH:MM', 24-hour
  note          TEXT
);

-- One-off overrides. At most one per calendar date.
CREATE TABLE schedule_exceptions (
  date          TEXT PRIMARY KEY,     -- 'YYYY-MM-DD'
  is_closed     INTEGER NOT NULL DEFAULT 0,
  location_name TEXT,
  address       TEXT,
  map_url       TEXT,
  start_time    TEXT,
  end_time      TEXT,
  note          TEXT
);

-- Small key/value store for the banner.
CREATE TABLE site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);
-- Keys in use: 'banner_text', 'banner_until' ('YYYY-MM-DD', inclusive)
```

Notes:

- The seven `weekly_stops` rows are seeded by the initial migration and are only ever updated, never inserted or deleted. The owner cannot end up with a missing weekday.
- `date` as primary key means one exception per date. An owner saving a second exception for the same date replaces the first (`INSERT ... ON CONFLICT DO UPDATE`).
- Past exceptions are never deleted; queries filter to `date >= today`. Pruning is unnecessary at this scale.
- `banner_until` is inclusive and lets a banner expire on its own, so "Lukket uge 29" does not linger into August because the owner forgot it. The banner renders only when `banner_text` is non-empty **and** `banner_until` is today or later; a banner with no end date is not possible, since the form requires one whenever there is text.

## 6. Schedule resolution — the core logic

`src/lib/schedule.ts` exports a pure function:

```ts
resolveWeek(
  todayISO: string,          // 'YYYY-MM-DD' in Europe/Copenhagen
  stops: WeeklyStop[],
  exceptions: ScheduleException[]
): DayEntry[]                // exactly 7 entries, today first
```

No I/O, no clock access, no database. The caller supplies today's date; the function is fully deterministic and therefore cheap to test exhaustively.

Rules, in order:

1. Produce the seven dates from `todayISO` forward, inclusive — a rolling window, not a Monday–Sunday calendar week. A customer looking on Friday cares about the coming week, not about Monday, which has already passed.
2. For each date, start from the `weekly_stops` row for that weekday.
3. If a `schedule_exceptions` row exists for that date, it replaces the pattern entry entirely.
4. An entry is **closed** if the exception has `is_closed = 1`, or if no exception applies and the pattern row has `location_name IS NULL`.
5. Each `DayEntry` carries its date, weekday name, open/closed state, location fields, times, note, and a flag for whether an exception applied.

### Time zone

Workers run in UTC. "Today" must be computed in `Europe/Copenhagen` or the site will roll over to tomorrow's location at 22:00 or 23:00 local time depending on daylight saving.

The current date is obtained once, at the edge of the system, via
`new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' }).format(new Date())`,
which yields `YYYY-MM-DD` directly. Because `resolveWeek` receives that string rather than reading a clock, both the DST boundaries and the midnight rollover are ordinary unit tests.

## 7. Admin screen and authentication

### Access configuration

A single Cloudflare Access self-hosted application covers `/admin*` and `/api/admin*` on the production hostname. The policy allows the owner's email address. Session duration is 30 days, so she rarely re-authenticates.

### Verifying identity in the Worker

Access forwards a `Cf-Access-Jwt-Assertion` header. **This header is trusted only after verification.** Anything able to reach the Worker directly can forge it, so `src/lib/access.ts`:

- verifies the JWT signature against `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` using `jose`
- checks `iss` matches the team domain and `aud` matches the application's AUD tag
- returns the verified email, or rejects the request with 403

In addition, `workers_dev: false` in the Wrangler configuration removes the `*.workers.dev` hostname, so the Worker is only reachable behind Access on the real domain. Both measures are kept; neither alone is relied upon.

Configuration arrives as Worker vars `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, alongside the `DB` D1 binding.

### The screen

One page, three sections, each with its own save button:

1. **Ugeplan** — seven rows, Monday to Sunday. Each row has location name, address, map link, start time, end time, note, and a "Lukket" checkbox.
2. **Undtagelser** — upcoming exceptions listed with a delete button, plus a form to add one: date, "Lukket" or replacement location and times, note.
3. **Besked på forsiden** — banner text and a "vis til og med" date. Empty text means no banner.

Plain HTML forms posting to `/api/admin/*`. No client-side JavaScript is required for the screen to work — a submit is a normal form post and a full page render, which is the most robust thing available and cannot leave her staring at a spinner.

All labels, validation messages, and confirmations are in Danish. Type sizes are generous, buttons are large, and destructive actions (deleting an exception) confirm first.

### Validation

Server-side, in the endpoint, before touching D1:

- Times match `HH:MM` and end is after start.
- An open day requires a location name.
- Exception dates parse as real dates. Today is allowed; any earlier date is rejected with an explanatory message.
- Banner text has a maximum length. When banner text is present, `banner_until` is required and must be today or later. Clearing the text clears both keys.

Failures re-render the form with the submitted values preserved and the error shown next to the offending field. The owner never loses typing.

## 8. Project layout

```
src/
  pages/
    index.astro
    ydelser.astro
    kontakt.astro
    admin/index.astro
    api/admin/weekly.ts
    api/admin/exceptions.ts
    api/admin/banner.ts
  lib/
    schedule.ts      pure resolution logic
    db.ts            all D1 queries
    access.ts        Access JWT verification
    validate.ts      shared form validation
  components/        Astro components
  content/           services copy as markdown
migrations/          numbered SQL files
tests/
```

Each `lib` module has one job and is testable without the others. `db.ts` is the only module that knows SQL; `schedule.ts` is the only one that knows the resolution rules; `access.ts` is the only one that knows about authentication.

## 9. Testing

| Layer | Tool | Coverage |
| --- | --- | --- |
| `lib/schedule.ts` | Vitest, plain | The bulk of the suite. Pattern-only weeks, exception overrides, closed days from both sources, the rolling window crossing a month and a year boundary, DST transitions in March and October. |
| `lib/validate.ts` | Vitest, plain | Each rejection rule, and that valid input passes. |
| `lib/db.ts` and API routes | Vitest + `@cloudflare/vitest-pool-workers` | Real local D1 with migrations applied in setup. Round-trip writes, the exception upsert-on-same-date path, and that unauthenticated requests to `/api/admin/*` are rejected. |
| End to end | Deferred | Playwright arrives with the reservation flow, where it earns its keep. |

## 10. Deployment

- Workers Builds is connected to the GitHub repository and deploys on push to `main`.
- The deploy command applies migrations before deploying:
  `pnpm build && wrangler d1 migrations apply chicks_on_wheels --remote && wrangler deploy`
- Observability is enabled in the Wrangler configuration.
- `compatibility_flags` includes `nodejs_compat`.
- The domain is registered and served through Cloudflare, with Access configured on the production hostname.

Expected cost: zero. Workers, D1, and Access all sit within their free tiers at this traffic, with the domain registration the only recurring charge.

## 11. Failure behaviour

- **D1 unavailable on the front page.** The page renders the services and contact content with a Danish notice that the schedule is temporarily unavailable, and the phone number. It does not show a stale or blank schedule that a customer might act on.
- **No exception and a closed pattern day.** Renders as "Lukket" rather than as an empty row.
- **Expired banner.** Filtered out at render time by comparing `banner_until` to today in Copenhagen.
- **Access misconfiguration.** JWT verification failing returns 403 with a plain instruction to contact the site maintainer, never a stack trace.

## 12. Future extensions

Neither deferred feature requires restructuring.

**Reservations.** A `reservations` table keyed by date and slot, with a capacity column on the stop. The booking endpoint validates against the resolved schedule, so a reservation cannot be made for a closed day. If double-booking under genuine concurrent load proves to be a real problem — unlikely at this scale — a Durable Object per date-slot provides serialised capacity checks. That option exists because the site is on Workers rather than Pages.

**Notifications.** A `subscribers` table with a confirmation token, Cloudflare Email Service for delivery, and a Cron Trigger for a weekly "here is where we are" message. Exception writes are the natural hook for an out-of-band "we have changed location" alert.

## 13. Content needed from the owner

Not design gaps — inputs required before launch:

- Services copy for the food truck, the pølsevogn, and event catering.
- Contact details and any social media links.
- Photographs.
- The current weekly pattern, to seed the seven rows.
- The email address that Access should admit.
