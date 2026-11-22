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
