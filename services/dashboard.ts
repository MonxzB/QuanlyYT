import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActivityLog, Alert, Channel, DashboardData, ChannelStatus, HealthStatus } from "@/types/domain";

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const chartStart = new Date(today.getTime() - 29 * 86400000);
  const historyStart = new Date(chartStart.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  const [channelsResult, alertsResult, activityResult, metricsResult] = await Promise.all([
    supabase.from("channels").select("*, niche:niches(id,name), account:accounts(id,email), browser_profile:browser_profiles(id,name), owner:profiles(id,full_name)").order("last_synced_at", { ascending: false, nullsFirst: false }),
    supabase.from("alerts").select("*, channel:channels(id,name)", { count: "exact" }).eq("is_resolved", false).order("created_at", { ascending: false }).limit(6),
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(6),
    supabase.from("channel_metrics").select("channel_id,metric_date,subscriber_count,view_count,video_count,subscriber_change,view_change").gte("metric_date", historyStart).order("metric_date"),
  ]);
  for (const result of [channelsResult, alertsResult, activityResult, metricsResult]) if (result.error) throw result.error;
  const channels = (channelsResult.data ?? []) as unknown as Channel[];
  const countStatus = (status: ChannelStatus) => channels.filter((channel) => channel.status === status).length;
  const statuses: ChannelStatus[] = ["purchased", "setup", "warm_up", "active", "paused", "warning", "suspended", "dead"];
  const health: HealthStatus[] = ["healthy", "attention", "critical", "unknown"];
  const nicheMap = new Map<string, number>();
  channels.forEach((channel) => nicheMap.set(channel.niche?.name ?? "Chưa phân loại", (nicheMap.get(channel.niche?.name ?? "Chưa phân loại") ?? 0) + 1));
  type MetricRow = { channel_id: string; metric_date: string; subscriber_count: number; view_count: number; video_count: number; subscriber_change: number; view_change: number };
  const metrics = (metricsResult.data ?? []) as MetricRow[];
  const metricsByChannel = new Map<string, MetricRow[]>();
  for (const metric of metrics) {
    const series = metricsByChannel.get(metric.channel_id) ?? [];
    series.push(metric);
    metricsByChannel.set(metric.channel_id, series);
  }
  const chartDates = Array.from({ length: 30 }, (_, index) => new Date(chartStart.getTime() + index * 86400000).toISOString().slice(0, 10));
  const daily = chartDates.map((date) => {
    const item = { date, subscribers: 0, views: 0, videos: 0 };
    for (const series of metricsByChannel.values()) {
      const latest = series.findLast((metric) => metric.metric_date <= date);
      if (!latest) continue;
      item.subscribers += Number(latest.subscriber_count);
      item.views += Number(latest.view_count);
      item.videos += Number(latest.video_count);
    }
    return item;
  }).filter((item) => item.subscribers > 0 || item.views > 0 || item.videos > 0);
  const latestGrowth = new Map<string, Pick<MetricRow, "subscriber_change" | "view_change">>();
  for (const [channelId, series] of metricsByChannel) {
    const latest = series.at(-1);
    if (latest) latestGrowth.set(channelId, latest);
  }
  return {
    totalChannels: channels.length,
    activeChannels: countStatus("active"),
    warmUpChannels: countStatus("warm_up"),
    warningChannels: countStatus("warning"),
    deadChannels: countStatus("dead"),
    statusDistribution: statuses.map((status) => ({ status, count: countStatus(status) })).filter((item) => item.count > 0),
    healthDistribution: health.map((item) => ({ health: item, count: channels.filter((channel) => channel.health_status === item).length })),
    nicheDistribution: Array.from(nicheMap, ([niche, count]) => ({ niche, count })),
    recentAlerts: (alertsResult.data ?? []) as unknown as Alert[],
    openAlertCount: alertsResult.count ?? 0,
    recentActivities: ((activityResult.data ?? []) as ActivityLog[]).map((item) => ({ ...item, action: activityLabel(item.action) })),
    topGrowing: channels.map((channel) => ({
      ...channel,
      subscriber_change: Number(latestGrowth.get(channel.id)?.subscriber_change ?? 0),
      view_change: Number(latestGrowth.get(channel.id)?.view_change ?? 0),
    })).sort((a, b) => b.view_change - a.view_change).slice(0, 5),
    recentlySynced: channels.slice(0, 8),
    metrics: daily,
  };
}

function activityLabel(action: string) {
  const labels: Record<string, string> = {
    "channel.created": "Đã thêm kênh",
    "channel.synced": "Đã đồng bộ dữ liệu YouTube",
    "channel.updated": "Đã cập nhật kênh",
  };
  return labels[action] ?? "Đã cập nhật dữ liệu";
}
