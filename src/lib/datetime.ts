export const COPENHAGEN = 'Europe/Copenhagen';

/** Danish weekday names, indexed 0 = Monday .. 6 = Sunday. */
export const DANISH_WEEKDAYS = [
  'mandag',
  'tirsdag',
  'onsdag',
  'torsdag',
  'fredag',
  'lørdag',
  'søndag',
] as const;

/**
 * The current calendar date in Copenhagen as 'YYYY-MM-DD'.
 *
 * Workers run in UTC. Without this the site would roll over to tomorrow's
 * location at 22:00 or 23:00 local time, depending on daylight saving.
 * `en-CA` is used because it formats as YYYY-MM-DD.
 */
export function todayInCopenhagen(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COPENHAGEN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Calendar arithmetic on a 'YYYY-MM-DD' string.
 *
 * Deliberately done in UTC. These are calendar dates, not instants, so no
 * time zone should be involved — using local time here would make the result
 * depend on where the code runs.
 */
export function addDays(iso: string, days: number): string {
  const dt = parseISO(iso);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** 0 = Monday .. 6 = Sunday. */
export function weekdayIndex(iso: string): number {
  const jsDay = parseISO(iso).getUTCDay(); // 0 = Sunday
  return (jsDay + 6) % 7;
}

/** e.g. '22. august' — for display alongside the weekday name. */
export function formatDanishDate(iso: string): string {
  return new Intl.DateTimeFormat('da-DK', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
  }).format(parseISO(iso));
}

/**
 * The current clock time in Copenhagen as 'HH:MM'.
 *
 * Same reason as todayInCopenhagen: Workers run in UTC, and a deadline of
 * "16:00" means 16:00 where the truck is, not where the code runs. h23 so
 * midnight is '00:00' and never '24:00'.
 */
export function timeInCopenhagen(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: COPENHAGEN,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}
