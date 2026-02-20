-- Deprecated migration (legacy table name).
-- This project now stores jobs in public.job_board_jobs via:
--   20260216_job_board_storage.sql
-- Keep this file as a no-op so old docs/scripts do not fail on a missing public.jobs table.

do $$
begin
  raise notice 'Skipping deprecated migration 20260215_market_feed.sql; use 20260216_job_board_storage.sql instead.';
end
$$;
