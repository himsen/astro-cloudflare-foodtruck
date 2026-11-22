import { env } from 'cloudflare:workers';
import { describe, it, expect } from 'vitest';

describe('schema', () => {
  it('seeds seven weekday rows', async () => {
    const { results } = await env.DB.prepare(
      'SELECT weekday FROM weekly_stops ORDER BY weekday',
    ).all<{ weekday: number }>();
    expect(results.map((r) => r.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('leaves Monday, Saturday and Sunday closed', async () => {
    const { results } = await env.DB.prepare(
      `SELECT weekday FROM weekly_stops
        WHERE location_name IS NULL AND start_time IS NULL AND end_time IS NULL
        ORDER BY weekday`,
    ).all<{ weekday: number }>();
    expect(results.map((r) => r.weekday)).toEqual([0, 5, 6]);
  });

  // 0002 seeds the weekly pattern. It is the owner's to change from /admin, so
  // this pins what a *fresh* database starts with, not what production holds.
  it('seeds the weekly pattern on Tuesday through Friday', async () => {
    const { results } = await env.DB.prepare(
      `SELECT weekday, location_name, start_time, end_time FROM weekly_stops
        WHERE location_name IS NOT NULL ORDER BY weekday`,
    ).all<{ weekday: number; location_name: string; start_time: string; end_time: string }>();
    expect(results).toEqual([
      { weekday: 1, location_name: 'BØRKOP', start_time: '15:00', end_time: '18:30' },
      { weekday: 2, location_name: 'SKÆRBÆK', start_time: '15:00', end_time: '18:30' },
      { weekday: 3, location_name: 'FREDERICIA', start_time: '15:00', end_time: '18:30' },
      { weekday: 4, location_name: 'ERRITSØ', start_time: '15:00', end_time: '18:30' },
    ]);
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
    await env.DB.prepare(
      "INSERT INTO schedule_exceptions (date, is_closed) VALUES ('2026-08-25', 1)",
    ).run();
    await expect(
      env.DB.prepare(
        "INSERT INTO schedule_exceptions (date, is_closed) VALUES ('2026-08-25', 0)",
      ).run(),
    ).rejects.toThrow();
  });
});
