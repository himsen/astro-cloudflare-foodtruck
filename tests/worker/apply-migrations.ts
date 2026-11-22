import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

// Runs once per test file. The pool's isolated storage means each file starts
// from an empty database, so migrations must be reapplied for each of them.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
