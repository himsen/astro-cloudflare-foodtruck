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
