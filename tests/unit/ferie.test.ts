import { describe, it, expect } from 'vitest';
import { resolveFerie, ferieBannerTekst } from '../../src/lib/ferie';
import { resolveWeek } from '../../src/lib/schedule';
import { validateFerie, MAX_BANNER_LENGTH } from '../../src/lib/validate';
import type { WeeklyStop, ScheduleException } from '../../src/lib/types';

const open = (weekday: number): WeeklyStop => ({
  weekday,
  location_name: 'Torvet',
  address: 'Torvet 1',
  map_url: null,
  start_time: '11:00',
  end_time: '14:00',
  note: null,
});
const PATTERN = [0, 1, 2, 3, 4, 5, 6].map(open);

describe('ferieBannerTekst', () => {
  it('names one month once when the holiday stays inside it', () => {
    expect(ferieBannerTekst('2026-07-14', '2026-07-27')).toBe('Vi holder ferie 14.–27. juli');
  });
  it('names both months when the holiday crosses a month', () => {
    expect(ferieBannerTekst('2026-06-28', '2026-07-05')).toBe('Vi holder ferie 28. juni – 5. juli');
  });
  it('reads as a single closed day when from and to are the same', () => {
    expect(ferieBannerTekst('2026-07-14', '2026-07-14')).toBe('Vi holder lukket 14. juli');
  });
});

describe('resolveFerie', () => {
  it('returns the period while it is current or ahead', () => {
    const s = { ferie_fra: '2026-07-14', ferie_til: '2026-07-27' };
    expect(resolveFerie('2026-07-01', s)).toEqual({ fra: '2026-07-14', til: '2026-07-27' });
    expect(resolveFerie('2026-07-27', s)).toEqual({ fra: '2026-07-14', til: '2026-07-27' });
  });
  it('expires on its own after the last day', () => {
    expect(resolveFerie('2026-07-28', { ferie_fra: '2026-07-14', ferie_til: '2026-07-27' })).toBeNull();
  });
  it('is null when either date is missing or empty', () => {
    expect(resolveFerie('2026-07-01', {})).toBeNull();
    expect(resolveFerie('2026-07-01', { ferie_fra: '', ferie_til: '' })).toBeNull();
    expect(resolveFerie('2026-07-01', { ferie_fra: '2026-07-14' })).toBeNull();
  });
});

describe('resolveWeek with a holiday', () => {
  // 2026-07-13 is a Monday; the holiday covers Tue 14 to Thu 16.
  const ferie = { fra: '2026-07-14', til: '2026-07-16' };

  it('closes every day inside the period, inclusive, with the note "Ferie"', () => {
    const week = resolveWeek('2026-07-13', PATTERN, [], ferie);
    expect(week.map((d) => d.isClosed)).toEqual([false, true, true, true, false, false, false]);
    expect(week[1].note).toBe('Ferie');
    expect(week[1].locationName).toBeNull();
  });

  it('lets a one-off exception win over the holiday', () => {
    const exception: ScheduleException = {
      date: '2026-07-15',
      is_closed: 0,
      location_name: 'Byfesten',
      address: null,
      map_url: null,
      start_time: '12:00',
      end_time: '20:00',
      note: null,
    };
    const week = resolveWeek('2026-07-13', PATTERN, [exception], ferie);
    expect(week[2].isClosed).toBe(false);
    expect(week[2].locationName).toBe('Byfesten');
  });

  it('changes nothing without a holiday', () => {
    expect(resolveWeek('2026-07-13', PATTERN, [], null)).toEqual(resolveWeek('2026-07-13', PATTERN, []));
  });
});

describe('validateFerie', () => {
  const today = '2026-07-01';

  it('fills the banner from the dates when the text is left empty', () => {
    const r = validateFerie({ fra: '2026-07-14', til: '2026-07-27', text: '' }, today);
    expect(r).toEqual({
      ok: true,
      value: {
        ferie_fra: '2026-07-14',
        ferie_til: '2026-07-27',
        banner_text: 'Vi holder ferie 14.–27. juli',
        banner_until: '2026-07-27',
      },
    });
  });

  it('keeps the owner\'s own banner text', () => {
    const r = validateFerie({ fra: '2026-07-14', til: '2026-07-27', text: ' Sommerferie – vi ses! ' }, today);
    expect(r.ok && r.value.banner_text).toBe('Sommerferie – vi ses!');
  });

  it('rejects missing, impossible, reversed and past dates', () => {
    expect(validateFerie({ fra: '', til: '2026-07-27' }, today)).toMatchObject({ ok: false, errors: { fra: expect.any(String) } });
    expect(validateFerie({ fra: '2026-02-30', til: '2026-07-27' }, today)).toMatchObject({ ok: false, errors: { fra: expect.any(String) } });
    expect(validateFerie({ fra: '2026-07-27', til: '2026-07-14' }, today)).toMatchObject({ ok: false, errors: { til: expect.any(String) } });
    expect(validateFerie({ fra: '2026-06-01', til: '2026-06-10' }, today)).toMatchObject({ ok: false, errors: { til: expect.any(String) } });
  });

  it('allows a holiday that has already started', () => {
    expect(validateFerie({ fra: '2026-06-28', til: '2026-07-05' }, today).ok).toBe(true);
  });

  it('rejects a period longer than 90 days, which is almost certainly a typo', () => {
    expect(validateFerie({ fra: '2026-07-01', til: '2026-12-31' }, today)).toMatchObject({ ok: false, errors: { til: expect.any(String) } });
  });

  it('rejects a banner text over the limit', () => {
    const r = validateFerie({ fra: '2026-07-14', til: '2026-07-27', text: 'x'.repeat(MAX_BANNER_LENGTH + 1) }, today);
    expect(r).toMatchObject({ ok: false, errors: { text: expect.any(String) } });
  });
});
