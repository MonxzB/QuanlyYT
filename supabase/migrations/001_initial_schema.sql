create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role text not null default 'viewer' check (role in ('admin', 'manager', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  recovery_email text,
  phone text,
  two_factor_enabled boolean not null default false,
  country text,
  source text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.browser_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  ip_label text,
  country text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.niches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  youtube_channel_id text not null unique,
  youtube_url text not null,
  custom_url text,
  avatar_url text,
  banner_url text,
  status text not null default 'setup' check (status in ('purchased', 'setup', 'warm_up', 'active', 'paused', 'warning', 'suspended', 'dead')),
  health_status text not null default 'unknown' check (health_status in ('healthy', 'attention', 'critical', 'unknown')),
  niche_id uuid references public.niches(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  profile_id uuid references public.browser_profiles(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  country text,
  subscriber_count bigint not null default 0,
  view_count bigint not null default 0,
  video_count integer not null default 0,
  uploads_playlist_id text,
  last_video_at timestamptz,
  last_synced_at timestamptz,
  purchased_at date,
  started_at date,
  description text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reference_channels (
  id uuid primary key default gen_random_uuid(),
  youtube_channel_id text not null unique,
  youtube_url text not null,
  name text not null,
  custom_url text,
  avatar_url text,
  niche_id uuid references public.niches(id) on delete set null,
  subscriber_count bigint not null default 0,
  view_count bigint not null default 0,
  video_count integer not null default 0,
  uploads_playlist_id text,
  last_synced_at timestamptz,
  notes text,
  is_following boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  youtube_video_id text not null unique,
  channel_id uuid references public.channels(id) on delete cascade,
  reference_channel_id uuid references public.reference_channels(id) on delete cascade,
  title text not null,
  thumbnail_url text,
  description text,
  published_at timestamptz not null,
  duration text,
  view_count bigint not null default 0,
  like_count bigint not null default 0,
  comment_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz,
  check ((channel_id is not null) <> (reference_channel_id is not null))
);

create table public.channel_metrics (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  metric_date date not null,
  subscriber_count bigint not null default 0,
  view_count bigint not null default 0,
  video_count integer not null default 0,
  subscriber_change bigint not null default 0,
  view_change bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (channel_id, metric_date)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  type text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  is_resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create table public.content_tasks (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  title text not null,
  stage text not null default 'idea' check (stage in ('idea', 'script', 'voice', 'editing', 'thumbnail', 'scheduled', 'published')),
  publish_at timestamptz,
  progress integer not null default 0 check (progress between 0 and 100),
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.youtube_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  google_account_email text,
  youtube_channel_id text,
  youtube_channel_name text,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scope text,
  status text not null default 'connected',
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, channel_id)
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger channels_updated_at before update on public.channels for each row execute function public.set_updated_at();
create trigger accounts_updated_at before update on public.accounts for each row execute function public.set_updated_at();
create trigger browser_profiles_updated_at before update on public.browser_profiles for each row execute function public.set_updated_at();
create trigger reference_channels_updated_at before update on public.reference_channels for each row execute function public.set_updated_at();
create trigger videos_updated_at before update on public.videos for each row execute function public.set_updated_at();
create trigger content_tasks_updated_at before update on public.content_tasks for each row execute function public.set_updated_at();
create trigger youtube_connections_updated_at before update on public.youtube_connections for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger security definer set search_path = public language plpgsql as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
