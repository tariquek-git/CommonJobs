-- Supabase hardening for public MVP
-- Enables RLS, tightens privileges, and adds basic constraints.
--
-- This app uses SUPABASE_SERVICE_ROLE_KEY server-side (Vercel env) so it does not rely on anon/authenticated access.
-- If you configured custom table names, replace them below (or set SUPABASE_JOBS_TABLE / SUPABASE_CLICKS_TABLE env vars).

-- 1) Enable Row Level Security (deny by default)
alter table if exists public.job_board_jobs enable row level security;
alter table if exists public.job_board_clicks enable row level security;

-- 2) Tighten privileges for anon/authenticated. Service role continues to work.
revoke all on table public.job_board_jobs from anon, authenticated;
revoke all on table public.job_board_clicks from anon, authenticated;

-- Restrict RPC (click increment) execution to service_role only.
revoke all on function public.increment_job_click(text) from anon, authenticated;
grant execute on function public.increment_job_click(text) to service_role;

-- Allow service_role explicit table access (safe even if already granted).
grant select, insert, update, delete on table public.job_board_jobs to service_role;
grant select, insert, update, delete on table public.job_board_clicks to service_role;

-- 3) Add constraints (NOT VALID so existing rows won't block migration; new writes are enforced).
alter table public.job_board_jobs
  add constraint job_board_jobs_status_chk
  check (status in ('pending', 'active', 'rejected', 'archived')) not valid;

alter table public.job_board_jobs
  add constraint job_board_jobs_source_type_chk
  check (source_type in ('Direct', 'Aggregated')) not valid;

-- Optional: validate later once you confirm all rows match expectations:
-- alter table public.job_board_jobs validate constraint job_board_jobs_status_chk;
-- alter table public.job_board_jobs validate constraint job_board_jobs_source_type_chk;

