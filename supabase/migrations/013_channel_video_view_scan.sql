alter table public.channels
  add column if not exists public_video_view_count bigint,
  add column if not exists public_video_view_scanned_at timestamptz,
  add column if not exists video_view_scan_status text not null default 'idle',
  add column if not exists video_view_scan_page_token text,
  add column if not exists video_view_scan_accumulator bigint not null default 0,
  add column if not exists video_view_scan_video_count integer not null default 0;

alter table public.channels
  drop constraint if exists channels_video_view_scan_status_check;

alter table public.channels
  add constraint channels_video_view_scan_status_check
  check (video_view_scan_status in ('idle', 'running', 'complete'));

notify pgrst, 'reload schema';
