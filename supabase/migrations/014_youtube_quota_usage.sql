create table if not exists public.youtube_quota_usage (
  usage_date date primary key,
  used_units integer not null default 0 check (used_units >= 0),
  updated_at timestamptz not null default now()
);

alter table public.youtube_quota_usage enable row level security;

revoke all on table public.youtube_quota_usage from public, anon, authenticated;
grant select on table public.youtube_quota_usage to service_role;

create or replace function public.increment_youtube_quota(p_units integer default 1)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.youtube_quota_usage (usage_date, used_units, updated_at)
  values ((now() at time zone 'America/Los_Angeles')::date, greatest(p_units, 0), now())
  on conflict (usage_date) do update
  set used_units = public.youtube_quota_usage.used_units + excluded.used_units,
      updated_at = now();
$$;

revoke all on function public.increment_youtube_quota(integer) from public, anon, authenticated;
grant execute on function public.increment_youtube_quota(integer) to service_role;

notify pgrst, 'reload schema';
