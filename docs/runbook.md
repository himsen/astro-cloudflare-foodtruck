# Runbook

Operational notes for the Chicks on Wheels site.

Cloudflare account: `<your-cloudflare-login>`
(`<your-account-id>`). The same login also reaches another,
unrelated account — never deploy this project there.

## Deploying

Deploys are git-connected. Push to `main` and Cloudflare Workers Builds builds
and deploys.

Worker → Settings → Build:

| Setting | Value |
| --- | --- |
| Build command | `pnpm build` |
| Deploy command | `pnpm wrangler d1 migrations apply chicks_on_wheels --remote && pnpm wrangler deploy` |
| Non-production branch deploy command | `pnpm wrangler versions upload` |
| Production branch | `main` |
| Builds for non-production branches | enabled — see *Preview deployments* below |

To deploy by hand — for an emergency, or to test before pushing:

```bash
pnpm deploy
```

That runs the same three steps: build, apply remote migrations, deploy.

## Database migrations

**Migrations are not applied by pushing code.** They run as part of the deploy
command above, or by hand.

Add a schema change as a new numbered file in `migrations/`. Never edit a
migration that has already been applied.

```bash
pnpm wrangler d1 migrations list chicks_on_wheels --remote    # what is pending
pnpm wrangler d1 migrations apply chicks_on_wheels --remote   # apply it
```

Apply a migration **before** the code that depends on it goes live. A migration
that only adds tables or nullable columns is safe to apply ahead of time.

### If wrangler asks which account to use

`d1 migrations list` does not read `account_id` from `wrangler.jsonc` and fails
with *"More than one account available but unable to select one in
non-interactive mode."* (`d1 migrations apply` and `d1 execute` do read it, so
`pnpm deploy` is unaffected.) Set it explicitly:

```bash
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>
```

Check the id before running anything with `--remote`. The other account in the
list is unrelated.

## Rolling back a bad deploy

```bash
pnpm wrangler versions list                    # 10 most recent
pnpm wrangler rollback <version-id> -m "why"
```

Or pick a previous version under the Worker's **Deployments** tab.

**A rollback does not undo a database migration.** If the bad deploy also
migrated the schema, roll the code back first, then write a new migration to
correct the data. Never delete a row from `d1_migrations` to "re-run" one.

## Inspecting the database

```bash
pnpm wrangler d1 execute chicks_on_wheels --remote --command \
  "SELECT * FROM weekly_stops ORDER BY weekday"

pnpm wrangler d1 execute chicks_on_wheels --remote --command \
  "SELECT * FROM schedule_exceptions ORDER BY date"

pnpm wrangler d1 execute chicks_on_wheels --remote --command \
  "SELECT * FROM site_settings"
```

Drop `--remote` to hit the local development database instead. **Every command
without `--remote` is local; every command with it edits production.**

### Repairing the schedule by hand

The owner normally does all of this from `/admin`. Direct SQL is for when she
cannot get in.

`weekly_stops` must always hold exactly seven rows, weekday `0` (Monday) to `6`
(Sunday). Update them; never insert or delete.

```bash
# Close a weekday
pnpm wrangler d1 execute chicks_on_wheels --remote --command \
  "UPDATE weekly_stops SET location_name=NULL, address=NULL, start_time=NULL, end_time=NULL WHERE weekday=6"

# Set a weekday
pnpm wrangler d1 execute chicks_on_wheels --remote --command \
  "UPDATE weekly_stops SET location_name='Torvet', address='Torvet 1', start_time='11:00', end_time='14:00' WHERE weekday=0"

# Remove a one-off exception
pnpm wrangler d1 execute chicks_on_wheels --remote --command \
  "DELETE FROM schedule_exceptions WHERE date='2026-08-24'"

# Clear the front-page banner
pnpm wrangler d1 execute chicks_on_wheels --remote --command \
  "UPDATE site_settings SET value='' WHERE key IN ('banner_text','banner_until')"
```

Times are `HH:MM`, 24-hour. Dates are `YYYY-MM-DD`. The front page reads the
database on every request, so changes appear immediately.

## Logs

```bash
pnpm wrangler tail
```

Observability is enabled on the Worker, so recent invocations are also visible
under the Worker's **Logs** tab in the dashboard.

## Changing site text

Services copy is the lists at the top of `src/pages/ydelser.astro`. Contact details are
`src/pages/kontakt.astro`. Edit and push to `main`.

## When the schedule will not load

The front page shows *"Planen kan ikke vises lige nu."* with a phone number when
it cannot read D1. That is the intended fallback, not a crash — it never shows a
blank or stale week, because a customer could drive to it.

Check, in order:

1. `pnpm wrangler d1 execute chicks_on_wheels --remote --command "SELECT 1"` — is
   the database reachable?
2. `pnpm wrangler tail` — the page logs `Failed to load schedule` with the cause.
3. The `DB` binding under the Worker's **Settings → Bindings**.

## Preview deployments

Pushes to `main` deploy to production. Pushes to any other branch build a
version and publish it at a stable preview URL named after the branch —
`preview-chicks-on-wheels.<your-subdomain>.workers.dev` for the
`preview` branch. Production is untouched.

**A preview version binds to the same D1 database and KV namespace as
production.** Editing the schedule from a preview `/admin` edits the real
schedule.

Setup, and the reasoning behind it, is in `docs/access-and-previews.md`.

## Access and /admin

Cloudflare Access sits in front of `/admin`; the Worker verifies the token
Access attaches. Setting it up — the application, the destinations, the
policies — is in `docs/access-and-previews.md`. Day-to-day:

### Giving someone else access to /admin

**Zero Trust → Access controls → Applications → Chicks on Wheels admin →
Policies**, add the email address to the Allow policy. It takes effect at once.
No deploy, no code change.

That is enough only if they have a Cloudflare account. Zero Trust organisations
created after mid-2026 get the Cloudflare identity provider as their only login
method, so anyone else needs **one-time PIN** — a code mailed to the address
they type on the login page. Add it once, under **Zero Trust → Integrations →
Identity providers → Add new identity provider → One-time PIN**, then make sure
the application's **Authentication** tab either accepts all identity providers
or has One-time PIN ticked alongside Cloudflare.

There is no separate allowlist for OTP: the Allow policy is the allowlist. An
address that is not in it receives no mail, while the login page still says
*A code has been emailed to you* — by design, so "she never got a code" almost
always means the address is missing from the policy or spelled differently
there. Codes expire after 10 minutes.

Remove access the same way. A removed email keeps its existing session until it
expires, so for an urgent removal also use **Zero Trust → Logs → Access** to
confirm they are out, or shorten the application's session duration.

### When the owner cannot log in

1. Is the email in the Allow policy, spelled exactly? The policy matches the
   address, not the person.
2. **Zero Trust → Logs → Access** lists every allowed and refused attempt with
   the reason. This answers most questions in one look.
3. Did she open the link in a private window? Those lose the session every time
   and force a new PIN.
4. Is she at the right hostname? A destination covers one hostname; the
   preview URL and the production domain are separate entries on the
   application.

### /admin returns 403 for everyone

`/admin` fails closed. It returns 403 when `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD`
is empty, as well as when a token is missing or invalid — an unconfigured site
denies rather than admits.

Both variables are set in `wrangler.jsonc` and take effect on the next deploy.
Cloudflare Access itself is configured separately, in Zero Trust.

If sign-in succeeds but the page still shows *Ingen adgang*, the token is
arriving and failing verification. The usual cause is `ACCESS_AUD` holding the
application id or the policy id — both dashed UUIDs — instead of the
**Application Audience (AUD) Tag**, which is 64 hex characters. A dash in that
value is the bug. `docs/access-and-previews.md` has a snippet that reads the
correct audience and team domain out of the Access login redirect.
