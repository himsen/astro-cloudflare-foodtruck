-- The recurring weekly pattern. Exactly seven rows, always present.
CREATE TABLE weekly_stops (
  weekday       INTEGER PRIMARY KEY,
  location_name TEXT,
  address       TEXT,
  map_url       TEXT,
  start_time    TEXT,
  end_time      TEXT,
  note          TEXT
);

-- One-off overrides. At most one per calendar date.
CREATE TABLE schedule_exceptions (
  date          TEXT PRIMARY KEY,
  is_closed     INTEGER NOT NULL DEFAULT 0,
  location_name TEXT,
  address       TEXT,
  map_url       TEXT,
  start_time    TEXT,
  end_time      TEXT,
  note          TEXT
);

CREATE TABLE site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Seed all seven weekdays as closed. The owner fills them in from /admin.
-- Seeding here means the admin screen only ever updates rows, so she can
-- never end up with a missing weekday.
INSERT INTO weekly_stops (weekday) VALUES (0), (1), (2), (3), (4), (5), (6);
