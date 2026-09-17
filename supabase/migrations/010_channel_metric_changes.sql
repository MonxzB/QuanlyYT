create or replace view public.channel_metric_changes
with (security_invoker = true)
as
with changes as (
  select
    channel_id,
    metric_date,
    subscriber_count - coalesce(lag(subscriber_count) over (partition by channel_id order by metric_date), subscriber_count) as subscriber_change,
    view_count - coalesce(lag(view_count) over (partition by channel_id order by metric_date), view_count) as view_change,
    video_count - coalesce(lag(video_count) over (partition by channel_id order by metric_date), video_count) as video_change,
    row_number() over (partition by channel_id order by metric_date desc) as latest_rank
  from public.channel_metrics
)
select channel_id, metric_date, subscriber_change, view_change, video_change
from changes
where latest_rank = 1;

grant select on public.channel_metric_changes to authenticated;

notify pgrst, 'reload schema';
