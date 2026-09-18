alter table public.videos
  add column if not exists tags text[] not null default '{}';

create index if not exists videos_tags_idx
  on public.videos using gin (tags);

notify pgrst, 'reload schema';
