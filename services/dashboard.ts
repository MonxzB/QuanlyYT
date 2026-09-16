import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActivityLog, Alert, Channel, DashboardData, ChannelStatus, HealthStatus } from "@/types/domain";

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createSupabaseServerClient();
  const [channelsResult, alertsResult, activityResult, metricsResult] = await Promise.all([
    supabase.from("channels").select("*, niche:niches(id,name), account:accounts(id,email), browser_profile:browser_profiles(id,name), owner:profiles(id,full_name)").order("last_synced_at", { ascending: false, nullsFirst: false }),
    supabase.from("alerts").select("*, channel:channels(id,name)").eq("is_resolved", false).order("created_at", { ascending: false }).limit(6),
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(6),
    supabase.from("channel_metrics").select("metric_date,subscriber_count,view_count,video_count").gte("metric_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).order("metric_date"),
  ]);
  for (const result of [channelsResult, alertsResult, activityResult, metricsResult]) if (result.error) throw result.error;
  const channels = (channelsResult.data ?? []) as unknown as Channel[];
  const countStatus = (status: ChannelStatus) => channels.filter((channel) => channel.status === status).length;
  const statuses: ChannelStatus[] = ["purchased", "setup", "warm_up", "active", "paused", "warning", "suspended", "dead"];
  const health: HealthStatus[] = ["healthy", "attention", "critical", "unknown"];
  const nicheMap = new Map<string, number>();
  channels.forEach((channel) => nicheMap.set(channel.niche?.name ?? "Chưa phân loại", (nicheMap.get(channel.niche?.name ?? "Chưa phân loại") ?? 0) + 1));
  const daily = new Map<string, { date: string; subscribers: number; views: number; videos: number }>();
  const metrics = (metricsResult.data ?? []) as Array<{ metric_date: string; subscriber_count: number; view_count: number; video_count: number }>;
  metrics.forEach((metric) => {
    const item = daily.get(metric.metric_date) ?? { date: metric.metric_date, subscribers: 0, views: 0, videos: 0 };
    item.subscribers += Number(metric.subscriber_count);
    item.views += Number(metric.view_count);
    item.videos += Number(metric.video_count);
    daily.set(metric.metric_date, item);
  });
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
    recentActivities: ((activityResult.data ?? []) as ActivityLog[]).map((item) => ({ ...item, action: activityLabel(item.action) })),
    topGrowing: channels.slice(0, 5).map((channel) => ({ ...channel, subscriber_change: 0, view_change: 0 })),
    recentlySynced: channels.slice(0, 8),
    metrics: Array.from(daily.values()),
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
