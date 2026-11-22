import { env } from 'cloudflare:workers';
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
