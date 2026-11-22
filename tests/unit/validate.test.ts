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
