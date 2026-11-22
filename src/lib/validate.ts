import type { WeeklyStop, ScheduleException } from './types';
import { addDays } from './datetime';
import { ferieBannerTekst } from './ferie';

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

export const MAX_BANNER_LENGTH = 200;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** True only for a real calendar date — rejects e.g. 2026-02-30. */
function isRealDate(iso: string): boolean {
  if (!DATE_PATTERN.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

interface StopInput {
  weekday: number;
  closed: boolean;
  location_name?: string;
  address?: string;
  map_url?: string;
  start_time?: string;
  end_time?: string;
  note?: string;
}

/** Shared between the weekly pattern and the open-day branch of exceptions. */
function validateOpenFields(
  input: { location_name?: string; start_time?: string; end_time?: string },
  errors: Record<string, string>,
): void {
  if (!clean(input.location_name)) {
    errors.location_name = 'Skriv hvor I holder.';
  }

  const start = clean(input.start_time);
  const end = clean(input.end_time);

  if (!start) {
    errors.start_time = 'Skriv hvornår I åbner.';
  } else if (!TIME_PATTERN.test(start)) {
    errors.start_time = 'Skriv tidspunktet som f.eks. 11:00.';
  }

  if (!end) {
    errors.end_time = 'Skriv hvornår I lukker.';
  } else if (!TIME_PATTERN.test(end)) {
    errors.end_time = 'Skriv tidspunktet som f.eks. 11:00.';
  }

  // Only comparable once both are well-formed. 'HH:MM' sorts correctly as text.
  if (start && end && TIME_PATTERN.test(start) && TIME_PATTERN.test(end) && end <= start) {
    errors.end_time = 'Sluttidspunktet skal være efter starttidspunktet.';
  }
}

export function validateStop(input: StopInput): Result<WeeklyStop> {
  const errors: Record<string, string> = {};

  if (input.closed) {
    return {
      ok: true,
      value: {
        weekday: input.weekday,
        location_name: null,
        address: null,
        map_url: null,
        start_time: null,
        end_time: null,
        note: clean(input.note),
      },
    };
  }

  validateOpenFields(input, errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      weekday: input.weekday,
      location_name: clean(input.location_name),
      address: clean(input.address),
      map_url: clean(input.map_url),
      start_time: clean(input.start_time),
      end_time: clean(input.end_time),
      note: clean(input.note),
    },
  };
}

interface ExceptionInput {
  date: string;
  closed: boolean;
  location_name?: string;
  address?: string;
  map_url?: string;
  start_time?: string;
  end_time?: string;
  note?: string;
}

export function validateException(
  input: ExceptionInput,
  todayISO: string,
): Result<ScheduleException> {
  const errors: Record<string, string> = {};

  const date = clean(input.date);
  if (!date || !isRealDate(date)) {
    errors.date = 'Vælg en dato.';
  } else if (date < todayISO) {
    errors.date = 'Datoen er allerede passeret.';
  }

  if (!input.closed) validateOpenFields(input, errors);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      date: date!,
      is_closed: input.closed ? 1 : 0,
      location_name: input.closed ? null : clean(input.location_name),
      address: input.closed ? null : clean(input.address),
      map_url: input.closed ? null : clean(input.map_url),
      start_time: input.closed ? null : clean(input.start_time),
      end_time: input.closed ? null : clean(input.end_time),
      note: clean(input.note),
    },
  };
}

interface BannerInput {
  text?: string;
  until?: string;
}

export function validateBanner(
  input: BannerInput,
  todayISO: string,
): Result<{ banner_text: string; banner_until: string }> {
  const errors: Record<string, string> = {};
  const text = clean(input.text);
  const until = clean(input.until);

  // No text means no banner. Both keys are cleared so a stale end date cannot
  // resurrect an old message later.
  if (!text) {
    return { ok: true, value: { banner_text: '', banner_until: '' } };
  }

  if (text.length > MAX_BANNER_LENGTH) {
    errors.text = `Beskeden må højst være ${MAX_BANNER_LENGTH} tegn.`;
  }

  if (!until || !isRealDate(until)) {
    errors.until = 'Vælg hvor længe beskeden skal vises.';
  } else if (until < todayISO) {
    errors.until = 'Datoen er allerede passeret.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return { ok: true, value: { banner_text: text, banner_until: until! } };
}

/** Longer than this is almost certainly a mistyped year, not a holiday. */
export const MAX_FERIE_DAYS = 90;

interface FerieInput {
  fra?: string;
  til?: string;
  text?: string;
}

/**
 * A holiday period plus the banner that announces it. The banner runs until
 * the last day of the holiday; an empty text gets the generated one.
 */
export function validateFerie(
  input: FerieInput,
  todayISO: string,
): Result<{ ferie_fra: string; ferie_til: string; banner_text: string; banner_until: string }> {
  const errors: Record<string, string> = {};
  const fra = clean(input.fra);
  const til = clean(input.til);

  if (!fra || !isRealDate(fra)) errors.fra = 'Vælg første feriedag.';
  if (!til || !isRealDate(til)) {
    errors.til = 'Vælg sidste feriedag.';
  } else if (fra && isRealDate(fra)) {
    if (til < fra) errors.til = 'Sidste feriedag ligger før den første.';
    else if (til < todayISO) errors.til = 'Ferien er allerede slut.';
    else if (til > addDays(fra, MAX_FERIE_DAYS)) errors.til = `Ferien kan højst vare ${MAX_FERIE_DAYS} dage.`;
  }

  const text = clean(input.text) ?? (fra && til && !errors.fra && !errors.til ? ferieBannerTekst(fra, til) : null);
  if (text && text.length > MAX_BANNER_LENGTH) {
    errors.text = `Beskeden må højst være ${MAX_BANNER_LENGTH} tegn.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { ferie_fra: fra!, ferie_til: til!, banner_text: text!, banner_until: til! },
  };
}
