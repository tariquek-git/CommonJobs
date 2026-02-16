-- Market Feed support columns for aggregated jobs
alter table public.jobs
  add column if not exists source_id text,
  add column if not exists original_source text,
  add column if not exists is_aggregated boolean not null default false,
  add column if not exists external_posted_at timestamptz;

-- Unique dedupe key for external imports
create unique index if not exists jobs_source_id_unique_idx
  on public.jobs (source_id)
  where source_id is not null;

-- Queue query performance
create index if not exists jobs_aggregated_pending_idx
  on public.jobs (is_aggregated, status, external_posted_at desc);
