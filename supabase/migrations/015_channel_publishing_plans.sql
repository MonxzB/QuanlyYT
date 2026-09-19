alter table public.channels
  add column if not exists publish_interval_days integer,
  add column if not exists next_publish_date date,
  add column if not exists publish_reminder_days integer not null default 1;

alter table public.channels
  drop constraint if exists channels_publish_interval_days_check,
  drop constraint if exists channels_publish_reminder_days_check,
  drop constraint if exists channels_publish_plan_complete_check;

alter table public.channels
  add constraint channels_publish_interval_days_check check (publish_interval_days is null or publish_interval_days between 1 and 365),
  add constraint channels_publish_reminder_days_check check (publish_reminder_days between 0 and 30),
  add constraint channels_publish_plan_complete_check check (
    (publish_interval_days is null and next_publish_date is null)
    or (publish_interval_days is not null and next_publish_date is not null)
  );

create index if not exists channels_next_publish_date_idx
  on public.channels(next_publish_date)
  where publish_interval_days is not null;

notify pgrst, 'reload schema';
