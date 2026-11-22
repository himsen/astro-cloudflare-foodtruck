import { addDays, weekdayIndex, formatDanishDate, DANISH_WEEKDAYS } from './datetime';
import type { WeeklyStop, ScheduleException, DayEntry, Banner } from './types';
import { iFerie, type Ferie } from './ferie';

export const WEEK_LENGTH = 7;

/**
 * Resolve the schedule for the coming week.
 *
 * Pure by design: the caller supplies today's date, so there is no clock and
 * no database here. Every rule below is therefore an ordinary unit test.
 *
 * The window rolls forward from today rather than showing a Monday-to-Sunday
 * calendar week — a customer looking on Friday cares about the next seven
 * days, not about Monday, which has already passed.
 */
export function resolveWeek(
  todayISO: string,
  stops: WeeklyStop[],
  exceptions: ScheduleException[],
  ferie: Ferie | null = null,
): DayEntry[] {
  const byWeekday = new Map(stops.map((s) => [s.weekday, s]));
  const byDate = new Map(exceptions.map((e) => [e.date, e]));

  const entries: DayEntry[] = [];

  for (let offset = 0; offset < WEEK_LENGTH; offset++) {
    const date = addDays(todayISO, offset);
    const weekday = weekdayIndex(date);
    const base = {
      date,
      weekday,
      weekdayName: DANISH_WEEKDAYS[weekday],
      displayDate: formatDanishDate(date),
      isToday: offset === 0,
    };

    const exception = byDate.get(date);

    if (exception) {
      // An exception replaces the pattern entry entirely — it is never merged.
      entries.push({
        ...base,
        isException: true,
        isClosed: exception.is_closed === 1,
        locationName: exception.is_closed === 1 ? null : exception.location_name,
        address: exception.is_closed === 1 ? null : exception.address,
        mapUrl: exception.is_closed === 1 ? null : exception.map_url,
        startTime: exception.is_closed === 1 ? null : exception.start_time,
        endTime: exception.is_closed === 1 ? null : exception.end_time,
        note: exception.note,
      });
      continue;
    }

    // A holiday closes the day, but a one-off exception above still wins —
    // the owner may open for a single event in the middle of his holiday.
    if (iFerie(date, ferie)) {
      entries.push({
        ...base,
        isException: false,
        isClosed: true,
        locationName: null,
        address: null,
        mapUrl: null,
        startTime: null,
        endTime: null,
        note: 'Ferie',
      });
      continue;
    }

    const stop = byWeekday.get(weekday);
    const closed = !stop || stop.location_name === null;

    entries.push({
      ...base,
      isException: false,
      isClosed: closed,
      locationName: closed ? null : stop!.location_name,
      address: closed ? null : stop!.address,
      mapUrl: closed ? null : stop!.map_url,
      startTime: closed ? null : stop!.start_time,
      endTime: closed ? null : stop!.end_time,
      note: stop?.note ?? null,
    });
  }

  return entries;
}

/**
 * The front page banner, or null when there is nothing current to show.
 *
 * Both a non-empty text and an end date on or after today are required, so a
 * forgotten message expires on its own instead of lingering for months.
 */
export function resolveBanner(
  todayISO: string,
  settings: Record<string, string | undefined>,
): Banner | null {
  const text = settings.banner_text?.trim();
  const until = settings.banner_until?.trim();

  if (!text || !until) return null;
  if (until < todayISO) return null;

  return { text, until };
}
