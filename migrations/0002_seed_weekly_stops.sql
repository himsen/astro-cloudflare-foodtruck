-- The weekly pattern as it stood in the local development database on
-- 2026-08-23. Approximate: the owner corrects it from /admin, and after that
-- this file is only history — migrations run once, so a later edit here would
-- never reach a database that has already seen it.
--
-- 0001 already inserted all seven weekdays, so these are updates. Monday (0),
-- Saturday (5) and Sunday (6) stay closed, i.e. every column NULL.
--
-- map_url is left NULL for Børkop and Skærbæk. Locally those two rows hold
-- `https://maps.example.com/torvet`, a placeholder from development; a dead
-- "see the map" link on a stop is worse than no link at all.

UPDATE weekly_stops SET
  location_name = 'BØRKOP',
  address       = 'Rema 100 / Netto, Ny Boder 20, 7080 Børkop',
  map_url       = NULL,
  start_time    = '15:00',
  end_time      = '18:30'
WHERE weekday = 1;   -- tirsdag

UPDATE weekly_stops SET
  location_name = 'SKÆRBÆK',
  address       = 'Spar, Overmarken 2, 7000 Skærbæk',
  map_url       = NULL,
  start_time    = '15:00',
  end_time      = '18:30'
WHERE weekday = 2;   -- onsdag

UPDATE weekly_stops SET
  location_name = 'FREDERICIA',
  address       = 'Føtex V, Venusvej 8, 7000 Fredericia',
  map_url       = 'https://maps.app.goo.gl/Ec2mBYLr14ThG5cBA',
  start_time    = '15:00',
  end_time      = '18:30'
WHERE weekday = 3;   -- torsdag

UPDATE weekly_stops SET
  location_name = 'ERRITSØ',
  address       = 'Superbrugen, Erritsø Bygade 109, 7000 Fredericia',
  map_url       = 'https://maps.app.goo.gl/YdPZjzuTWvTg9pRz8',
  start_time    = '15:00',
  end_time      = '18:30'
WHERE weekday = 4;   -- fredag
