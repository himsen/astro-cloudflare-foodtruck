import type { WeeklyStop, ScheduleException } from './types';

/**
 * Every SQL statement in the project lives here. Nothing else imports D1
 * directly, which keeps the query surface small enough to review at a glance.
 */

export async function getWeeklyStops(db: D1Database): Promise<WeeklyStop[]> {
  const { results } = await db
    .prepare(
      `SELECT weekday, location_name, address, map_url, start_time, end_time, note
       FROM weekly_stops
       ORDER BY weekday`,
    )
    .all<WeeklyStop>();
  return results;
}

/** Exceptions on or after `fromISO`. Past ones are left in place, never shown. */
export async function getUpcomingExceptions(
  db: D1Database,
  fromISO: string,
): Promise<ScheduleException[]> {
  const { results } = await db
    .prepare(
      `SELECT date, is_closed, location_name, address, map_url, start_time, end_time, note
       FROM schedule_exceptions
       WHERE date >= ?
       ORDER BY date`,
    )
    .bind(fromISO)
    .all<ScheduleException>();
  return results;
}

/** Updates one of the seven seeded rows. Never inserts. */
export async function updateWeeklyStop(db: D1Database, stop: WeeklyStop): Promise<void> {
  await db
    .prepare(
      `UPDATE weekly_stops
       SET location_name = ?, address = ?, map_url = ?, start_time = ?, end_time = ?, note = ?
       WHERE weekday = ?`,
    )
    .bind(
      stop.location_name,
      stop.address,
      stop.map_url,
      stop.start_time,
      stop.end_time,
      stop.note,
      stop.weekday,
    )
    .run();
}

/** Replaces any existing exception for the same date. */
export async function upsertException(
  db: D1Database,
  ex: ScheduleException,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO schedule_exceptions
         (date, is_closed, location_name, address, map_url, start_time, end_time, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         is_closed = excluded.is_closed,
         location_name = excluded.location_name,
         address = excluded.address,
         map_url = excluded.map_url,
         start_time = excluded.start_time,
         end_time = excluded.end_time,
         note = excluded.note`,
    )
    .bind(
      ex.date,
      ex.is_closed,
      ex.location_name,
      ex.address,
      ex.map_url,
      ex.start_time,
      ex.end_time,
      ex.note,
    )
    .run();
}

export async function deleteException(db: D1Database, date: string): Promise<void> {
  await db.prepare('DELETE FROM schedule_exceptions WHERE date = ?').bind(date).run();
}

export async function getSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db
    .prepare('SELECT key, value FROM site_settings')
    .all<{ key: string; value: string | null }>();

  const settings: Record<string, string> = {};
  for (const row of results) {
    if (row.value !== null) settings[row.key] = row.value;
  }
  return settings;
}

export async function setSettings(
  db: D1Database,
  entries: Record<string, string>,
): Promise<void> {
  const statements = Object.entries(entries).map(([key, value]) =>
    db
      .prepare(
        `INSERT INTO site_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .bind(key, value),
  );
  if (statements.length > 0) await db.batch(statements);
}
