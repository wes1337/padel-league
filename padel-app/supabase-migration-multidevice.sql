-- Multi-device fix for the "duplicate games when scoring across phones" bug.
-- Run this once in the Supabase SQL Editor.

-- 1) Stop duplicate court slots at the database.
--    (session_id, round, court) must be unique for real rounds. Manually-added
--    games leave round/court NULL; Postgres treats NULLs as distinct, so this
--    index never blocks those — it only blocks two devices creating the same
--    Round-N / Court-C slot. A second device's insert now fails cleanly instead
--    of silently making a copy; the app treats that as "already created".
create unique index if not exists matches_session_round_court_uniq
  on matches (session_id, round, court);

-- 2) Turn on realtime for matches so scores/games entered on one phone appear
--    on the others within a second (no more stale lists). Safe to re-run.
alter publication supabase_realtime add table matches;
