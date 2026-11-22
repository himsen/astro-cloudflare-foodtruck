/// <reference types="@cloudflare/vitest-pool-workers/types" />

// `Cloudflare.Env` is declaration-merged, so this adds the test-only binding
// that vitest.workers.config.ts injects. Written as an inline `import(...)`
// rather than a top-level import so this file stays a global script; a
// top-level import would scope the namespace locally and the merge would not
// take effect.
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
  }
}

// `exports` from 'cloudflare:workers' is typed from `Cloudflare.MainModule`,
// which is empty unless the project declares it. The Worker under test is the
// built `dist/server/entry.mjs` (see vitest.workers.config.ts), a plain module
// whose default export is a fetch handler — declaring that here is what gives
// `exports.default.fetch(...)` a type.
declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: { default: ExportedHandler<Env> };
  }
}
