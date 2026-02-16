create table if not exists public.job_board_jobs (
  id text primary key,
  payload jsonb not null,
  status text not null,
  source_type text not null,
  is_verified boolean not null default false,
  posted_date timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_board_jobs_status_posted_idx
  on public.job_board_jobs (status, posted_date desc);

create index if not exists job_board_jobs_source_status_idx
  on public.job_board_jobs (source_type, status, posted_date desc);

create table if not exists public.job_board_clicks (
  job_id text primary key references public.job_board_jobs(id) on delete cascade,
  clicks integer not null default 0 check (clicks >= 0),
  updated_at timestamptz not null default now()
);

create or replace function public.increment_job_click(target_job_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_clicks integer;
begin
  insert into public.job_board_clicks as c (job_id, clicks, updated_at)
  values (target_job_id, 1, now())
  on conflict (job_id)
  do update set
    clicks = c.clicks + 1,
    updated_at = now()
  returning clicks into next_clicks;

  return next_clicks;
end;
$$;
