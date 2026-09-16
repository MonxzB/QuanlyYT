create or replace function public.current_app_role() returns text
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

revoke all on function public.current_app_role() from public;
grant execute on function public.current_app_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.browser_profiles enable row level security;
alter table public.niches enable row level security;
alter table public.channels enable row level security;
alter table public.reference_channels enable row level security;
alter table public.videos enable row level security;
alter table public.channel_metrics enable row level security;
alter table public.alerts enable row level security;
alter table public.activity_logs enable row level security;
alter table public.content_tasks enable row level security;
alter table public.youtube_connections enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (public.current_app_role() in ('viewer', 'manager', 'admin'));
create policy profiles_admin on public.profiles for all to authenticated using (public.current_app_role() = 'admin') with check (public.current_app_role() = 'admin');

create policy accounts_read on public.accounts for select to authenticated using (public.current_app_role() in ('viewer', 'manager', 'admin'));
create policy accounts_write on public.accounts for insert to authenticated with check (public.current_app_role() in ('manager', 'admin'));
create policy accounts_edit on public.accounts for update to authenticated using (public.current_app_role() in ('manager', 'admin')) with check (public.current_app_role() in ('manager', 'admin'));
create policy accounts_delete on public.accounts for delete to authenticated using (public.current_app_role() = 'admin');

create policy browser_profiles_read on public.browser_profiles for select to authenticated using (public.current_app_role() in ('viewer', 'manager', 'admin'));
create policy browser_profiles_write on public.browser_profiles for insert to authenticated with check (public.current_app_role() in ('manager', 'admin'));
create policy browser_profiles_edit on public.browser_profiles for update to authenticated using (public.current_app_role() in ('manager', 'admin')) with check (public.current_app_role() in ('manager', 'admin'));
create policy browser_profiles_delete on public.browser_profiles for delete to authenticated using (public.current_app_role() = 'admin');

create policy niches_read on public.niches for select to authenticated using (public.current_app_role() in ('viewer', 'manager', 'admin'));
create policy niches_write on public.niches for insert to authenticated with check (public.current_app_role() in ('manager', 'admin'));
create policy niches_edit on public.niches for update to authenticated using (public.current_app_role() in ('manager', 'admin')) with check (public.current_app_role() in ('manager', 'admin'));
create policy niches_delete on public.niches for delete to authenticated using (public.current_app_role() = 'admin');

create policy channels_read on public.channels for select to authenticated using (public.current_app_role() in ('viewer', 'manager', 'admin'));
create policy channels_write on public.channels for insert to authenticated with check (public.current_app_role() in ('manager', 'admin'));
create policy channels_edit on public.channels for update to authenticated using (public.current_app_role() in ('manager', 'admin')) with check (public.current_app_role() in ('manager', 'admin'));
create policy channels_delete on public.channels for delete to authenticated using (public.current_app_role() = 'admin');

create policy reference_channels_read on public.reference_channels for select to authenticated using (public.current_app_role() in ('viewer', 'manager', 'admin'));
create policy reference_channels_write on public.reference_channels for insert to authenticated with check (public.current_app_role() in ('manager', 'admin'));
create policy reference_channels_edit on public.reference_channels for update to authenticated using (public.current_app_role() in ('manager', 'admin')) with check (public.current_app_role() in ('manager', 'admin'));
create policy reference_channels_delete on public.reference_channels for delete to authenticated using (public.current_app_role() = 'admin');

create policy videos_read on public.videos for select to authenticated using (public.current_app_role() in ('viewer', 'manager', 'admin'));
create policy videos_write on public.videos for insert to authenticated with check (public.current_app_role() in ('manager', 'admin'));
create policy videos_edit on public.videos for update to authenticated using (public.current_app_role() in ('manager', 'admin')) with check (public.current_app_role() in ('manager', 'admin'));
create policy videos_delete on public.videos for delete to authenticated using (public.current_app_role() = 'admin');

create policy metrics_read on public.channel_metrics for select to authenticated using (public.current_app_role() in ('viewer', 'manager', 'admin'));
create policy metrics_write on public.channel_metrics for insert to authenticated with check (public.current_app_role() in ('manager', 'admin'));
create policy metrics_edit on public.channel_metrics for update to authenticated using (public.current_app_role() in ('manager', 'admin')) with check (public.current_app_role() in ('manager', 'admin'));
create policy metrics_delete on public.channel_metrics for delete to authenticated using (public.current_app_role() = 'admin');

create policy alerts_read on public.alerts for select to authenticated using (public.current_app_role() in ('viewer', 'manager', 'admin'));
create policy alerts_write on public.alerts for insert to authenticated with check (public.current_app_role() in ('manager', 'admin'));
create policy alerts_edit on public.alerts for update to authenticated using (public.current_app_role() in ('manager', 'admin')) with check (public.current_app_role() in ('manager', 'admin'));
create policy alerts_delete on public.alerts for delete to authenticated using (public.current_app_role() = 'admin');

create policy activity_read on public.activity_logs for select to authenticated using (public.current_app_role() in ('viewer', 'manager', 'admin'));
create policy activity_insert on public.activity_logs for insert to authenticated with check (public.current_app_role() in ('manager', 'admin') and (user_id = auth.uid() or user_id is null));
create policy activity_delete on public.activity_logs for delete to authenticated using (public.current_app_role() = 'admin');

create policy content_read on public.content_tasks for select to authenticated using (public.current_app_role() in ('viewer', 'manager', 'admin'));
create policy content_write on public.content_tasks for insert to authenticated with check (public.current_app_role() in ('manager', 'admin'));
create policy content_edit on public.content_tasks for update to authenticated using (public.current_app_role() in ('manager', 'admin')) with check (public.current_app_role() in ('manager', 'admin'));
create policy content_delete on public.content_tasks for delete to authenticated using (public.current_app_role() = 'admin');

-- Không tạo policy client cho youtube_connections. Chỉ service role phía server được phép đọc token mã hóa.

create or replace view public.youtube_connection_status with (security_invoker = false) as
select id, user_id, channel_id, google_account_email, youtube_channel_id, youtube_channel_name, token_expires_at, scope, status, connected_at, updated_at
from public.youtube_connections
where user_id = auth.uid() or public.current_app_role() = 'admin';

revoke all on public.youtube_connection_status from anon;
grant select on public.youtube_connection_status to authenticated;
