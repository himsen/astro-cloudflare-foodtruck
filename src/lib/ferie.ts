import { formatDanishDate } from './datetime';

/** A holiday: every date from `fra` to `til`, both inclusive, as 'YYYY-MM-DD'. */
export interface Ferie {
  fra: string;
  til: string;
}

/**
 * The current or coming holiday from site settings, or null.
 *
 * Like the banner it expires on its own: once `til` has passed, it is ignored
 * even if nobody deletes it.
 */
export function resolveFerie(
  todayISO: string,
  settings: Record<string, string | undefined>,
): Ferie | null {
  const fra = settings.ferie_fra?.trim();
  const til = settings.ferie_til?.trim();
  if (!fra || !til || til < todayISO) return null;
  return { fra, til };
}

/** True when the date falls inside the holiday. ISO strings compare as dates. */
export function iFerie(dateISO: string, ferie: Ferie | null): boolean {
  return ferie !== null && dateISO >= ferie.fra && dateISO <= ferie.til;
}

/**
 * The banner text the admin form pre-fills, e.g. "Vi holder ferie 14.–27. juli".
 * Shared by the server (empty field) and the admin page's small script.
 */
export function ferieBannerTekst(fra: string, til: string): string {
  if (fra === til) return `Vi holder lukket ${formatDanishDate(fra)}`;
  const [, mFra, dFra] = fra.split('-');
  const [, mTil] = til.split('-');
  if (mFra === mTil) return `Vi holder ferie ${Number(dFra)}.–${formatDanishDate(til)}`;
  return `Vi holder ferie ${formatDanishDate(fra)} – ${formatDanishDate(til)}`;
}
