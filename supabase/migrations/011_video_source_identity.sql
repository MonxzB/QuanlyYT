-- A YouTube video may be tracked once for an operated channel and once for a
-- reference channel. Keep each source identity unique while preserving the
-- XOR ownership constraint from the initial schema.
alter table public.videos
  drop constraint if exists videos_youtube_video_id_key;

drop index if exists public.videos_youtube_video_id_idx;

create unique index if not exists videos_source_identity_idx
  on public.videos (youtube_video_id, channel_id, reference_channel_id)
  nulls not distinct;

create index if not exists videos_youtube_video_id_idx
  on public.videos (youtube_video_id);

notify pgrst, 'reload schema';
