# Chicks on Wheels Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Danish food truck website where customers see the truck's location for the coming week and the owner edits that schedule herself through a screen she cannot break.

**Architecture:** One Astro project deployed as a single Cloudflare Worker. Public pages are server-rendered from D1 (schedule) or prerendered (services, contact). The `/admin` screen is guarded by Cloudflare Access; the Worker verifies the Access JWT rather than trusting its header. All schedule logic lives in a pure function that takes today's date as an argument, so it is fully unit-testable without a clock or a database.

**Tech Stack:** Astro 5, TypeScript, Tailwind CSS v4, Cloudflare Workers (`@astrojs/cloudflare`), Cloudflare D1, Cloudflare Access, `jose`, Vitest with `@cloudflare/vitest-pool-workers`, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-22-food-truck-website-design.md`

**Platform notes (verified against the installed packages on 2026-08-22 — do not "fix" these back):**

This project runs Astro 7.2.4 with `@astrojs/cloudflare` 14.2.3, which is built on
`@cloudflare/vite-plugin`. That generation differs from Cloudflare's published Astro
framework guide, which still describes the 12.x line. Concretely:

- **Build output is `dist/client/` (static assets) + `dist/server/entry.mjs` (the Worker).**
  There is no `dist/_worker.js/index.js`. Anything expecting that path is wrong.
- **`main` in the root `wrangler.jsonc` is `@astrojs/cloudflare/entrypoints/server`**, a real
  package export. The vite plugin validates that `main` exists when it resolves config, so a
  path that only appears after a build fails immediately.
- **The build writes `dist/server/wrangler.json`**, merging the root config with resolved
  paths (`main: entry.mjs`, `assets.directory: ../client`). `wrangler deploy` from the project
  root redirects to it automatically. The root config's `assets.directory` is therefore not
  what actually ships — do not rely on it when pointing other tools at the root config.
- **`platformProxy` is no longer an adapter option.** The vite plugin supplies local bindings
  directly. `output: 'server'` must now be set explicitly in `astro.config.mjs`; this major no
  longer forces it, and without it the site builds fully static and emits no Worker at all.
- **`Astro.locals.runtime.env` has been REMOVED.** The adapter's getter throws:
  *"Astro.locals.runtime.env has been removed in Astro v6."* The `Runtime` type is still exported,
  so this does not show up as a type error unless you look — verified by reading
  `node_modules/@astrojs/cloudflare/dist/utils/cf-helpers.js`. Get bindings with
  **`import { env } from 'cloudflare:workers'`** at module scope instead. Likewise
  `locals.runtime.cf` → `Astro.request.cf`, `locals.runtime.caches` → the global `caches`,
  `locals.runtime.ctx` → `Astro.locals.cfContext`.
- **Astro rejects cross-site form POSTs by default** (`security.checkOrigin`). A POST without a
  matching `Origin` header gets `403 Cross-site POST form submissions are forbidden` before it
  reaches the page. Browsers always send `Origin` on form submissions, so the admin forms work
  normally and get CSRF protection for free — but any script or `curl` testing a POST must send
  `-H 'Origin: <site origin>'` or it will look like an auth failure when it is not.
- **`exports.default` from `cloudflare:workers` is untyped by default.** `Cloudflare.Exports`
  derives from `Cloudflare.GlobalProps["mainModule"]`, which is empty unless the project declares
  it. `tests/worker/env.d.ts` declares `mainModule: { default: ExportedHandler<Env> }` — types
  only; the runtime call always worked.
- **TypeScript is pinned to `^6.0.3` on purpose.** `typescript@latest` is now the native Go
  compiler (7.x), which does not yet expose the programmatic API `astro check` needs. Do not
  bump it until Astro's tooling supports TS 7.
- **`env` and `SELF` from `cloudflare:test` are deprecated in 0.22.** Use
  `import { env } from 'cloudflare:workers'` instead, and replace `SELF.fetch(...)` with
  `import { exports } from 'cloudflare:workers'` + `exports.default.fetch(...)`. Keep importing
  `applyD1Migrations` from `cloudflare:test`; it is not deprecated.
- **Test-only bindings are typed by augmenting `Cloudflare.Env`, not `ProvidedEnv`.** See
  `tests/worker/env.d.ts`. Write the augmentation with an inline `import('cloudflare:test').X`
  type rather than a top-level import, or the file becomes a module and the namespace merge
  silently stops applying.
- **`@types/node` is required** — `vitest.workers.config.ts` uses `node:path` and
  `import.meta.dirname`. Without it `astro check` reports errors that look like they belong to
  whichever task ran last.
- **Worker-test storage is isolated per test FILE, not per test.** Rows written by one `it()`
  are visible to later `it()`s in the same file. Assert on the specific rows a test cares about;
  never assert a table is empty, or the test silently depends on what ran before it.
- **`@cloudflare/vitest-pool-workers` 0.22 reworked its config API for Vitest 4.** There is no
  `@cloudflare/vitest-pool-workers/config` subpath and no `defineWorkersConfig`. Import
  `cloudflareTest` and `readD1Migrations` from the package root; `cloudflareTest(options)` returns
  a **Vite plugin** that goes in `plugins: []`. The pool must be given
  `main: './dist/server/entry.mjs'` explicitly — it resolves `main` from the wrangler config as a
  file path, so the package-export value fails. Worker tests therefore require a build first, which
  is why `test:worker` runs `astro build`. Verified working: real D1, migrations applied per file,
  storage isolated between files.
- The adapter auto-provisions a KV namespace bound as `SESSION` for Astro sessions, and an
  `IMAGES` binding. Both appear in the deployed Worker even though this project does not use
  them. Harmless and free at this scale.

**Cloudflare account:** The developer's own account, `<your-account-id>`. This login also reaches another, unrelated account (`<other-account-id>`), which belongs to a separate commercial product and must never receive resources from this project. Task 0 Step 0 confirms the account before anything is created. Run every wrangler command as `pnpm wrangler` — the global install on this machine is far behind.

**Deviation from spec:** The spec placed admin form handlers at `/api/admin/*`. This plan handles POST inside `src/pages/admin/index.astro` instead. Rationale: a validation failure can then re-render the form with the owner's submitted values intact, which a separate endpoint cannot do without stashing state in a cookie; and Cloudflare Access guards one path rather than two. Everything else follows the spec.

---

### Task 0: Project scaffold

**Goal:** An Astro + TypeScript + Tailwind project that builds for Cloudflare Workers, with both Vitest configurations in place.

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `wrangler.jsonc`, `worker-configuration.d.ts`, `src/env.d.ts`, `src/styles/global.css`, `vitest.config.ts`, `vitest.workers.config.ts`, `.gitignore` (append)

**Acceptance Criteria:**
- [ ] `pnpm build` produces `dist/server/entry.mjs` and `dist/client/` assets
- [ ] `pnpm astro check` reports no type errors
- [ ] Tailwind classes apply on a page
- [ ] `node_modules`, `dist`, `.astro`, and `.wrangler` are git-ignored

**Verify:** `pnpm build && pnpm astro check` → build succeeds, `0 errors`

**Steps:**

- [ ] **Step 0: Confirm the Cloudflare account**

```bash
npx --yes wrangler@latest whoami
```

Expected: two accounts listed. Everything this project creates belongs to
`<your account>`
(`<your-account-id>`).

The other account (`<other-account-id>`) belongs to an unrelated
commercial product. Nothing from this project may land there. The `account_id`
pinned in `wrangler.jsonc` in Step 4 is what enforces that — wrangler will not
guess between two accounts, so a missing pin is an error rather than a silent
deploy to the wrong place.

Optionally bind a directory-scoped auth profile as defence in depth (beta, needs
wrangler ≥ 4.125):

```bash
npx --yes wrangler@latest auth create chicks
npx --yes wrangler@latest auth activate chicks .
```

- [ ] **Step 1: Create package.json and install**

`pnpm create astro` is interactive and its flags drift between versions. An Astro
project is only dependencies plus two config files, so write them directly — the
result is identical and reproducible.

`package.json`:

```json
{
  "name": "chicks-on-wheels",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "check": "astro check",
    "test": "vitest run",
    "test:worker": "vitest run -c vitest.workers.config.ts",
    "test:all": "vitest run && pnpm test:worker",
    "deploy": "astro build && wrangler d1 migrations apply chicks_on_wheels --remote && wrangler deploy"
  }
}
```

Then install. Let pnpm resolve current versions rather than pinning ones that may
already be stale:

```bash
cd .
pnpm add astro @astrojs/cloudflare tailwindcss @tailwindcss/vite jose
pnpm add -D wrangler vitest @cloudflare/vitest-pool-workers @astrojs/check typescript
```

`@astrojs/check` and `typescript` are what `astro check` needs; without them the
verify command for this task fails.

- [ ] **Step 2: Configure TypeScript**

`tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

- [ ] **Step 3: Configure Astro**

`astro.config.mjs`:

```js
// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  vite: {
    plugins: [tailwindcss()],
  },
});
```

`output: 'server'` must be explicit — adapter 14 does not force it, and without it nothing
server-rendered is emitted. Pages that do not need a server opt out individually with
`export const prerender = true`.

- [ ] **Step 4: Configure Wrangler**

`wrangler.jsonc`. The `d1_databases` block is added in Task 3, once the database exists and has an id.

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "chicks-on-wheels",
  // The developer's own account. Required, not optional: this login also reaches
  // another, unrelated account, and wrangler refuses to guess between
  // them. Not a secret — account ids appear in every dashboard URL.
  "account_id": "<your-account-id>",
  "main": "@astrojs/cloudflare/entrypoints/server",
  "compatibility_date": "2026-08-22",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": false,
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "404-page"
  },
  "observability": { "enabled": true }
}
```

`workers_dev: false` is set from the start deliberately. It removes the `*.workers.dev` hostname, which would otherwise be an unauthenticated route straight past Cloudflare Access to `/admin`.

- [ ] **Step 5: Set up Tailwind**

`src/styles/global.css`:

```css
@import "tailwindcss";
```

- [ ] **Step 6: Type the runtime bindings**

Generate the `Env` type:

```bash
pnpm wrangler types
```

`src/env.d.ts`:

```ts
/// <reference path="../worker-configuration.d.ts" />

declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts after the Access JWT is verified. */
    accessEmail?: string;
  }
}
```

Deliberately does NOT extend `@astrojs/cloudflare`'s `Runtime`. That type still exists, but the
`locals.runtime` it describes throws at runtime on this adapter (see Platform notes) — extending it
would advertise an API that compiles and then fails. Bindings come from `cloudflare:workers`.

- [ ] **Step 7: Configure Vitest**

Two configurations. Pure logic runs in Node, which is fast; anything touching D1 runs inside the real Workers runtime.

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
```

`vitest.workers.config.ts` is created in Task 3, when there is a database for it to point at.

- [ ] **Step 8: Add a placeholder home page**

`src/pages/index.astro` — replaced properly in Task 5, but the build needs at
least one page to emit:

```astro
---
import '../styles/global.css';
---

<html lang="da">
  <head><meta charset="utf-8" /><title>Chicks on Wheels</title></head>
  <body class="bg-stone-50 p-8 text-stone-900">
    <h1 class="text-2xl font-bold">Chicks on Wheels</h1>
  </body>
</html>
```

- [ ] **Step 9: Update .gitignore**

Append:

```
node_modules/
dist/
.astro/
.wrangler/
worker-configuration.d.ts
```

- [ ] **Step 10: Verify the build**

Run: `pnpm build && pnpm astro check`
Expected: build completes writing `dist/server/entry.mjs` and `dist/client/`; check reports `0 errors`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Astro project for Cloudflare Workers"
```

---

### Task 1: Date helpers

**Goal:** Time-zone-correct date primitives that every other module depends on, with the Copenhagen rollover pinned by tests.

**Files:**
- Create: `src/lib/datetime.ts`
- Test: `tests/unit/datetime.test.ts`

**Acceptance Criteria:**
- [ ] `todayInCopenhagen` returns `YYYY-MM-DD` for the Copenhagen calendar day, correct in both CET and CEST
- [ ] `addDays` crosses month and year boundaries correctly
- [ ] `weekdayIndex` returns 0 for Monday through 6 for Sunday
- [ ] `formatDanishDate` renders a date for display

**Verify:** `pnpm vitest run tests/unit/datetime.test.ts` → all tests pass

**Steps:**

- [ ] **Step 1: Write the failing tests**

`tests/unit/datetime.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  todayInCopenhagen,
  addDays,
  weekdayIndex,
  formatDanishDate,
} from '../../src/lib/datetime';

describe('todayInCopenhagen', () => {
  it('returns the Copenhagen calendar day, not the UTC one', () => {
    // Summer: Copenhagen is UTC+2, so 22:30 UTC is already the next day locally.
    expect(todayInCopenhagen(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-15');
  });

  it('does not roll over an hour early in winter', () => {
    // Winter: Copenhagen is UTC+1, so 22:30 UTC is still 23:30 on the same day.
    expect(todayInCopenhagen(new Date('2026-01-14T22:30:00Z'))).toBe('2026-01-14');
    expect(todayInCopenhagen(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15');
  });

  it('handles midday unambiguously', () => {
    expect(todayInCopenhagen(new Date('2026-03-15T12:00:00Z'))).toBe('2026-03-15');
  });
});

describe('addDays', () => {
  it('adds within a month', () => {
    expect(addDays('2026-08-22', 3)).toBe('2026-08-25');
  });

  it('crosses a month boundary', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('adds nothing for zero', () => {
    expect(addDays('2026-08-22', 0)).toBe('2026-08-22');
  });
});

describe('weekdayIndex', () => {
  it('returns 0 for Monday', () => {
    expect(weekdayIndex('2026-08-24')).toBe(0);
  });

  it('returns 5 for Saturday', () => {
    expect(weekdayIndex('2026-08-22')).toBe(5);
  });

  it('returns 6 for Sunday', () => {
    expect(weekdayIndex('2026-08-23')).toBe(6);
  });
});

describe('formatDanishDate', () => {
  it('renders day and month', () => {
    expect(formatDanishDate('2026-08-22')).toBe('22. august');
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm vitest run tests/unit/datetime.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/datetime"`

- [ ] **Step 3: Implement**

`src/lib/datetime.ts`:

```ts
export const COPENHAGEN = 'Europe/Copenhagen';

/** Danish weekday names, indexed 0 = Monday .. 6 = Sunday. */
export const DANISH_WEEKDAYS = [
  'mandag',
  'tirsdag',
  'onsdag',
  'torsdag',
  'fredag',
  'lørdag',
  'søndag',
] as const;

/**
 * The current calendar date in Copenhagen as 'YYYY-MM-DD'.
 *
 * Workers run in UTC. Without this the site would roll over to tomorrow's
 * location at 22:00 or 23:00 local time, depending on daylight saving.
 * `en-CA` is used because it formats as YYYY-MM-DD.
 */
export function todayInCopenhagen(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COPENHAGEN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Calendar arithmetic on a 'YYYY-MM-DD' string.
 *
 * Deliberately done in UTC. These are calendar dates, not instants, so no
 * time zone should be involved — using local time here would make the result
 * depend on where the code runs.
 */
export function addDays(iso: string, days: number): string {
  const dt = parseISO(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** 0 = Monday .. 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  const jsDay = parseISO(iso).getUTCDay(); // 0 = Sunday
  return (jsDay + 6) % 7;
}

/** e.g. '22. august' — for display alongside the weekday name. */
export function formatDanishDate(iso: string): string {
  return new Intl.DateTimeFormat('da-DK', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
  }).format(parseISO(iso));
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm vitest run tests/unit/datetime.test.ts`
Expected: PASS — 12 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/datetime.ts tests/unit/datetime.test.ts
git commit -m "feat: add time-zone-correct date helpers"
```

---

### Task 2: Schedule resolution

**Goal:** The pure function that turns the weekly pattern plus exceptions into the seven days shown on the front page.

**Files:**
- Create: `src/lib/types.ts`, `src/lib/schedule.ts`
- Test: `tests/unit/schedule.test.ts`

**Acceptance Criteria:**
- [ ] `resolveWeek` returns exactly seven entries starting with today
- [ ] An exception replaces the pattern entry for its date entirely
- [ ] A day is closed when the exception says so, or when the pattern has no location
- [ ] The window crosses month and year boundaries correctly
- [ ] The function performs no I/O and reads no clock

**Verify:** `pnpm vitest run tests/unit/schedule.test.ts` → all tests pass

**Steps:**

- [ ] **Step 1: Define the shared types**

`src/lib/types.ts`:

```ts
export interface WeeklyStop {
  weekday: number; // 0 = Monday .. 6 = Sunday
  location_name: string | null; // null means closed this weekday
  address: string | null;
  map_url: string | null;
  start_time: string | null; // 'HH:MM'
  end_time: string | null; // 'HH:MM'
  note: string | null;
}

export interface ScheduleException {
  date: string; // 'YYYY-MM-DD'
  is_closed: number; // 0 or 1
  location_name: string | null;
  address: string | null;
  map_url: string | null;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
}

export interface DayEntry {
  date: string;
  weekday: number;
  weekdayName: string;
  displayDate: string;
  isToday: boolean;
  isClosed: boolean;
  isException: boolean;
  locationName: string | null;
  address: string | null;
  mapUrl: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}

export interface Banner {
  text: string;
  until: string; // 'YYYY-MM-DD', inclusive
}
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/schedule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveWeek, resolveBanner } from '../../src/lib/schedule';
import type { WeeklyStop, ScheduleException } from '../../src/lib/types';

function stop(weekday: number, location: string | null): WeeklyStop {
  return {
    weekday,
    location_name: location,
    address: location ? `${location} 1` : null,
    map_url: null,
    start_time: location ? '11:00' : null,
    end_time: location ? '14:00' : null,
    note: null,
  };
}

/** Monday through Sunday, open everywhere except Sunday. */
const PATTERN: WeeklyStop[] = [
  stop(0, 'Torvet'),
  stop(1, 'Havnen'),
  stop(2, 'Stationen'),
  stop(3, 'Skolen'),
  stop(4, 'Rådhuspladsen'),
  stop(5, 'Markedet'),
  stop(6, null),
];

describe('resolveWeek', () => {
  it('returns seven days starting with today', () => {
    // 2026-08-22 is a Saturday.
    const week = resolveWeek('2026-08-22', PATTERN, []);
    expect(week).toHaveLength(7);
    expect(week[0].date).toBe('2026-08-22');
    expect(week[6].date).toBe('2026-08-28');
  });

  it('marks only the first entry as today', () => {
    const week = resolveWeek('2026-08-22', PATTERN, []);
    expect(week[0].isToday).toBe(true);
    expect(week.slice(1).every((d) => d.isToday === false)).toBe(true);
  });

  it('takes location and times from the matching weekday', () => {
    const week = resolveWeek('2026-08-22', PATTERN, []);
    expect(week[0].weekdayName).toBe('lørdag');
    expect(week[0].locationName).toBe('Markedet');
    expect(week[0].startTime).toBe('11:00');
    expect(week[0].endTime).toBe('14:00');
  });

  it('marks a pattern day with no location as closed', () => {
    const week = resolveWeek('2026-08-22', PATTERN, []);
    const sunday = week.find((d) => d.date === '2026-08-23')!;
    expect(sunday.isClosed).toBe(true);
    expect(sunday.locationName).toBeNull();
  });

  it('lets an exception replace the pattern entry', () => {
    const exceptions: ScheduleException[] = [
      {
        date: '2026-08-24',
        is_closed: 0,
        location_name: 'Festivalpladsen',
        address: 'Festivalpladsen 3',
        map_url: 'https://maps.example/festival',
        start_time: '16:00',
        end_time: '21:00',
        note: 'Sommerfest',
      },
    ];
    const week = resolveWeek('2026-08-22', PATTERN, exceptions);
    const monday = week.find((d) => d.date === '2026-08-24')!;
    expect(monday.locationName).toBe('Festivalpladsen');
    expect(monday.startTime).toBe('16:00');
    expect(monday.note).toBe('Sommerfest');
    expect(monday.isException).toBe(true);
    expect(monday.isClosed).toBe(false);
  });

  it('closes a day when the exception says closed', () => {
    const exceptions: ScheduleException[] = [
      {
        date: '2026-08-25',
        is_closed: 1,
        location_name: null,
        address: null,
        map_url: null,
        start_time: null,
        end_time: null,
        note: 'Ferie',
      },
    ];
    const week = resolveWeek('2026-08-22', PATTERN, exceptions);
    const tuesday = week.find((d) => d.date === '2026-08-25')!;
    expect(tuesday.isClosed).toBe(true);
    expect(tuesday.isException).toBe(true);
    expect(tuesday.note).toBe('Ferie');
    expect(tuesday.locationName).toBeNull();
  });

  it('can open a day that the pattern closes', () => {
    const exceptions: ScheduleException[] = [
      {
        date: '2026-08-23',
        is_closed: 0,
        location_name: 'Stranden',
        address: null,
        map_url: null,
        start_time: '12:00',
        end_time: '17:00',
        note: null,
      },
    ];
    const week = resolveWeek('2026-08-22', PATTERN, exceptions);
    const sunday = week.find((d) => d.date === '2026-08-23')!;
    expect(sunday.isClosed).toBe(false);
    expect(sunday.locationName).toBe('Stranden');
  });

  it('ignores exceptions outside the window', () => {
    const exceptions: ScheduleException[] = [
      {
        date: '2026-09-30',
        is_closed: 1,
        location_name: null,
        address: null,
        map_url: null,
        start_time: null,
        end_time: null,
        note: 'Langt ude i fremtiden',
      },
    ];
    const week = resolveWeek('2026-08-22', PATTERN, exceptions);
    expect(week.every((d) => d.isException === false)).toBe(true);
  });

  it('crosses a month boundary', () => {
    const week = resolveWeek('2026-08-30', PATTERN, []);
    expect(week[0].date).toBe('2026-08-30');
    expect(week[6].date).toBe('2026-09-05');
  });

  it('crosses a year boundary', () => {
    const week = resolveWeek('2026-12-29', PATTERN, []);
    expect(week[6].date).toBe('2027-01-04');
  });

  it('is closed for every day when the pattern is empty', () => {
    const week = resolveWeek('2026-08-22', [], []);
    expect(week).toHaveLength(7);
    expect(week.every((d) => d.isClosed)).toBe(true);
  });
});

describe('resolveBanner', () => {
  it('returns the banner while it is still current', () => {
    const banner = resolveBanner('2026-08-22', {
      banner_text: 'Lukket uge 35',
      banner_until: '2026-08-30',
    });
    expect(banner?.text).toBe('Lukket uge 35');
  });

  it('returns the banner on its final day', () => {
    const banner = resolveBanner('2026-08-30', {
      banner_text: 'Lukket uge 35',
      banner_until: '2026-08-30',
    });
    expect(banner).not.toBeNull();
  });

  it('hides an expired banner', () => {
    const banner = resolveBanner('2026-08-31', {
      banner_text: 'Lukket uge 35',
      banner_until: '2026-08-30',
    });
    expect(banner).toBeNull();
  });

  it('hides a banner with no text', () => {
    expect(resolveBanner('2026-08-22', { banner_until: '2026-08-30' })).toBeNull();
    expect(
      resolveBanner('2026-08-22', { banner_text: '   ', banner_until: '2026-08-30' }),
    ).toBeNull();
  });

  it('hides a banner with no end date', () => {
    expect(resolveBanner('2026-08-22', { banner_text: 'Hej' })).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests and watch them fail**

Run: `pnpm vitest run tests/unit/schedule.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/lib/schedule"`

- [ ] **Step 4: Implement**

`src/lib/schedule.ts`:

```ts
import { addDays, weekdayIndex, formatDanishDate, DANISH_WEEKDAYS } from './datetime';
import type { WeeklyStop, ScheduleException, DayEntry, Banner } from './types';

export const WEEK_LENGTH = 7;

/**
 * Resolve the schedule for the coming week.
 *
 * Pure by design: the caller supplies today's date, so there is no clock and
 * no database here. Every rule below is therefore an ordinary unit test.
 *
 * The window rolls forward from today rather than showing a Monday-to-Sunday
 * calendar week — a customer looking on Friday cares about the next seven
 * days, not about Monday, which has already passed.
 */
export function resolveWeek(
  todayISO: string,
  stops: WeeklyStop[],
  exceptions: ScheduleException[],
): DayEntry[] {
  const byWeekday = new Map(stops.map((s) => [s.weekday, s]));
  const byDate = new Map(exceptions.map((e) => [e.date, e]));

  const entries: DayEntry[] = [];

  for (let offset = 0; offset < WEEK_LENGTH; offset++) {
    const date = addDays(todayISO, offset);
    const weekday = weekdayIndex(date);
    const base = {
      date,
      weekday,
      weekdayName: DANISH_WEEKDAYS[weekday],
      displayDate: formatDanishDate(date),
      isToday: offset === 0,
    };

    const exception = byDate.get(date);

    if (exception) {
      // An exception replaces the pattern entry entirely — it is never merged.
      entries.push({
        ...base,
        isException: true,
        isClosed: exception.is_closed === 1,
        locationName: exception.is_closed === 1 ? null : exception.location_name,
        address: exception.is_closed === 1 ? null : exception.address,
        mapUrl: exception.is_closed === 1 ? null : exception.map_url,
        startTime: exception.is_closed === 1 ? null : exception.start_time,
        endTime: exception.is_closed === 1 ? null : exception.end_time,
        note: exception.note,
      });
      continue;
    }

    const stop = byWeekday.get(weekday);
    const closed = !stop || stop.location_name === null;

    entries.push({
      ...base,
      isException: false,
      isClosed: closed,
      locationName: closed ? null : stop!.location_name,
      address: closed ? null : stop!.address,
      mapUrl: closed ? null : stop!.map_url,
      startTime: closed ? null : stop!.start_time,
      endTime: closed ? null : stop!.end_time,
      note: stop?.note ?? null,
    });
  }

  return entries;
}

/**
 * The front page banner, or null when there is nothing current to show.
 *
 * Both a non-empty text and an end date on or after today are required, so a
 * forgotten message expires on its own instead of lingering for months.
 */
export function resolveBanner(
  todayISO: string,
  settings: Record<string, string | undefined>,
): Banner | null {
  const text = settings.banner_text?.trim();
  const until = settings.banner_until?.trim();

  if (!text || !until) return null;
  if (until < todayISO) return null;

  return { text, until };
}
```

Comparing `until < todayISO` as strings is correct because both are zero-padded `YYYY-MM-DD`, which sorts lexicographically the same way it sorts chronologically.

- [ ] **Step 5: Run the tests and watch them pass**

Run: `pnpm vitest run tests/unit/schedule.test.ts`
Expected: PASS — 16 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/schedule.ts tests/unit/schedule.test.ts
git commit -m "feat: resolve weekly pattern and exceptions into a seven-day view"
```

---

### Task 3: Database schema and worker test harness

**Goal:** The D1 database, its migration, and a Vitest setup that runs tests against a real local D1 with migrations applied.

**Files:**
- Create: `migrations/0001_initial.sql`, `vitest.workers.config.ts`, `tests/worker/apply-migrations.ts`, `tests/worker/env.d.ts`, `tests/worker/isolation.test.ts`
- Install: `@types/node` (dev)
- Modify: `wrangler.jsonc`
- Test: `tests/worker/schema.test.ts`

**Acceptance Criteria:**
- [ ] A D1 database named `chicks_on_wheels` exists and is bound as `DB`
- [ ] The migration creates all three tables and seeds seven `weekly_stops` rows
- [ ] Worker tests run with migrations already applied
- [ ] Each test file starts from a clean database

**Verify:** `pnpm test:worker` → all tests pass

**Steps:**

- [ ] **Step 1: Create the database**

```bash
pnpm wrangler d1 create chicks_on_wheels
```

Copy the `database_id` from the output — the next step needs it.

- [ ] **Step 2: Bind it in `wrangler.jsonc`**

Add to `wrangler.jsonc`, substituting the id printed above:

```jsonc
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "chicks_on_wheels",
      "database_id": "PASTE_THE_ID_FROM_STEP_1",
      "migrations_dir": "migrations"
    }
  ],
```

Then regenerate types:

```bash
pnpm wrangler types
```

- [ ] **Step 3: Write the migration**

`migrations/0001_initial.sql`:

```sql
-- The recurring weekly pattern. Exactly seven rows, always present.
CREATE TABLE weekly_stops (
  weekday       INTEGER PRIMARY KEY,
  location_name TEXT,
  address       TEXT,
  map_url       TEXT,
  start_time    TEXT,
  end_time      TEXT,
  note          TEXT
);

-- One-off overrides. At most one per calendar date.
CREATE TABLE schedule_exceptions (
  date          TEXT PRIMARY KEY,
  is_closed     INTEGER NOT NULL DEFAULT 0,
  location_name TEXT,
  address       TEXT,
  map_url       TEXT,
  start_time    TEXT,
  end_time      TEXT,
  note          TEXT
);

CREATE TABLE site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Seed all seven weekdays as closed. The owner fills them in from /admin.
-- Seeding here means the admin screen only ever updates rows, so she can
-- never end up with a missing weekday.
INSERT INTO weekly_stops (weekday) VALUES (0), (1), (2), (3), (4), (5), (6);
```

- [ ] **Step 4: Apply it locally**

```bash
pnpm wrangler d1 migrations apply chicks_on_wheels --local
```

Expected: one migration applied.

- [ ] **Step 5: Configure the worker test pool**

`vitest.workers.config.ts` — this is the verified working configuration for
`@cloudflare/vitest-pool-workers` 0.22 with Vitest 4. Note it does NOT use `defineWorkersConfig`
or the `/config` subpath; both are gone. See Platform notes.

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';

const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));

export default defineConfig({
  plugins: [
    cloudflareTest({
      // The root wrangler.jsonc points `main` at a package export
      // (@astrojs/cloudflare/entrypoints/server), which the pool tries to
      // resolve as a file path and cannot. Point it at the built Worker
      // instead — this is also what lets tests fetch the real Worker via
      // `exports.default.fetch()` from 'cloudflare:workers'.
      main: './dist/server/entry.mjs',
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        // Handed to the setup file so it can apply them per test file.
        bindings: { TEST_MIGRATIONS: migrations },
      },
    }),
  ],
  test: {
    include: ['tests/worker/**/*.test.ts'],
    setupFiles: ['./tests/worker/apply-migrations.ts'],
  },
});
```

Worker tests therefore need a build first. `test:worker` in `package.json` becomes:

```json
    "test:worker": "astro build && vitest run -c vitest.workers.config.ts",
```

`tests/worker/apply-migrations.ts`:

```ts
import { applyD1Migrations, env } from 'cloudflare:test';

// Runs once per test file. The pool's isolated storage means each file starts
// from an empty database, so migrations must be reapplied for each of them.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
```

`tests/worker/env.d.ts`:

```ts
declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
```

`tests/worker/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["@cloudflare/vitest-pool-workers"]
  },
  "include": ["./**/*.ts", "../../worker-configuration.d.ts"]
}
```

- [ ] **Step 6: Write a test proving the harness works**

`tests/worker/schema.test.ts`:

```ts
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('schema', () => {
  it('seeds seven weekday rows', async () => {
    const { results } = await env.DB.prepare(
      'SELECT weekday FROM weekly_stops ORDER BY weekday',
    ).all<{ weekday: number }>();
    expect(results.map((r) => r.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('seeds every weekday as closed', async () => {
    const { results } = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM weekly_stops WHERE location_name IS NOT NULL',
    ).all<{ n: number }>();
    expect(results[0].n).toBe(0);
  });

  it('starts with no exceptions and no settings', async () => {
    const ex = await env.DB.prepare('SELECT COUNT(*) AS n FROM schedule_exceptions').first<{
      n: number;
    }>();
    const settings = await env.DB.prepare('SELECT COUNT(*) AS n FROM site_settings').first<{
      n: number;
    }>();
    expect(ex?.n).toBe(0);
    expect(settings?.n).toBe(0);
  });

  it('allows only one exception per date', async () => {
    await env.DB.prepare("INSERT INTO schedule_exceptions (date, is_closed) VALUES ('2026-08-25', 1)").run();
    await expect(
      env.DB.prepare("INSERT INTO schedule_exceptions (date, is_closed) VALUES ('2026-08-25', 0)").run(),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 7: Run the worker tests**

Run: `pnpm test:worker`
Expected: PASS — 4 tests

- [ ] **Step 8: Commit**

```bash
git add migrations vitest.workers.config.ts tests/worker wrangler.jsonc
git commit -m "feat: add D1 schema and worker test harness"
```

---

### Task 4: Data access layer

**Goal:** Every SQL statement in the project, in one module, tested against a real D1.

**Files:**
- Create: `src/lib/db.ts`
- Test: `tests/worker/db.test.ts`

**Acceptance Criteria:**
- [ ] Reads return the seven stops and only upcoming exceptions
- [ ] `updateWeeklyStop` updates rather than inserts
- [ ] `upsertException` replaces an existing exception for the same date
- [ ] `setSettings` inserts new keys and overwrites existing ones
- [ ] `db.ts` is the only module containing SQL

**Verify:** `pnpm test:worker` → all tests pass

**Steps:**

- [ ] **Step 1: Write the failing tests**

`tests/worker/db.test.ts`:

```ts
import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import {
  getWeeklyStops,
  getUpcomingExceptions,
  updateWeeklyStop,
  upsertException,
  deleteException,
  getSettings,
  setSettings,
} from '../../src/lib/db';

describe('getWeeklyStops', () => {
  it('returns seven rows ordered Monday first', async () => {
    const stops = await getWeeklyStops(env.DB);
    expect(stops).toHaveLength(7);
    expect(stops.map((s) => s.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('updateWeeklyStop', () => {
  it('updates the existing row without adding one', async () => {
    await updateWeeklyStop(env.DB, {
      weekday: 2,
      location_name: 'Stationen',
      address: 'Banegårdspladsen 1',
      map_url: null,
      start_time: '11:00',
      end_time: '14:00',
      note: null,
    });

    const stops = await getWeeklyStops(env.DB);
    expect(stops).toHaveLength(7);
    expect(stops[2].location_name).toBe('Stationen');
    expect(stops[2].start_time).toBe('11:00');
  });

  it('can clear a day back to closed', async () => {
    await updateWeeklyStop(env.DB, {
      weekday: 3,
      location_name: 'Skolen',
      address: null,
      map_url: null,
      start_time: '11:00',
      end_time: '14:00',
      note: null,
    });
    await updateWeeklyStop(env.DB, {
      weekday: 3,
      location_name: null,
      address: null,
      map_url: null,
      start_time: null,
      end_time: null,
      note: null,
    });

    const stops = await getWeeklyStops(env.DB);
    expect(stops[3].location_name).toBeNull();
  });
});

describe('getUpcomingExceptions', () => {
  it('excludes dates before the cutoff and includes the cutoff itself', async () => {
    await upsertException(env.DB, {
      date: '2026-08-20',
      is_closed: 1,
      location_name: null,
      address: null,
      map_url: null,
      start_time: null,
      end_time: null,
      note: 'Fortid',
    });
    await upsertException(env.DB, {
      date: '2026-08-22',
      is_closed: 1,
      location_name: null,
      address: null,
      map_url: null,
      start_time: null,
      end_time: null,
      note: 'I dag',
    });
    await upsertException(env.DB, {
      date: '2026-08-25',
      is_closed: 1,
      location_name: null,
      address: null,
      map_url: null,
      start_time: null,
      end_time: null,
      note: 'Fremtid',
    });

    const upcoming = await getUpcomingExceptions(env.DB, '2026-08-22');
    expect(upcoming.map((e) => e.date)).toEqual(['2026-08-22', '2026-08-25']);
  });
});

describe('upsertException', () => {
  it('replaces an exception for a date already taken', async () => {
    await upsertException(env.DB, {
      date: '2026-09-01',
      is_closed: 1,
      location_name: null,
      address: null,
      map_url: null,
      start_time: null,
      end_time: null,
      note: 'Lukket',
    });
    await upsertException(env.DB, {
      date: '2026-09-01',
      is_closed: 0,
      location_name: 'Havnen',
      address: null,
      map_url: null,
      start_time: '12:00',
      end_time: '18:00',
      note: null,
    });

    const upcoming = await getUpcomingExceptions(env.DB, '2026-09-01');
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].is_closed).toBe(0);
    expect(upcoming[0].location_name).toBe('Havnen');
  });
});

describe('deleteException', () => {
  it('removes the exception', async () => {
    await upsertException(env.DB, {
      date: '2026-09-05',
      is_closed: 1,
      location_name: null,
      address: null,
      map_url: null,
      start_time: null,
      end_time: null,
      note: null,
    });
    await deleteException(env.DB, '2026-09-05');
    // Assert this date is gone, not that the table is empty: storage is
    // isolated per test FILE, not per test, so earlier tests in this file have
    // left rows behind. An emptiness assertion would couple unrelated tests.
    const upcoming = await getUpcomingExceptions(env.DB, '2026-09-01');
    expect(upcoming.map((e) => e.date)).not.toContain('2026-09-05');
  });
});

describe('settings', () => {
  it('returns an empty object when nothing is stored', async () => {
    expect(await getSettings(env.DB)).toEqual({});
  });

  it('writes and overwrites keys', async () => {
    await setSettings(env.DB, { banner_text: 'Hej', banner_until: '2026-09-01' });
    expect(await getSettings(env.DB)).toEqual({
      banner_text: 'Hej',
      banner_until: '2026-09-01',
    });

    await setSettings(env.DB, { banner_text: 'Farvel' });
    const settings = await getSettings(env.DB);
    expect(settings.banner_text).toBe('Farvel');
    expect(settings.banner_until).toBe('2026-09-01');
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm test:worker`
Expected: FAIL — cannot resolve `../../src/lib/db`

- [ ] **Step 3: Implement**

`src/lib/db.ts`:

```ts
import type { WeeklyStop, ScheduleException } from './types';

/**
 * Every SQL statement in the project lives here. Nothing else imports D1
 * directly, which keeps the query surface small enough to review at a glance.
 */

export async function getWeeklyStops(db: D1Database): Promise<WeeklyStop[]> {
  const { results } = await db
    .prepare(
      `SELECT weekday, location_name, address, map_url, start_time, end_time, note
       FROM weekly_stops
       ORDER BY weekday`,
    )
    .all<WeeklyStop>();
  return results;
}

/** Exceptions on or after `fromISO`. Past ones are left in place, never shown. */
export async function getUpcomingExceptions(
  db: D1Database,
  fromISO: string,
): Promise<ScheduleException[]> {
  const { results } = await db
    .prepare(
      `SELECT date, is_closed, location_name, address, map_url, start_time, end_time, note
       FROM schedule_exceptions
       WHERE date >= ?
       ORDER BY date`,
    )
    .bind(fromISO)
    .all<ScheduleException>();
  return results;
}

/** Updates one of the seven seeded rows. Never inserts. */
export async function updateWeeklyStop(db: D1Database, stop: WeeklyStop): Promise<void> {
  await db
    .prepare(
      `UPDATE weekly_stops
       SET location_name = ?, address = ?, map_url = ?, start_time = ?, end_time = ?, note = ?
       WHERE weekday = ?`,
    )
    .bind(
      stop.location_name,
      stop.address,
      stop.map_url,
      stop.start_time,
      stop.end_time,
      stop.note,
      stop.weekday,
    )
    .run();
}

/** Replaces any existing exception for the same date. */
export async function upsertException(
  db: D1Database,
  ex: ScheduleException,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO schedule_exceptions
         (date, is_closed, location_name, address, map_url, start_time, end_time, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         is_closed = excluded.is_closed,
         location_name = excluded.location_name,
         address = excluded.address,
         map_url = excluded.map_url,
         start_time = excluded.start_time,
         end_time = excluded.end_time,
         note = excluded.note`,
    )
    .bind(
      ex.date,
      ex.is_closed,
      ex.location_name,
      ex.address,
      ex.map_url,
      ex.start_time,
      ex.end_time,
      ex.note,
    )
    .run();
}

export async function deleteException(db: D1Database, date: string): Promise<void> {
  await db.prepare('DELETE FROM schedule_exceptions WHERE date = ?').bind(date).run();
}

export async function getSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db
    .prepare('SELECT key, value FROM site_settings')
    .all<{ key: string; value: string | null }>();

  const settings: Record<string, string> = {};
  for (const row of results) {
    if (row.value !== null) settings[row.key] = row.value;
  }
  return settings;
}

export async function setSettings(
  db: D1Database,
  entries: Record<string, string>,
): Promise<void> {
  const statements = Object.entries(entries).map(([key, value]) =>
    db
      .prepare(
        `INSERT INTO site_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .bind(key, value),
  );
  if (statements.length > 0) await db.batch(statements);
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm test:worker`
Expected: PASS — 12 tests across both worker test files

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/worker/db.test.ts
git commit -m "feat: add D1 data access layer"
```

---

### Task 5: Site shell

**Goal:** The layout, navigation, and base styling every page shares.

**Files:**
- Create: `src/layouts/Base.astro`, `src/components/Nav.astro`, `src/components/Footer.astro`
- Modify: `src/pages/index.astro` (placeholder from the scaffold)

**Acceptance Criteria:**
- [ ] Pages render with `lang="da"` and a Danish `<title>`
- [ ] Navigation links to `/`, `/ydelser`, `/kontakt` and marks the current page
- [ ] The layout is legible on a phone without horizontal scrolling
- [ ] Tailwind styles apply

**Verify:** `pnpm build && pnpm astro check` → build succeeds, `0 errors`

**Steps:**

- [ ] **Step 1: Create the base layout**

`src/layouts/Base.astro`:

```astro
---
import '../styles/global.css';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title: string;
  description?: string;
}

const { title, description = 'Chicks on Wheels — foodtruck og pølsevogn.' } = Astro.props;
---

<html lang="da">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title} — Chicks on Wheels</title>
    <meta name="description" content={description} />
  </head>
  <body class="min-h-screen bg-stone-50 text-stone-900 antialiased">
    <Nav />
    <main class="mx-auto w-full max-w-2xl px-4 py-8">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 2: Create the navigation**

`src/components/Nav.astro`:

```astro
---
const path = Astro.url.pathname;

const links = [
  { href: '/', label: 'Hvor er vi?' },
  { href: '/ydelser', label: 'Ydelser' },
  { href: '/kontakt', label: 'Kontakt' },
];
---

<header class="border-b border-stone-200 bg-white">
  <div class="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-4">
    <a href="/" class="text-xl font-bold tracking-tight">Chicks on Wheels</a>
    <nav class="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {
        links.map((link) => (
          <a
            href={link.href}
            aria-current={path === link.href ? 'page' : undefined}
            class:list={[
              'py-1 hover:text-stone-950',
              path === link.href ? 'font-semibold text-stone-950 underline underline-offset-4' : 'text-stone-600',
            ]}
          >
            {link.label}
          </a>
        ))
      }
    </nav>
  </div>
</header>
```

- [ ] **Step 3: Create the footer**

`src/components/Footer.astro`:

```astro
---
const year = new Date().getFullYear();
---

<footer class="mt-12 border-t border-stone-200 bg-white">
  <div class="mx-auto w-full max-w-2xl px-4 py-6 text-sm text-stone-500">
    <p>© {year} Chicks on Wheels</p>
  </div>
</footer>
```

- [ ] **Step 4: Replace the scaffold's index page temporarily**

`src/pages/index.astro`:

```astro
---
import Base from '../layouts/Base.astro';
---

<Base title="Hvor er vi?">
  <h1 class="text-2xl font-bold">Hvor er vi?</h1>
</Base>
```

- [ ] **Step 5: Check it renders**

Run: `pnpm dev`, open `http://localhost:4321`
Expected: heading, navigation, and footer, styled, with no horizontal scroll at a 375px viewport width.

Then: `pnpm build && pnpm astro check`
Expected: build succeeds, `0 errors`.

- [ ] **Step 6: Commit**

```bash
git add src/layouts src/components src/pages/index.astro
git commit -m "feat: add site layout, navigation, and footer"
```

---

### Task 6: Front page

**Goal:** The page customers actually come for — today's location, the coming week, and the banner — with a safe fallback when D1 is unavailable.

**Files:**
- Create: `src/components/DayCard.astro`, `src/components/BannerNotice.astro`
- Modify: `src/pages/index.astro`

**Acceptance Criteria:**
- [ ] Today is shown prominently, followed by the next six days
- [ ] A closed day reads "Lukket", never an empty row
- [ ] The banner shows only while current
- [ ] A D1 failure renders a Danish notice and the contact phone number, never a blank or stale schedule
- [ ] The page is not cached

**Verify:** `pnpm build && pnpm astro check` → build succeeds, `0 errors`; manual check per Step 5

**Steps:**

- [ ] **Step 1: Create the day card**

`src/components/DayCard.astro`:

```astro
---
import type { DayEntry } from '../lib/types';

interface Props {
  day: DayEntry;
  prominent?: boolean;
}

const { day, prominent = false } = Astro.props;
---

<article
  class:list={[
    'rounded-lg border px-4 py-3',
    prominent ? 'border-stone-900 bg-white shadow-sm' : 'border-stone-200 bg-white',
  ]}
>
  <p class="text-sm text-stone-500">
    {prominent ? 'I dag' : day.weekdayName}
    <span class="text-stone-400">· {day.displayDate}</span>
  </p>

  {
    day.isClosed ? (
      <p class:list={['mt-1 font-semibold text-stone-500', prominent && 'text-lg']}>Lukket</p>
    ) : (
      <>
        <p class:list={['mt-1 font-semibold', prominent ? 'text-xl' : 'text-base']}>
          {day.locationName}
        </p>
        {day.address && <p class="text-sm text-stone-600">{day.address}</p>}
        {day.startTime && day.endTime && (
          <p class="mt-1 text-sm text-stone-700">
            Kl. {day.startTime}–{day.endTime}
          </p>
        )}
        {day.mapUrl && (
          <a
            href={day.mapUrl}
            rel="noopener noreferrer"
            target="_blank"
            class="mt-1 inline-block text-sm underline underline-offset-2"
          >
            Vis på kort
          </a>
        )}
      </>
    )
  }

  {day.note && <p class="mt-2 text-sm text-stone-600 italic">{day.note}</p>}
</article>
```

- [ ] **Step 2: Create the banner component**

`src/components/BannerNotice.astro`:

```astro
---
interface Props {
  text: string;
}

const { text } = Astro.props;
---

<aside class="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
  <p class="font-medium">{text}</p>
</aside>
```

- [ ] **Step 3: Write the front page**

`src/pages/index.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import DayCard from '../components/DayCard.astro';
import BannerNotice from '../components/BannerNotice.astro';
import { todayInCopenhagen } from '../lib/datetime';
import { resolveWeek, resolveBanner } from '../lib/schedule';
import { getWeeklyStops, getUpcomingExceptions, getSettings } from '../lib/db';
import { env } from 'cloudflare:workers';
import type { DayEntry, Banner } from '../lib/types';

// Rendered on demand and never cached. An edit by the owner must be visible
// immediately — a stale cache here would send customers to the wrong place,
// which is the worst thing this site can do.
Astro.response.headers.set('Cache-Control', 'no-store');

const today = todayInCopenhagen();

let week: DayEntry[] = [];
let banner: Banner | null = null;
let failed = false;

try {
  const db = env.DB;
  const [stops, exceptions, settings] = await Promise.all([
    getWeeklyStops(db),
    getUpcomingExceptions(db, today),
    getSettings(db),
  ]);
  week = resolveWeek(today, stops, exceptions);
  banner = resolveBanner(today, settings);
} catch (error) {
  // Better to admit the schedule is unavailable than to show a blank or stale
  // one that a customer might drive to.
  console.error('Failed to load schedule', error);
  failed = true;
}
---

<Base title="Hvor er vi?">
  {banner && <BannerNotice text={banner.text} />}

  <h1 class="text-2xl font-bold tracking-tight">Hvor er vi?</h1>

  {
    failed ? (
      <div class="mt-6 rounded-lg border border-stone-300 bg-white px-4 py-5">
        <p class="font-medium">Planen kan ikke vises lige nu.</p>
        <p class="mt-2 text-stone-600">
          Prøv igen om et øjeblik, eller ring til os på
          <a href="tel:+4512345678" class="underline underline-offset-2">+45 12 34 56 78</a>.
        </p>
      </div>
    ) : (
      <>
        <div class="mt-6">
          <DayCard day={week[0]} prominent />
        </div>

        <h2 class="mt-8 text-lg font-semibold">Resten af ugen</h2>
        <div class="mt-3 flex flex-col gap-3">
          {week.slice(1).map((day) => (
            <DayCard day={day} />
          ))}
        </div>
      </>
    )
  }
</Base>
```

The phone number is a placeholder for real content and is replaced in Task 11 along with the rest of the contact details.

- [ ] **Step 4: Seed some local data to look at**

```bash
pnpm wrangler d1 execute chicks_on_wheels --local --command \
  "UPDATE weekly_stops SET location_name='Torvet', address='Torvet 1', start_time='11:00', end_time='14:00' WHERE weekday IN (0,1,2,3,4)"
```

- [ ] **Step 5: Check it renders**

Run: `pnpm dev`, open `http://localhost:4321`
Expected: today's card at the top, six more below it, weekend days reading "Lukket".

Then check the failure path by pointing at a broken binding — temporarily rename `DB` to `NOPE` in the page, reload, and confirm the Danish notice and phone number appear rather than an error page. Restore the name afterwards.

Then: `pnpm build && pnpm astro check`
Expected: build succeeds, `0 errors`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/index.astro src/components/DayCard.astro src/components/BannerNotice.astro
git commit -m "feat: add front page schedule with banner and failure fallback"
```

---

### Task 7: Services and contact pages

**Goal:** The two prerendered content pages, with copy in markdown so it is easy to change.

**Files:**
- Create: `src/pages/ydelser.astro`, `src/pages/kontakt.astro`, `src/content/ydelser.md`

**Acceptance Criteria:**
- [ ] Both pages are prerendered — no Worker invocation at request time
- [ ] `/ydelser` covers the food truck, the pølsevogn, and events for companies and private customers
- [ ] `/kontakt` shows phone, email, and service area, with working `tel:` and `mailto:` links
- [ ] Copy lives in markdown, not in JSX-like markup

**Verify:** `pnpm build` → `dist/client/ydelser/index.html` and `dist/client/kontakt/index.html` exist as static files

**Steps:**

- [ ] **Step 1: Write the services copy**

`src/content/ydelser.md`:

```markdown
## Foodtruck

Vi kommer med vores foodtruck og laver mad på stedet. Se ugeplanen for at
finde os i denne uge.

## Pølsevogn

Vores klassiske pølsevogn kan lejes til dit arrangement — med eller uden
betjening.

## Firmaarrangementer

Personalefester, receptioner, byggepladser og messer. Vi aftaler menu og
tidspunkt, og vi står for resten.

## Private fester

Fødselsdage, konfirmationer og bryllupper. Kontakt os med dato og antal
gæster, så vender vi tilbage med et tilbud.
```

- [ ] **Step 2: Write the services page**

`src/pages/ydelser.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import { Content } from '../content/ydelser.md';

export const prerender = true;
---

<Base title="Ydelser" description="Foodtruck, pølsevogn og catering til fester og firmaarrangementer.">
  <h1 class="text-2xl font-bold tracking-tight">Ydelser</h1>
  <div
    class="mt-6 flex flex-col gap-4 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:text-stone-700"
  >
    <Content />
  </div>
  <p class="mt-8">
    <a href="/kontakt" class="font-medium underline underline-offset-4">Kontakt os for et tilbud</a>
  </p>
</Base>
```

- [ ] **Step 3: Write the contact page**

`src/pages/kontakt.astro`:

```astro
---
import Base from '../layouts/Base.astro';

export const prerender = true;

// Replaced with the owner's real details in Task 11.
const phone = '+45 12 34 56 78';
const phoneHref = 'tel:+4512345678';
const email = 'hej@chicksonwheels.dk';
---

<Base title="Kontakt" description="Ring eller skriv til Chicks on Wheels.">
  <h1 class="text-2xl font-bold tracking-tight">Kontakt</h1>

  <dl class="mt-6 flex flex-col gap-4">
    <div>
      <dt class="text-sm text-stone-500">Telefon</dt>
      <dd class="text-lg">
        <a href={phoneHref} class="underline underline-offset-4">{phone}</a>
      </dd>
    </div>
    <div>
      <dt class="text-sm text-stone-500">E-mail</dt>
      <dd class="text-lg">
        <a href={`mailto:${email}`} class="underline underline-offset-4">{email}</a>
      </dd>
    </div>
    <div>
      <dt class="text-sm text-stone-500">Område</dt>
      <dd class="text-lg">Vi kører ud i hele området.</dd>
    </div>
  </dl>
</Base>
```

- [ ] **Step 4: Verify they are prerendered**

Run: `pnpm build && ls dist/client/ydelser/index.html dist/client/kontakt/index.html`
Expected: both files listed. Their presence as static HTML is the proof that they are not rendered per request.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ydelser.astro src/pages/kontakt.astro src/content/ydelser.md
git commit -m "feat: add services and contact pages"
```

---

### Task 8: Form validation

**Goal:** Every rejection rule for the admin forms, as pure functions with Danish error messages.

**Files:**
- Create: `src/lib/validate.ts`
- Test: `tests/unit/validate.test.ts`

**Acceptance Criteria:**
- [ ] Times must be `HH:MM` and end must be after start
- [ ] An open day requires a location name
- [ ] Exception dates accept today, reject earlier dates, and reject nonsense
- [ ] Banner text requires an end date of today or later
- [ ] Every error message is in Danish and names the field it belongs to

**Verify:** `pnpm vitest run tests/unit/validate.test.ts` → all tests pass

**Steps:**

- [ ] **Step 1: Write the failing tests**

`tests/unit/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateStop, validateException, validateBanner } from '../../src/lib/validate';

describe('validateStop', () => {
  it('accepts a closed day with no other fields', () => {
    const result = validateStop({ weekday: 6, closed: true, location_name: '' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.location_name).toBeNull();
  });

  it('accepts an open day with a location and valid times', () => {
    const result = validateStop({
      weekday: 0,
      closed: false,
      location_name: 'Torvet',
      start_time: '11:00',
      end_time: '14:00',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.start_time).toBe('11:00');
  });

  it('rejects an open day with no location', () => {
    const result = validateStop({ weekday: 0, closed: false, location_name: '  ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.location_name).toBe('Skriv hvor I holder.');
  });

  it('rejects a malformed time', () => {
    const result = validateStop({
      weekday: 0,
      closed: false,
      location_name: 'Torvet',
      start_time: '25:00',
      end_time: '14:00',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.start_time).toBe('Skriv tidspunktet som f.eks. 11:00.');
  });

  it('rejects an end time before the start time', () => {
    const result = validateStop({
      weekday: 0,
      closed: false,
      location_name: 'Torvet',
      start_time: '14:00',
      end_time: '11:00',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.end_time).toBe('Sluttidspunktet skal være efter starttidspunktet.');
  });

  it('rejects an end time equal to the start time', () => {
    const result = validateStop({
      weekday: 0,
      closed: false,
      location_name: 'Torvet',
      start_time: '11:00',
      end_time: '11:00',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an open day missing its times', () => {
    const result = validateStop({ weekday: 0, closed: false, location_name: 'Torvet' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.start_time).toBe('Skriv hvornår I åbner.');
  });
});

describe('validateException', () => {
  const today = '2026-08-22';

  it('accepts a closed exception for today', () => {
    const result = validateException({ date: today, closed: true }, today);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.is_closed).toBe(1);
  });

  it('accepts an open exception with a location and times', () => {
    const result = validateException(
      {
        date: '2026-08-25',
        closed: false,
        location_name: 'Festivalpladsen',
        start_time: '16:00',
        end_time: '21:00',
      },
      today,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.location_name).toBe('Festivalpladsen');
  });

  it('rejects a date in the past', () => {
    const result = validateException({ date: '2026-08-21', closed: true }, today);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.date).toBe('Datoen er allerede passeret.');
  });

  it('rejects a missing or malformed date', () => {
    expect(validateException({ date: '', closed: true }, today).ok).toBe(false);
    expect(validateException({ date: 'i morgen', closed: true }, today).ok).toBe(false);
    expect(validateException({ date: '2026-02-30', closed: true }, today).ok).toBe(false);
  });

  it('rejects an open exception with no location', () => {
    const result = validateException({ date: '2026-08-25', closed: false }, today);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.location_name).toBe('Skriv hvor I holder.');
  });
});

describe('validateBanner', () => {
  const today = '2026-08-22';

  it('accepts empty text and clears both fields', () => {
    const result = validateBanner({ text: '   ', until: '' }, today);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ banner_text: '', banner_until: '' });
  });

  it('accepts text with a future end date', () => {
    const result = validateBanner({ text: 'Lukket uge 35', until: '2026-08-30' }, today);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.banner_text).toBe('Lukket uge 35');
  });

  it('accepts an end date of today', () => {
    expect(validateBanner({ text: 'Hej', until: today }, today).ok).toBe(true);
  });

  it('rejects text with no end date', () => {
    const result = validateBanner({ text: 'Hej', until: '' }, today);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.until).toBe('Vælg hvor længe beskeden skal vises.');
  });

  it('rejects an end date in the past', () => {
    const result = validateBanner({ text: 'Hej', until: '2026-08-21' }, today);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.until).toBe('Datoen er allerede passeret.');
  });

  it('rejects text that is too long', () => {
    const result = validateBanner({ text: 'a'.repeat(201), until: '2026-08-30' }, today);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.text).toBe('Beskeden må højst være 200 tegn.');
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm vitest run tests/unit/validate.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/validate`

- [ ] **Step 3: Implement**

`src/lib/validate.ts`:

```ts
import type { WeeklyStop, ScheduleException } from './types';

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

export const MAX_BANNER_LENGTH = 200;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** True only for a real calendar date — rejects e.g. 2026-02-30. */
function isRealDate(iso: string): boolean {
  if (!DATE_PATTERN.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

interface StopInput {
  weekday: number;
  closed: boolean;
  location_name?: string;
  address?: string;
  map_url?: string;
  start_time?: string;
  end_time?: string;
  note?: string;
}

/** Shared between the weekly pattern and the open-day branch of exceptions. */
function validateOpenFields(
  input: { location_name?: string; start_time?: string; end_time?: string },
  errors: Record<string, string>,
): void {
  if (!clean(input.location_name)) {
    errors.location_name = 'Skriv hvor I holder.';
  }

  const start = clean(input.start_time);
  const end = clean(input.end_time);

  if (!start) {
    errors.start_time = 'Skriv hvornår I åbner.';
  } else if (!TIME_PATTERN.test(start)) {
    errors.start_time = 'Skriv tidspunktet som f.eks. 11:00.';
  }

  if (!end) {
    errors.end_time = 'Skriv hvornår I lukker.';
  } else if (!TIME_PATTERN.test(end)) {
    errors.end_time = 'Skriv tidspunktet som f.eks. 11:00.';
  }

  // Only comparable once both are well-formed. 'HH:MM' sorts correctly as text.
  if (start && end && TIME_PATTERN.test(start) && TIME_PATTERN.test(end) && end <= start) {
    errors.end_time = 'Sluttidspunktet skal være efter starttidspunktet.';
  }
}

export function validateStop(input: StopInput): Result<WeeklyStop> {
  const errors: Record<string, string> = {};

  if (input.closed) {
    return {
      ok: true,
      value: {
        weekday: input.weekday,
        location_name: null,
        address: null,
        map_url: null,
        start_time: null,
        end_time: null,
        note: clean(input.note),
      },
    };
  }

  validateOpenFields(input, errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      weekday: input.weekday,
      location_name: clean(input.location_name),
      address: clean(input.address),
      map_url: clean(input.map_url),
      start_time: clean(input.start_time),
      end_time: clean(input.end_time),
      note: clean(input.note),
    },
  };
}

interface ExceptionInput {
  date: string;
  closed: boolean;
  location_name?: string;
  address?: string;
  map_url?: string;
  start_time?: string;
  end_time?: string;
  note?: string;
}

export function validateException(
  input: ExceptionInput,
  todayISO: string,
): Result<ScheduleException> {
  const errors: Record<string, string> = {};

  const date = clean(input.date);
  if (!date || !isRealDate(date)) {
    errors.date = 'Vælg en dato.';
  } else if (date < todayISO) {
    errors.date = 'Datoen er allerede passeret.';
  }

  if (!input.closed) validateOpenFields(input, errors);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      date: date!,
      is_closed: input.closed ? 1 : 0,
      location_name: input.closed ? null : clean(input.location_name),
      address: input.closed ? null : clean(input.address),
      map_url: input.closed ? null : clean(input.map_url),
      start_time: input.closed ? null : clean(input.start_time),
      end_time: input.closed ? null : clean(input.end_time),
      note: clean(input.note),
    },
  };
}

interface BannerInput {
  text?: string;
  until?: string;
}

export function validateBanner(
  input: BannerInput,
  todayISO: string,
): Result<{ banner_text: string; banner_until: string }> {
  const errors: Record<string, string> = {};
  const text = clean(input.text);
  const until = clean(input.until);

  // No text means no banner. Both keys are cleared so a stale end date cannot
  // resurrect an old message later.
  if (!text) {
    return { ok: true, value: { banner_text: '', banner_until: '' } };
  }

  if (text.length > MAX_BANNER_LENGTH) {
    errors.text = `Beskeden må højst være ${MAX_BANNER_LENGTH} tegn.`;
  }

  if (!until || !isRealDate(until)) {
    errors.until = 'Vælg hvor længe beskeden skal vises.';
  } else if (until < todayISO) {
    errors.until = 'Datoen er allerede passeret.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, value: { banner_text: text, banner_until: until! } };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `pnpm vitest run tests/unit/validate.test.ts`
Expected: PASS — 18 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate.ts tests/unit/validate.test.ts
git commit -m "feat: add admin form validation with Danish messages"
```

---

### Task 9: Cloudflare Access verification

**Goal:** Verified identity for `/admin`, with the forged-header path closed.

**Files:**
- Create: `src/lib/access.ts`, `src/middleware.ts`
- Test: `tests/unit/access.test.ts`

**Acceptance Criteria:**
- [ ] A token signed by the right key with matching issuer and audience yields the email
- [ ] A wrong issuer, wrong audience, expired token, or bad signature is rejected
- [ ] A missing header is rejected
- [ ] Middleware returns 403 for `/admin` when verification fails and leaves public pages untouched
- [ ] The verifier accepts an injected key set so it is testable without network access

**Verify:** `pnpm vitest run tests/unit/access.test.ts` → all tests pass

**Steps:**

- [ ] **Step 1: Write the failing tests**

`tests/unit/access.test.ts`:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { createAccessVerifier, ACCESS_HEADER } from '../../src/lib/access';

const TEAM_DOMAIN = 'chicks.cloudflareaccess.com';
const ISSUER = `https://${TEAM_DOMAIN}`;
const AUD = 'aud-tag-for-the-admin-app';

let privateKey: CryptoKey;
let keySet: JWTVerifyGetKey;
let otherPrivateKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwk.kid = 'test-key';
  jwk.alg = 'RS256';
  keySet = createLocalJWKSet({ keys: [jwk] });

  // A second key, never published in the key set — used to forge a signature.
  const otherPair = await generateKeyPair('RS256', { extractable: true });
  otherPrivateKey = otherPair.privateKey;
});

async function sign(
  claims: Record<string, unknown>,
  options: { issuer?: string; audience?: string; expiresIn?: string; key?: CryptoKey } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuedAt()
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? AUD)
    .setExpirationTime(options.expiresIn ?? '1h')
    .sign(options.key ?? privateKey);
}

function verifier() {
  return createAccessVerifier({ teamDomain: TEAM_DOMAIN, aud: AUD, keySet });
}

describe('createAccessVerifier', () => {
  it('returns the email from a valid token', async () => {
    const token = await sign({ email: 'ejer@example.com' });
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: token },
    });
    await expect(verifier()(request)).resolves.toBe('ejer@example.com');
  });

  it('rejects a missing header', async () => {
    const request = new Request('https://example.dk/admin');
    await expect(verifier()(request)).resolves.toBeNull();
  });

  it('rejects a token from the wrong issuer', async () => {
    const token = await sign({ email: 'ejer@example.com' }, { issuer: 'https://evil.example' });
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: token },
    });
    await expect(verifier()(request)).resolves.toBeNull();
  });

  it('rejects a token for a different application', async () => {
    const token = await sign({ email: 'ejer@example.com' }, { audience: 'some-other-app' });
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: token },
    });
    await expect(verifier()(request)).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await sign({ email: 'ejer@example.com' }, { expiresIn: '-1h' });
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: token },
    });
    await expect(verifier()(request)).resolves.toBeNull();
  });

  it('rejects a token signed by an unknown key', async () => {
    const token = await sign({ email: 'ejer@example.com' }, { key: otherPrivateKey });
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: token },
    });
    await expect(verifier()(request)).resolves.toBeNull();
  });

  it('rejects a valid token carrying no email', async () => {
    const token = await sign({});
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: token },
    });
    await expect(verifier()(request)).resolves.toBeNull();
  });

  it('rejects a header that is not a token at all', async () => {
    const request = new Request('https://example.dk/admin', {
      headers: { [ACCESS_HEADER]: 'not-a-jwt' },
    });
    await expect(verifier()(request)).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm vitest run tests/unit/access.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/access`

- [ ] **Step 3: Implement the verifier**

`src/lib/access.ts`:

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';

export const ACCESS_HEADER = 'cf-access-jwt-assertion';

export interface AccessVerifierOptions {
  teamDomain: string; // e.g. 'chicks.cloudflareaccess.com'
  aud: string; // the Access application's AUD tag
  /** Injected in tests. Production fetches the team's published keys. */
  keySet?: JWTVerifyGetKey;
}

/** Remote key sets cache their fetches, so build each one only once. */
const remoteKeySets = new Map<string, JWTVerifyGetKey>();

function keySetFor(issuer: string): JWTVerifyGetKey {
  let keySet = remoteKeySets.get(issuer);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    remoteKeySets.set(issuer, keySet);
  }
  return keySet;
}

/**
 * Build a verifier for the Cf-Access-Jwt-Assertion header.
 *
 * The header is never trusted on its own: anything that can reach the Worker
 * directly can set it. Only a signature from the team's published keys, with
 * a matching issuer and audience, counts as proof of identity.
 *
 * Returns the verified email, or null if the request should be refused.
 */
export function createAccessVerifier(
  options: AccessVerifierOptions,
): (request: Request) => Promise<string | null> {
  const issuer = `https://${options.teamDomain}`;
  const keySet = options.keySet ?? keySetFor(issuer);

  return async function verify(request: Request): Promise<string | null> {
    const token = request.headers.get(ACCESS_HEADER);
    if (!token) return null;

    try {
      const { payload } = await jwtVerify(token, keySet, {
        issuer,
        audience: options.aud,
      });
      const email = payload.email;
      return typeof email === 'string' && email.length > 0 ? email : null;
    } catch {
      // Expired, forged, malformed, wrong audience — all the same answer.
      return null;
    }
  };
}
```

- [ ] **Step 4: Add the middleware**

`src/middleware.ts`:

```ts
import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { createAccessVerifier } from './lib/access';

const DENIED = `<!doctype html>
<html lang="da"><head><meta charset="utf-8"><title>Ingen adgang</title></head>
<body style="font-family: system-ui; padding: 2rem; max-width: 32rem;">
<h1>Ingen adgang</h1>
<p>Du har ikke adgang til denne side. Kontakt den, der passer hjemmesiden.</p>
</body></html>`;

export const onRequest = defineMiddleware(async (context, next) => {
  if (!context.url.pathname.startsWith('/admin')) {
    return next();
  }

  const verify = createAccessVerifier({
    teamDomain: env.ACCESS_TEAM_DOMAIN,
    aud: env.ACCESS_AUD,
  });

  // Fail closed. While the domain transfer is pending there is no Access
  // application yet, so these are unset — deny rather than allow.
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return new Response(DENIED, {
      status: 403,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const email = await verify(context.request);
  if (!email) {
    return new Response(DENIED, {
      status: 403,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  context.locals.accessEmail = email;
  return next();
});
```

- [ ] **Step 5: Declare the vars for local development**

Add to `wrangler.jsonc`:

```jsonc
  "vars": {
    // Deliberately empty until Task 12 creates the Access application, which
    // needs the domain. The middleware fails closed on empty values, so /admin
    // denies every request until Access is genuinely configured. Declaring the
    // keys here is what puts them on the generated Env type.
    "ACCESS_TEAM_DOMAIN": "",
    "ACCESS_AUD": ""
  },
```

Then `pnpm wrangler types`. The real values are filled in during Task 12, once the domain has transferred and the Access application exists. Until then the middleware denies `/admin` in production, which is correct; Task 10 adds a development-only bypass so the screen can still be built and used locally.

- [ ] **Step 6: Run the tests and watch them pass**

Run: `pnpm vitest run tests/unit/access.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 7: Commit**

```bash
git add src/lib/access.ts src/middleware.ts tests/unit/access.test.ts wrangler.jsonc
git commit -m "feat: verify Cloudflare Access JWTs before serving /admin"
```

---

### Task 10: Admin screen

**Goal:** The one page the owner uses — weekly pattern, exceptions, and banner — handling its own form posts so a mistake never costs her what she typed.

**Files:**
- Create: `src/pages/admin/index.astro`, `src/components/admin/StopRow.astro`, `src/components/admin/Field.astro`
- Modify: `src/middleware.ts` (development bypass)
- Test: `tests/worker/admin.test.ts`

**Acceptance Criteria:**
- [ ] Three sections, each with its own save button
- [ ] A validation failure re-renders with the submitted values and errors beside the offending fields
- [ ] A successful save redirects (POST-redirect-GET) and shows a Danish confirmation
- [ ] Deleting an exception asks for confirmation first
- [ ] The screen works with JavaScript disabled
- [ ] Requests without a valid Access token get 403

**Verify:** `pnpm test:worker && pnpm build && pnpm astro check` → tests pass, build succeeds, `0 errors`

**Steps:**

- [ ] **Step 1: Add a development bypass to the middleware**

Without this, `/admin` cannot be opened locally, since there is no Access in front of `pnpm dev`.

In `src/middleware.ts`, insert immediately after the `startsWith('/admin')` check:

```ts
  // Local development only. `import.meta.env.DEV` is false in every build that
  // is deployed, so this cannot weaken production.
  if (import.meta.env.DEV) {
    context.locals.accessEmail = 'dev@localhost';
    return next();
  }
```

- [ ] **Step 2: Create the field component**

`src/components/admin/Field.astro`:

```astro
---
interface Props {
  label: string;
  name: string;
  value?: string | null;
  type?: string;
  error?: string;
  placeholder?: string;
}

const { label, name, value = '', type = 'text', error, placeholder } = Astro.props;
const id = `field-${name}`;
---

<div class="flex flex-col gap-1">
  <label for={id} class="text-sm font-medium text-stone-700">{label}</label>
  <input
    id={id}
    name={name}
    type={type}
    value={value ?? ''}
    placeholder={placeholder}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${id}-error` : undefined}
    class:list={[
      'rounded-md border px-3 py-2 text-base',
      error ? 'border-red-500 bg-red-50' : 'border-stone-300 bg-white',
    ]}
  />
  {error && <p id={`${id}-error`} class="text-sm font-medium text-red-700">{error}</p>}
</div>
```

- [ ] **Step 3: Create the weekly row component**

`src/components/admin/StopRow.astro`:

```astro
---
import Field from './Field.astro';
import type { WeeklyStop } from '../../lib/types';
import { DANISH_WEEKDAYS } from '../../lib/datetime';

interface Props {
  stop: WeeklyStop;
  errors?: Record<string, string>;
}

const { stop, errors = {} } = Astro.props;
const w = stop.weekday;
const closed = stop.location_name === null;
---

<fieldset class="rounded-lg border border-stone-200 bg-white p-4">
  <legend class="px-1 text-base font-semibold capitalize">{DANISH_WEEKDAYS[w]}</legend>

  <input type="hidden" name={`weekday_${w}`} value={String(w)} />

  <label class="mt-2 flex items-center gap-2 text-base">
    <input type="checkbox" name={`closed_${w}`} checked={closed} class="h-5 w-5" />
    Lukket denne dag
  </label>

  <div class="mt-3 grid gap-3 sm:grid-cols-2">
    <Field label="Sted" name={`location_name_${w}`} value={stop.location_name} error={errors.location_name} placeholder="F.eks. Torvet" />
    <Field label="Adresse" name={`address_${w}`} value={stop.address} placeholder="F.eks. Torvet 1" />
    <Field label="Fra kl." name={`start_time_${w}`} value={stop.start_time} error={errors.start_time} placeholder="11:00" />
    <Field label="Til kl." name={`end_time_${w}`} value={stop.end_time} error={errors.end_time} placeholder="14:00" />
    <Field label="Link til kort (valgfrit)" name={`map_url_${w}`} value={stop.map_url} />
    <Field label="Bemærkning (valgfrit)" name={`note_${w}`} value={stop.note} />
  </div>
</fieldset>
```

- [ ] **Step 4: Write the admin page**

`src/pages/admin/index.astro`:

```astro
---
import Base from '../../layouts/Base.astro';
import Field from '../../components/admin/Field.astro';
import StopRow from '../../components/admin/StopRow.astro';
import { todayInCopenhagen, formatDanishDate, DANISH_WEEKDAYS, weekdayIndex } from '../../lib/datetime';
import { validateStop, validateException, validateBanner } from '../../lib/validate';
import {
  getWeeklyStops,
  getUpcomingExceptions,
  getSettings,
  updateWeeklyStop,
  upsertException,
  deleteException,
  setSettings,
} from '../../lib/db';
import type { WeeklyStop } from '../../lib/types';
import { env } from 'cloudflare:workers';

Astro.response.headers.set('Cache-Control', 'no-store');

const db = env.DB;
const today = todayInCopenhagen();

// Errors and submitted values survive a failed POST so nothing she typed is lost.
let stopErrors: Record<number, Record<string, string>> = {};
let exceptionErrors: Record<string, string> = {};
let bannerErrors: Record<string, string> = {};
let submittedStops: WeeklyStop[] | null = null;
let submittedException: Record<string, string> = {};
// Checkbox and banner state must survive a failed POST too. A checkbox that is
// off sends nothing at all, so it cannot be recovered from the submitted values
// the way a text field can — it has to be threaded through explicitly.
let submittedClosed: Record<number, boolean> | null = null;
let submittedExceptionClosed = false;
let submittedBanner: Record<string, string> | null = null;

function str(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === 'string' ? value : '';
}

if (Astro.request.method === 'POST') {
  const data = await Astro.request.formData();
  const form = str(data, '_form');

  if (form === 'weekly') {
    const candidates: WeeklyStop[] = [];
    const errors: Record<number, Record<string, string>> = {};

    for (let w = 0; w < 7; w++) {
      const result = validateStop({
        weekday: w,
        closed: data.get(`closed_${w}`) !== null,
        location_name: str(data, `location_name_${w}`),
        address: str(data, `address_${w}`),
        map_url: str(data, `map_url_${w}`),
        start_time: str(data, `start_time_${w}`),
        end_time: str(data, `end_time_${w}`),
        note: str(data, `note_${w}`),
      });

      if (result.ok) {
        candidates.push(result.value);
      } else {
        errors[w] = result.errors;
        // Keep what she typed so the re-render shows it back to her.
        candidates.push({
          weekday: w,
          location_name: str(data, `location_name_${w}`) || null,
          address: str(data, `address_${w}`) || null,
          map_url: str(data, `map_url_${w}`) || null,
          start_time: str(data, `start_time_${w}`) || null,
          end_time: str(data, `end_time_${w}`) || null,
          note: str(data, `note_${w}`) || null,
        });
      }
    }

    if (Object.keys(errors).length === 0) {
      // All seven or none — a partial save would leave a confusing half-state.
      for (const stop of candidates) await updateWeeklyStop(db, stop);
      return Astro.redirect('/admin?gemt=ugeplan', 303);
    }

    stopErrors = errors;
    submittedStops = candidates;
  }

  if (form === 'exception') {
    const result = validateException(
      {
        date: str(data, 'date'),
        closed: data.get('closed') !== null,
        location_name: str(data, 'location_name'),
        address: str(data, 'address'),
        map_url: str(data, 'map_url'),
        start_time: str(data, 'start_time'),
        end_time: str(data, 'end_time'),
        note: str(data, 'note'),
      },
      today,
    );

    if (result.ok) {
      await upsertException(db, result.value);
      return Astro.redirect('/admin?gemt=undtagelse', 303);
    }

    exceptionErrors = result.errors;
    for (const key of ['date', 'location_name', 'address', 'map_url', 'start_time', 'end_time', 'note']) {
      submittedException[key] = str(data, key);
    }
  }

  if (form === 'delete-exception') {
    await deleteException(db, str(data, 'date'));
    return Astro.redirect('/admin?gemt=slettet', 303);
  }

  if (form === 'banner') {
    const result = validateBanner({ text: str(data, 'text'), until: str(data, 'until') }, today);
    if (result.ok) {
      await setSettings(db, result.value);
      return Astro.redirect('/admin?gemt=besked', 303);
    }
    bannerErrors = result.errors;
  }
}

const stops = submittedStops ?? (await getWeeklyStops(db));
const exceptions = await getUpcomingExceptions(db, today);
const settings = await getSettings(db);

const saved = Astro.url.searchParams.get('gemt');
const savedMessages: Record<string, string> = {
  ugeplan: 'Ugeplanen er gemt.',
  undtagelse: 'Undtagelsen er gemt.',
  slettet: 'Undtagelsen er slettet.',
  besked: 'Beskeden er gemt.',
};
---

<Base title="Rediger">
  <h1 class="text-2xl font-bold tracking-tight">Rediger hjemmesiden</h1>
  <p class="mt-1 text-sm text-stone-500">Logget ind som {Astro.locals.accessEmail}</p>

  {
    saved && savedMessages[saved] && (
      <p class="mt-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 font-medium text-green-900">
        {savedMessages[saved]}
      </p>
    )
  }

  <!-- Weekly pattern -->
  <section class="mt-8">
    <h2 class="text-lg font-semibold">Ugeplan</h2>
    <p class="mt-1 text-sm text-stone-600">
      Sådan ser en almindelig uge ud. Den gentager sig selv, indtil du ændrer den.
    </p>

    <form method="post" class="mt-4 flex flex-col gap-4">
      <input type="hidden" name="_form" value="weekly" />
      {stops.map((stop) => <StopRow stop={stop} errors={stopErrors[stop.weekday]} />)}
      <button type="submit" class="rounded-md bg-stone-900 px-5 py-3 text-base font-semibold text-white">
        Gem ugeplan
      </button>
    </form>
  </section>

  <!-- Exceptions -->
  <section class="mt-12">
    <h2 class="text-lg font-semibold">Undtagelser</h2>
    <p class="mt-1 text-sm text-stone-600">
      Enkelte dage der er anderledes end ugeplanen — f.eks. en lukkedag eller et andet sted.
    </p>

    {
      exceptions.length > 0 && (
        <ul class="mt-4 flex flex-col gap-2">
          {exceptions.map((ex) => (
            <li class="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
              <div>
                <p class="font-medium">
                  <span class="capitalize">{DANISH_WEEKDAYS[weekdayIndex(ex.date)]}</span>{' '}
                  {formatDanishDate(ex.date)}
                </p>
                <p class="text-sm text-stone-600">
                  {ex.is_closed === 1 ? 'Lukket' : `${ex.location_name} kl. ${ex.start_time}–${ex.end_time}`}
                  {ex.note && ` · ${ex.note}`}
                </p>
              </div>
              <form method="post" onsubmit="return confirm('Er du sikker på, at du vil slette denne undtagelse?')">
                <input type="hidden" name="_form" value="delete-exception" />
                <input type="hidden" name="date" value={ex.date} />
                <button type="submit" class="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium">
                  Slet
                </button>
              </form>
            </li>
          ))}
        </ul>
      )
    }

    <form method="post" class="mt-4 rounded-lg border border-stone-200 bg-white p-4">
      <input type="hidden" name="_form" value="exception" />
      <h3 class="font-medium">Tilføj undtagelse</h3>

      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Dato" name="date" type="date" value={submittedException.date} error={exceptionErrors.date} />
      </div>

      <label class="mt-3 flex items-center gap-2 text-base">
        <input type="checkbox" name="closed" class="h-5 w-5" />
        Lukket denne dag
      </label>

      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Sted" name="location_name" value={submittedException.location_name} error={exceptionErrors.location_name} />
        <Field label="Adresse" name="address" value={submittedException.address} />
        <Field label="Fra kl." name="start_time" value={submittedException.start_time} error={exceptionErrors.start_time} placeholder="11:00" />
        <Field label="Til kl." name="end_time" value={submittedException.end_time} error={exceptionErrors.end_time} placeholder="14:00" />
        <Field label="Link til kort (valgfrit)" name="map_url" value={submittedException.map_url} />
        <Field label="Bemærkning (valgfrit)" name="note" value={submittedException.note} />
      </div>

      <button type="submit" class="mt-4 rounded-md bg-stone-900 px-5 py-3 text-base font-semibold text-white">
        Gem undtagelse
      </button>
    </form>
  </section>

  <!-- Banner -->
  <section class="mt-12 mb-8">
    <h2 class="text-lg font-semibold">Besked på forsiden</h2>
    <p class="mt-1 text-sm text-stone-600">
      En kort besked øverst på forsiden. Den forsvinder af sig selv efter datoen.
    </p>

    <form method="post" class="mt-4 rounded-lg border border-stone-200 bg-white p-4">
      <input type="hidden" name="_form" value="banner" />
      <div class="grid gap-3">
        <Field label="Besked" name="text" value={submittedBanner?.text ?? settings.banner_text} error={bannerErrors.text} placeholder="F.eks. Lukket uge 29 — ferie" />
        <Field label="Vis til og med" name="until" type="date" value={submittedBanner?.until ?? settings.banner_until} error={bannerErrors.until} />
      </div>
      <p class="mt-2 text-sm text-stone-500">Slet teksten for at fjerne beskeden.</p>
      <button type="submit" class="mt-4 rounded-md bg-stone-900 px-5 py-3 text-base font-semibold text-white">
        Gem besked
      </button>
    </form>
  </section>
</Base>
```

- [ ] **Step 5: Write the access-control test**

`tests/worker/admin.test.ts`:

```ts
import { exports } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';

describe('/admin access control', () => {
  it('refuses a request with no Access token', async () => {
    const response = await exports.default.fetch('https://example.dk/admin');
    expect(response.status).toBe(403);
  });

  it('refuses a forged Access header', async () => {
    const response = await exports.default.fetch('https://example.dk/admin', {
      headers: { 'cf-access-jwt-assertion': 'obviously.not.valid' },
    });
    expect(response.status).toBe(403);
  });

  it('refuses a POST with no Access token', async () => {
    const body = new FormData();
    body.set('_form', 'banner');
    body.set('text', 'Hacked');
    body.set('until', '2099-01-01');

    const response = await exports.default.fetch('https://example.dk/admin', {
      method: 'POST',
      body,
    });
    expect(response.status).toBe(403);
  });

  it('leaves public pages alone', async () => {
    // Asserting "not 403" rather than "200" keeps this test about the access
    // guard's scope, not about how the test pool serves static assets.
    const response = await exports.default.fetch('https://example.dk/');
    expect(response.status).not.toBe(403);
  });
});
```

Fetching the Worker in tests requires it to be built. With adapter 14 the built Worker is `dist/server/entry.mjs`
and its matching config is the generated `dist/server/wrangler.json` (see Platform notes) — the
root `wrangler.jsonc` points `main` at a package export and its `assets.directory` is not the
shipped one. This is already solved: `vitest.workers.config.ts` sets `main: './dist/server/entry.mjs'`
and `test:worker` runs `astro build` first. Note `SELF` is deprecated — use
`import { exports } from 'cloudflare:workers'` and `exports.default.fetch(...)`. If that cannot be
made to work against this adapter's output, say so rather than forcing it: the same guarantees can
be covered by unit-testing the middleware's `onRequest` directly, and Task 9 already covers JWT
rejection. Add the build to the worker test script in `package.json`:

```json
    "test:worker": "astro build && vitest run -c vitest.workers.config.ts",
```

- [ ] **Step 6: Check it by hand**

Run: `pnpm dev`, open `http://localhost:4321/admin`

Confirm each of these:
- Saving a weekday with a location but no times shows a red error next to "Fra kl." and keeps the location text
- Saving valid times redirects and shows "Ugeplanen er gemt."
- Adding an exception in the past shows "Datoen er allerede passeret."
- Deleting an exception asks for confirmation
- Clearing the banner text removes the banner from `/`
- The page still works with JavaScript disabled (only the delete confirmation is lost)

- [ ] **Step 7: Run all tests**

Run: `pnpm test:all`
Expected: PASS — every unit and worker test.

Then: `pnpm build && pnpm astro check`
Expected: build succeeds, `0 errors`.

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin src/components/admin src/middleware.ts tests/worker/admin.test.ts package.json
git commit -m "feat: add admin screen for schedule, exceptions, and banner"
```

---

### Task 11: Deploy pipeline (no domain required)

**Goal:** Prove the whole build-migrate-deploy path works against the real Cloudflare account, while `chicksonwheels.dk` is still being transferred.

**Files:**
- Create: `README.md` (replace), `docs/runbook.md`

**Acceptance Criteria:**
- [ ] Migrations are applied to the remote D1 database
- [ ] The Worker deploys successfully
- [ ] The Worker has no routes and no `workers.dev` hostname, so nothing is publicly reachable
- [ ] The runbook covers rolling back and inspecting the database

**Verify:** `pnpm wrangler deployments list` → shows a deployment; `curl` against any hostname → nothing resolves to this Worker

**Steps:**

- [ ] **Step 1: Apply migrations to the remote database**

```bash
pnpm wrangler d1 migrations apply chicks_on_wheels --remote
```

- [ ] **Step 2: Deploy with no routes**

`workers_dev: false` is already set and no `routes` block exists yet, so this deploys the Worker
without making it reachable by anyone. That is the point: it exercises the real build, upload, and
binding wiring without exposing `/admin` before Cloudflare Access exists to guard it.

```bash
pnpm deploy
```

- [ ] **Step 3: Confirm it deployed and is unreachable**

```bash
pnpm wrangler deployments list
```
Expected: at least one deployment listed.

The Worker has no route and no `workers.dev` subdomain, so there is no URL that serves it. Verify
nothing was published by accident:

```bash
pnpm wrangler deployments list 2>&1 | grep -i "workers.dev" && echo "UNEXPECTED — investigate" || echo "no workers.dev hostname, as intended"
```

- [ ] **Step 4: Seed the real weekly pattern**

The owner will normally do this from `/admin`, but that needs the domain. Seed directly for now,
substituting her real locations and times:

```bash
pnpm wrangler d1 execute chicks_on_wheels --remote --command \
  "UPDATE weekly_stops SET location_name='Torvet', address='Torvet 1', start_time='11:00', end_time='14:00' WHERE weekday=0"
```

- [ ] **Step 5: Write the runbook and README**

Use the contents given in Task 12, minus the Access sections, and add them there when the domain lands.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/runbook.md
git commit -m "chore: add deploy pipeline, runbook, and README"
```

---

### Task 12: Domain, Access, and real content

**Goal:** The site live on its domain, `/admin` reachable only by the owner, and a runbook for whoever maintains it.

**Files:**
- Create: `README.md` (replace), `docs/runbook.md`
- Modify: `wrangler.jsonc`, `src/pages/kontakt.astro`, `src/pages/index.astro`

**Acceptance Criteria:**
- [ ] The site serves on the production domain
- [ ] `/admin` prompts for Access login and admits only the owner's email
- [ ] `*.workers.dev` does not resolve to this Worker
- [ ] Migrations are applied to the remote database
- [ ] The weekly pattern is seeded with real locations
- [ ] The runbook covers adding a user, restoring access, and rolling back

**Verify:** `curl -sI https://<domain>/admin` → `302` to the Access login (not `200`); `curl -s https://<domain>/ | grep -q "Hvor er vi"` → matches

**Steps:**

- [ ] **Step 1: Register the domain and create the Access application**

In the Cloudflare dashboard:

1. Register the domain through Cloudflare Registrar, or add it and move the nameservers.
2. Go to **Zero Trust → Access controls → Applications → Add an application → Self-hosted**.
3. Name it `Chicks on Wheels admin`. Add the public hostname with path `admin`.
4. Add an Allow policy: **Include → Emails →** the owner's address.
5. Set the session duration to **30 days**, so she rarely has to log in again.
6. Copy the **Application Audience (AUD) Tag** from the application's overview.

- [ ] **Step 2: Fill in the real Access values**

In `wrangler.jsonc`, replace the placeholders from Task 9:

```jsonc
  "vars": {
    "ACCESS_TEAM_DOMAIN": "<your-team>.cloudflareaccess.com",
    "ACCESS_AUD": "<the AUD tag copied in step 1>"
  },
```

Neither value is a secret — the AUD tag is an identifier, not a credential — so `vars` is correct and `wrangler secret` is unnecessary.

- [ ] **Step 3: Bind the custom domain**

Add to `wrangler.jsonc`, substituting the real hostname:

```jsonc
  "routes": [
    { "pattern": "chicksonwheels.dk", "custom_domain": true },
    { "pattern": "www.chicksonwheels.dk", "custom_domain": true }
  ],
```

- [ ] **Step 4: Replace the placeholder contact details**

In `src/pages/kontakt.astro`, replace `phone`, `phoneHref`, and `email` with the owner's real details. In `src/pages/index.astro`, replace the phone number in the failure fallback with the same one.

Grep to confirm nothing is left behind:

```bash
grep -rn "12 34 56 78\|12345678\|hej@chicksonwheels.dk" src/
```

Expected: no matches once all three sites are updated.

- [ ] **Step 5: Deploy**

```bash
pnpm deploy
```

This builds, applies migrations to the remote D1, and deploys.

- [ ] **Step 6: Seed the real weekly pattern**

Either log in at `https://<domain>/admin` and fill in the seven rows through the screen — which doubles as the owner's first walkthrough — or seed directly:

```bash
pnpm wrangler d1 execute chicks_on_wheels --remote --command \
  "UPDATE weekly_stops SET location_name='Torvet', address='Torvet 1', start_time='11:00', end_time='14:00' WHERE weekday=0"
```

- [ ] **Step 7: Verify the deployment**

```bash
curl -sI https://chicksonwheels.dk/admin | head -1
```
Expected: `HTTP/2 302` redirecting to the Access login. A `200` means Access is not in front of the path — stop and fix the application's hostname and path before going further.

```bash
curl -s https://chicksonwheels.dk/ | grep -q "Hvor er vi" && echo ok
```
Expected: `ok`

```bash
curl -sI https://chicks-on-wheels.<subdomain>.workers.dev | head -1
```
Expected: failure to resolve or a 404 — never a page. This confirms `workers_dev: false` closed the unauthenticated route past Access.

- [ ] **Step 8: Connect Workers Builds**

In the dashboard, under the Worker's **Settings → Build**, connect the GitHub repository. Set:
- Build command: `pnpm build`
- Deploy command: `pnpm wrangler d1 migrations apply chicks_on_wheels --remote && pnpm wrangler deploy`
- Branch: `main`

- [ ] **Step 9: Write the runbook**

`docs/runbook.md`:

```markdown
# Runbook

## Giving someone access to /admin

Zero Trust → Access controls → Applications → *Chicks on Wheels admin* → Policies.
Add the email address to the Allow policy. No deployment is needed.

## The owner cannot log in

1. Check the email in the Access policy matches the one she is using.
2. Zero Trust → Logs → Access shows every attempt and why it was refused.
3. She should open the site in a normal browser window; a private window loses
   the session every time.

## Changing the services or contact text

Edit `src/content/ydelser.md` or `src/pages/kontakt.astro` and push to `main`.
Workers Builds deploys it.

## Rolling back a bad deploy

    pnpm wrangler rollback

Or pick a previous version under the Worker's Deployments tab.
Note that a rollback does not undo a database migration.

## Inspecting the database

    pnpm wrangler d1 execute chicks_on_wheels --remote --command "SELECT * FROM weekly_stops ORDER BY weekday"

## Logs

    pnpm wrangler tail
```

- [ ] **Step 10: Replace the README**

`README.md`:

```markdown
# Chicks on Wheels

Website for a food truck. The owner edits the schedule at `/admin`.

- Design: `docs/superpowers/specs/2026-08-22-food-truck-website-design.md`
- Plan: `docs/superpowers/plans/2026-08-22-food-truck-website.md`
- Runbook: `docs/runbook.md`

## Development

    pnpm install
    pnpm wrangler d1 migrations apply chicks_on_wheels --local
    pnpm dev

`/admin` skips the Access check in development and reports you as
`dev@localhost`.

## Tests

    pnpm test        # pure logic, fast
    pnpm test:worker # against a real local D1 in the Workers runtime
    pnpm test:all

## Deploy

Push to `main`. Workers Builds applies migrations and deploys.
```

- [ ] **Step 11: Commit**

```bash
git add README.md docs/runbook.md wrangler.jsonc src/pages/kontakt.astro src/pages/index.astro
git commit -m "chore: configure production deployment and Access"
```

---

## Verification summary

| Task | Command | Expected |
| --- | --- | --- |
| 0 | `pnpm build && pnpm astro check` | build succeeds, `0 errors` |
| 1 | `pnpm vitest run tests/unit/datetime.test.ts` | 12 pass |
| 2 | `pnpm vitest run tests/unit/schedule.test.ts` | 16 pass |
| 3 | `pnpm test:worker` | 4 pass |
| 4 | `pnpm test:worker` | 12 pass |
| 5 | `pnpm build && pnpm astro check` | build succeeds, `0 errors` |
| 6 | `pnpm build && pnpm astro check` | build succeeds, `0 errors` |
| 7 | `pnpm build && ls dist/client/ydelser/index.html dist/client/kontakt/index.html` | both exist |
| 8 | `pnpm vitest run tests/unit/validate.test.ts` | 18 pass |
| 9 | `pnpm vitest run tests/unit/access.test.ts` | 8 pass |
| 10 | `pnpm test:all && pnpm build && pnpm astro check` | all pass, `0 errors` |
| 11 | `pnpm wrangler deployments list` | a deployment listed, no workers.dev hostname |
| 12 | `curl -sI https://<domain>/admin \| head -1` | `HTTP/2 302` |

**Task 12 is blocked** until `chicksonwheels.dk` transfers into the private Cloudflare account. Everything else can complete without it.
