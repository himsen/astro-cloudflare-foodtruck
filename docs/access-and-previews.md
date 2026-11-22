# Access and preview deployments

How to put `/admin` behind Cloudflare Access, and how to get a stable preview
URL that builds and deploys itself from git.

Everything here works **today**, without `chicksonwheels.dk`. The domain
transfer only blocks the public production hostname. Access does not need a
zone you own: a self-hosted application can point at a `*.workers.dev`
hostname, and the Zero Trust team domain (`<team>.cloudflareaccess.com`) is
handed out per account, not per domain.

Constants used below:

| Thing | Value |
| --- | --- |
| Account | `<your-cloudflare-login>` / `<your-account-id>` |
| Worker | `chicks-on-wheels` |
| workers.dev subdomain | `<your-subdomain>` |
| Production branch | `main` |
| Preview branch (below) | `preview` |
| Stable preview URL | `https://preview-chicks-on-wheels.<your-subdomain>.workers.dev` |

> **The preview shares production's data.** Workers has no per-environment
> bindings in git builds. A preview version binds to the same D1 database
> (`chicks_on_wheels`) and the same KV namespace as production. Editing the
> schedule from the preview's `/admin` edits the real schedule. Treat preview
> as "production code you have not deployed yet", not as a sandbox.

---

## 1. Enable Cloudflare Access

Access is part of Zero Trust. If the account has never used it, the first visit
walks through a one-time setup.

1. In the Cloudflare dashboard, open **Zero Trust**.
2. If prompted, **choose a team name**. This becomes your team domain —
   `<team>.cloudflareaccess.com` — and it is permanent in practice, so pick
   something plain like `chicksonwheels`. It is the value that goes into
   `ACCESS_TEAM_DOMAIN`.
3. Choose the **Free** plan when asked. It covers up to 50 users. A payment
   method may be requested even on the free plan; nothing is charged.
4. Go to **Settings → Authentication → Login methods**. Add at least one
   identity provider. **One-time PIN** is already there and needs no setup: the
   user types an email address and receives a code. That is enough for a
   one-person admin screen — you do not need Google or GitHub SSO.

Confirm the team domain under **Settings → Custom Pages**, or in the URL of the
Zero Trust dashboard. Write it down; you need it in step 2.

Sanity check that it resolves:

```bash
curl -sI https://<team>.cloudflareaccess.com/cdn-cgi/access/certs | head -1
```

A `200` means the team exists and is publishing signing keys — the same keys
`src/lib/access.ts` fetches to verify tokens.

---

## 2. Create the Access application and its rules

### Which shape to use, and why

Access offers three shapes. This project wants the third:

| Shape | What it covers | Verdict here |
| --- | --- | --- |
| Protect one Worker (`worker` / `preview_worker` destination) | Every hostname of the Worker, all paths | Too broad — it would put the public schedule behind a login |
| Protect all Workers (`all_workers`) | Every Worker in the account | Too broad |
| **Self-hosted app on a hostname + path** | Exactly the URLs you list | **Use this** |

Use **one application with several destinations**, not one per environment.
`src/lib/access.ts:47` verifies the token against exactly one audience, and
`ACCESS_AUD` is a single value in `wrangler.jsonc` shared by production and
preview builds. Two applications would mean two AUD tags and one of the two
environments would always fail. One application has one AUD tag no matter how
many destinations you add.

### Create it

1. **Zero Trust → Access controls → Applications → Add an application →
   Self-hosted**.
2. **Application name**: `Chicks on Wheels admin`.
3. **Session duration**: 24 hours is reasonable. This is how long a sign-in
   lasts before the owner has to re-enter a PIN.
4. **Public hostname** — add the preview destination now:

   | Field | Value |
   | --- | --- |
   | Subdomain | `preview-chicks-on-wheels` |
   | Domain | `<your-subdomain>.workers.dev` |
   | Path | `admin` |

   `/admin` is the only admin route — a single page whose forms post back to
   itself — so one path entry covers it. If admin sub-routes are added later,
   check *Application paths* in the Cloudflare docs for the wildcard syntax.
5. **Add production later, to this same application** (see below).
6. Continue to policies.

### The policies

An application with no policy denies everyone. Add one:

| Field | Value |
| --- | --- |
| Policy name | `Owner and developer` |
| Action | **Allow** |
| Include → Emails | the owner's address, and `<your-email>` |

Use **Emails**, not *Emails ending in* — `@gmail.com` would let in all of
Gmail. Add each person explicitly.

Do not add a Bypass policy. Bypass means no login, which is the same as having
no Access at all.

### Wire it into the Worker

Open the application and copy the **Application Audience (AUD) Tag** (64 hex
characters) from its overview. Then edit `wrangler.jsonc`:

```jsonc
"vars": {
  "ACCESS_TEAM_DOMAIN": "<team>.cloudflareaccess.com",
  "ACCESS_AUD": "<the 64-hex AUD tag>"
},
```

Both are non-secret identifiers — they belong in the repo, not in
`wrangler secret`. The middleware fails closed while either is empty
(`src/middleware.ts:35`), which is why `/admin` currently returns 403 to
everyone.

Commit and push. The build deploys them.

### Adding production, when the domain lands

Do **not** create a second application. Open the same one, **Add destination**:

| Field | Value |
| --- | --- |
| Subdomain | *(empty)* |
| Domain | `chicksonwheels.dk` |
| Path | `admin` |

Add `www.chicksonwheels.dk/admin` too if you route `www`. The AUD tag does not
change, so `ACCESS_AUD` stays as it is and no redeploy is needed.

Order matters: create the destination **before or in the same sitting as** the
custom domain route in `wrangler.jsonc`. Until the destination exists, requests
to `chicksonwheels.dk/admin` carry no Access token, and the middleware denies
them — the site fails closed, but the owner cannot get in either.

### Verifying

```bash
# No token: the middleware's own Danish 403 page.
curl -si https://preview-chicks-on-wheels.<your-subdomain>.workers.dev/admin | head -1

# In a browser: expect a Cloudflare sign-in page, then the admin screen.
```

If the browser signs you in but `/admin` still shows *Ingen adgang*, the token
is arriving and failing verification. Rather than guess, read the two values
Access itself is using straight out of the login redirect:

```bash
LOC=$(curl -sS -o /dev/null -D - \
  https://preview-chicks-on-wheels.<your-subdomain>.workers.dev/admin \
  | grep -i '^location:' | tr -d '\r' | sed 's/^[Ll]ocation: //')

python3 - "$LOC" <<'EOF'
import base64, json, sys, urllib.parse
loc = sys.argv[1]
q = urllib.parse.parse_qs(urllib.parse.urlparse(loc).query)
p = q['meta'][0].split('.')[1]; p += '=' * (-len(p) % 4)
d = json.loads(base64.urlsafe_b64decode(p))
print('ACCESS_TEAM_DOMAIN should be:', urllib.parse.urlparse(loc).netloc)
print('ACCESS_AUD should be        :', d['aud'])
print('covering hostname           :', d['hostname'])
EOF
```

Whatever it prints is what `wrangler.jsonc` must contain. Then, in order:

1. **`ACCESS_AUD` is the AUD tag, not an id.** The AUD tag is 64 hex
   characters. The application id and the policy id are dashed UUIDs
   (`028d4a0f-304d-…`), they sit right next to the AUD tag in the dashboard,
   and pasting either produces exactly this symptom: Access signs you in, the
   Worker refuses the token, no error anywhere says why. If the value in
   `wrangler.jsonc` has dashes in it, that is the bug.
2. `ACCESS_TEAM_DOMAIN` has no `https://` prefix and no trailing slash — the
   code builds the issuer as `https://` + the value. Check it against the
   hostname printed above, not against the one on an old screenshot: renaming
   the Zero Trust team changes this, and the old team domain stops resolving.
   `curl -sI https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` returns
   200 for the live one and 404 for a stale one.
3. The version carrying the new vars actually reached the hostname you are
   testing. A preview alias only moves when something uploads to it —
   `pnpm wrangler versions upload --preview-alias preview`, or a push to the
   `preview` branch. Editing `wrangler.jsonc` alone changes nothing.

---

## 3. Set up the stable preview URL

Preview URLs come in two forms. Both are `<something>-chicks-on-wheels.<your-subdomain>.workers.dev`:

* **Versioned** — `<first 8 chars of the version id>-…`. Created for every
  version, including every production deploy. Changes on every push.
* **Aliased** — `<alias>-…`. Stable. Workers Builds creates one automatically
  from the git branch name on non-production branch builds.

`main-chicks-on-wheels…` does not exist and never will: `main` is the
production branch, so its builds run `wrangler deploy`, which creates a
deployment, not an aliased version.

### Prerequisite: preview URLs must be enabled

`preview_urls` defaults to whatever `workers_dev` is. Ours is `false`, so
without an explicit setting every `wrangler deploy` silently turns preview URLs
back off — including a toggle you flipped in the dashboard. `wrangler.jsonc`
now pins it:

```jsonc
"workers_dev": false,
"preview_urls": true,
```

Leave `workers_dev` at `false`. That hostname would be a second unauthenticated
route to the site with no Access destination in front of `/admin`.

### Create the branch

```bash
git switch -c preview
git push -u origin preview
```

The alias is the branch name, so branch `preview` gives
`preview-chicks-on-wheels.<your-subdomain>.workers.dev` — the
hostname registered in step 2. Rename the branch and that Access destination
stops matching.

Alias rules: lowercase letters, numbers and dashes; must begin with a letter;
alias plus Worker name must be under 63 characters. `preview` (7) plus
`chicks-on-wheels` (16) is fine.

Working style: do the work on `preview`, look at it on the stable URL, then
merge to `main` to go to production.

```bash
git switch preview && git merge main    # keep it current
# ... work, push, look at the preview URL ...
git switch main && git merge preview && git push
```

### Uploading an alias by hand

Without git, or for a second alias:

```bash
pnpm build
pnpm wrangler versions upload --preview-alias preview
```

Aliases can only be set at upload time. `wrangler versions upload` creates a
version and **does not** change what production serves.

---

## 4. Configure Workers Builds to build and deploy previews

Worker → **Settings → Build**.

### Branch control

**Settings → Build → Branch control**:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Builds for non-production branches | **enabled** |

With this on, every push to any other branch builds and runs the
non-production deploy command. Off, only `main` ever builds.

### Commands

| Setting | Value |
| --- | --- |
| Build command | `pnpm build` |
| Deploy command | `pnpm wrangler d1 migrations apply chicks_on_wheels --remote && pnpm wrangler deploy` |
| Non-production branch deploy command | `pnpm wrangler versions upload` |

The non-production command deliberately **omits the migration step**. There is
only one database, so a preview branch applying migrations would be migrating
production from an unreviewed branch.

That means a preview branch carrying a new migration runs its code against the
un-migrated schema and will error. Handle it the way the runbook already
prescribes: apply additive migrations by hand first, ahead of the code —

```bash
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>
pnpm wrangler d1 migrations apply chicks_on_wheels --remote
```

— and only then push the branch that depends on them. Adding tables or nullable
columns is safe ahead of time; production is still running the old code, which
ignores them.

### GitHub pull request comments

With non-production builds enabled, opening a PR from `preview` to `main` gets
a comment carrying both the commit URL and the stable branch URL. Nothing to
configure; it comes with the GitHub integration that is already connected.

### Watching a build

Worker → **Deployments** (or **Settings → Build → Build history**) shows each
build with its log. A red build means nothing was uploaded — the previous
version keeps serving. Production is only ever changed by a `main` build or a
manual `pnpm deploy`.

---

## Verification checklist

After all four steps:

```bash
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>

# 1. The stable preview URL serves the site.
curl -s -o /dev/null -w '%{http_code}\n' \
  https://preview-chicks-on-wheels.<your-subdomain>.workers.dev/

# 2. Its /admin is closed to anonymous requests.
curl -s -o /dev/null -w '%{http_code}\n' \
  https://preview-chicks-on-wheels.<your-subdomain>.workers.dev/admin
# expect 302 to the Access login, or 403 from the middleware — never 200

# 3. The public workers.dev hostname is still off.
curl -sI https://chicks-on-wheels.<your-subdomain>.workers.dev | head -1
# expect a failure, not a page

# 4. The vars actually shipped.
pnpm wrangler versions list | head -20
```

Then, in a browser, open the preview `/admin`, sign in with the PIN, and
confirm the schedule editor loads.

## Turning it off again

* **Preview URLs**: set `preview_urls: false` in `wrangler.jsonc` and deploy.
  This kills both versioned and aliased URLs at once.
* **Preview builds**: uncheck *Builds for non-production branches*.
* **Access**: delete the destination from the application, or the whole
  application. Deleting the application does **not** reopen `/admin` — the
  middleware fails closed once no valid token arrives, which is the intended
  behaviour, not a bug to work around.
