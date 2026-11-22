# Pending follow-up

## To go live

All the code is written and deployed. What remains is configuration, most of it
in the Cloudflare dashboard.

### 1. Connect the repo to Workers Builds — DONE

Connected. Settings recorded below for reference; the first build runs on the
next push to `main`.

| Setting | Value |
| --- | --- |
| Build command | `pnpm build` |
| Deploy command | `pnpm wrangler d1 migrations apply chicks_on_wheels --remote && pnpm wrangler deploy` |
| Branch | `main` |

Pushes to other branches run `wrangler versions upload` instead — a preview
version, not a production deploy, and no migrations.

### 2. Get the domain onto Cloudflare

**Blocked on the `chicksonwheels.dk` transfer from the current owner.**

Cloudflare Registrar does not appear to support `.dk` — it is administered by
DK Hostmaster through accredited Danish registrars. Expect to leave the domain
at a Danish registrar and use Cloudflare only for DNS:

1. Add `chicksonwheels.dk` in the Cloudflare dashboard (**Domains** →
   **Onboard a domain**), free plan.
2. Change the nameservers at the current registrar to the two Cloudflare gives
   you. Propagation is usually under an hour.
3. Confirm the zone shows **Active** before continuing.

### 3. Point the Worker at the hostname

Add to `wrangler.jsonc`:

```jsonc
  "routes": [
    { "pattern": "chicksonwheels.dk", "custom_domain": true },
    { "pattern": "www.chicksonwheels.dk", "custom_domain": true }
  ],
```

A custom domain creates the DNS record itself — no manual A/CNAME needed.

Leave `workers_dev: false` as it is. It removes the `*.workers.dev` hostname,
which would otherwise be an unauthenticated route straight to `/admin`, past
Cloudflare Access.

### 4. Create the Access application

**Not blocked by the domain.** This note used to claim Access needed a zone we
own. It does not: a self-hosted application can point at a `*.workers.dev`
hostname, and the Zero Trust team domain is per account. The application can be
created today against the preview URL, and `chicksonwheels.dk/admin` added to
it as a second destination when the domain lands.

Full instructions, including the policy rules and the reason for using one
application with several destinations rather than one per environment:
**`docs/access-and-previews.md`**.

Still true: do step 3 in the same sitting as adding the production destination.
Until that destination exists, `/admin` on the real domain returns 403 to
everyone — it fails closed — so the admin screen is never exposed, but the
owner cannot get in either.

### 5. Fill in the Access values

In `wrangler.jsonc`, replace the empty strings:

```jsonc
  "vars": {
    "ACCESS_TEAM_DOMAIN": "<your-team>.cloudflareaccess.com",
    "ACCESS_AUD": "<the AUD tag from step 4>"
  },
```

Neither is a secret — the AUD tag is an identifier, not a credential — so `vars`
is correct and `wrangler secret` is unnecessary.

### 6. Replace the placeholder contact details

Real phone number and email are still needed. Four lines, two files:

- `src/pages/kontakt.astro` — `phone`, `phoneHref`, `email` (3 lines)
- `src/pages/index.astro` — the phone number in the D1-failure fallback (1 line)

Confirm nothing is left:

```bash
grep -rn "12 34 56 78\|12345678\|hej@chicksonwheels.dk" src/
```

Expect no matches. Also drop the "Phone and email are still placeholders" note
from the page table in `README.md` — it does not contain the values themselves,
so the grep above will not catch it.

The company's own details in the same file are filled in: `VIRKSOMHED`
(*Kvik Kyllinger*) and `CVR` render in the footer on every page, which is what
e-handelsloven asks for, and `SMILEY_URL` points at the kontrolrapporter from
/kontakt, which is what the fødevare rules ask for.

`INDEHAVER` is **Tonny Høhrmann** (corrected 2026-11-21; it was wrongly
*Jørgensen*). If he registers as *Hoehrmann*, use that — the name that matters
is the one on the CVR registration.

### 7. Seed the real weekly pattern — DONE, approximately

`migrations/0002_seed_weekly_stops.sql` filled the production database with the
pattern that was in the local development database on 2026-08-23: Børkop,
Skærbæk, Fredericia and Erritsø, 15:00–18:30, Tuesday to Friday. Monday,
Saturday and Sunday are closed.

It is approximate. The owner should confirm it at `/admin`, which doubles as
her first walkthrough of the screen — and must fix the map links for Børkop and
Skærbæk, which were left empty because the local values were placeholders.

### 8. Verify

```bash
curl -sI https://chicksonwheels.dk/admin | head -1
```
Expect `HTTP/2 302` to the Access login. **A `200` means Access is not in front
of the path** — stop and fix the application's hostname and path before going
further.

```bash
curl -s https://chicksonwheels.dk/ | grep -q "Hvor er vi" && echo ok
```
Expect `ok`.

```bash
curl -sI https://chicks-on-wheels.<subdomain>.workers.dev | head -1
```
Expect a failure to resolve, never a page. This confirms `workers_dev: false`
closed the unauthenticated route past Access.

### 9. Add the Access sections to the runbook — DONE

`docs/runbook.md` now has *Preview deployments* and *Access and /admin*, and
`docs/access-and-previews.md` holds the setup itself.

---

## Design and feature ideas

Not planned or scoped yet.

- Add button named "Find Vej" that spawns a map or some way of figuring out exactly where

- Add a button explaining the concept (pre-order, etc)

- Add menu

- Add CTA for company and private events. And make it clear that there is also a polesevogn. I.e. the home page should have pictures of both. But the chicken food truck is the main one.

- Images: the `IMAGES` binding is already wired, and `<Image />` from
  `astro:assets` will work with no further configuration. Local images go in
  `src/assets/`. Free tier covers 5,000 unique transformations per month.

- Art to commission: [`docs/illustrations.md`](docs/illustrations.md) lists every
  drawing and photo slot with its ratio, where it appears and what it has to
  show. Each one already has hand-drawn placeholder art in `src/components/art/`,
  so none of it blocks going live — the front page shows the truck and the
  pølsevogn today, with the truck twice the size.

---

## Later features

From the original brief, deliberately out of scope for the first version:

- **Reservations** — customers reserve a spot to pick up food
- **Notification signups** — customers subscribe to hear where the truck is

The schedule is already modelled per date, which is what a reservation would
need to attach to.
