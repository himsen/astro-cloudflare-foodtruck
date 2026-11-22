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
