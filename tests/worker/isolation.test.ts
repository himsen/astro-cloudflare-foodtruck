import { env } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';

// Proves each test file starts from a clean database. schema.test.ts inserts an
// exception for 2026-08-25; if storage were shared, this would see it.
describe('storage isolation', () => {
  it('does not see rows written by another test file', async () => {
    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM schedule_exceptions',
    ).first<{ n: number }>();
    expect(row?.n).toBe(0);
  });
});
