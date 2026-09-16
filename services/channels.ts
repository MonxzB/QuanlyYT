import "server-only";
import { AppError } from "@/lib/api-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlaylistVideos, getYouTubeChannelById, type YouTubeChannel } from "@/lib/youtube/client";
import type { Channel, ChannelStatus, Paginated } from "@/types/domain";

const CHANNEL_SELECT = "*, niche:niches(id,name), account:accounts(id,email), browser_profile:browser_profiles(id,name), owner:profiles(id,full_name)";

export async function listChannels(input: { page?: number; pageSize?: number; search?: string; status?: string; nicheId?: string } = {}): Promise<Paginated<Channel>> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("channels").select(CHANNEL_SELECT, { count: "exact" });
  if (input.search) query = query.or(`name.ilike.%${input.search}%,custom_url.ilike.%${input.search}%,youtube_channel_id.ilike.%${input.search}%`);
  if (input.status) query = query.eq("status", input.status);
  if (input.nicheId) query = query.eq("niche_id", input.nicheId);
  const { data, count, error } = await query.order("updated_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  const total = count ?? 0;
  return { data: (data ?? []) as unknown as Channel[], page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getChannel(id: string): Promise<Channel | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("channels").select(CHANNEL_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as Channel | null;
}

export async function createChannel(input: {
  youtubeUrl: string;
  youtube: YouTubeChannel;
  status?: ChannelStatus;
  nicheId?: string | null;
  accountId?: string | null;
  profileId?: string | null;
  ownerId?: string | null;
  notes?: string | null;
}, actorId: string): Promise<Channel> {
  const admin = createSupabaseAdminClient();
  const payload = {
    name: input.youtube.title,
    youtube_channel_id: input.youtube.id,
    youtube_url: input.youtubeUrl,
    custom_url: input.youtube.customUrl,
    avatar_url: input.youtube.avatarUrl,
    banner_url: input.youtube.bannerUrl,
    status: input.status ?? "setup",
    health_status: "healthy",
    niche_id: input.nicheId ?? null,
    account_id: input.accountId ?? null,
    profile_id: input.profileId ?? null,
    owner_id: input.ownerId ?? actorId,
    country: input.youtube.country,
    subscriber_count: input.youtube.subscriberCount,
    view_count: input.youtube.viewCount,
    video_count: input.youtube.videoCount,
    uploads_playlist_id: input.youtube.uploadsPlaylistId,
    description: input.youtube.description,
    notes: input.notes ?? null,
    last_synced_at: new Date().toISOString(),
  };
  const { data, error } = await admin.from("channels").insert(payload).select(CHANNEL_SELECT).single();
  if (error?.code === "23505") throw new AppError("CHANNEL_EXISTS", "Kênh này đã có trong hệ thống.", 409);
  if (error) throw error;
  await admin.from("activity_logs").insert({ user_id: actorId, channel_id: data.id, action: "channel.created", entity_type: "channel", entity_id: data.id, new_data: { name: data.name } });
  return data as unknown as Channel;
}

async function updateAlerts(channel: Channel, previous: Channel | null) {
  const admin = createSupabaseAdminClient();
  const alerts: Array<{ type: string; severity: "warning" | "critical"; title: string; message: string }> = [];
  const daysSinceUpload = channel.last_video_at ? (Date.now() - new Date(channel.last_video_at).getTime()) / 86400000 : Infinity;
  if (daysSinceUpload > 7) alerts.push({ type: "no_upload_7d", severity: daysSinceUpload > 21 ? "critical" : "warning", title: "Kênh lâu chưa đăng video", message: channel.last_video_at ? `Đã ${Math.floor(daysSinceUpload)} ngày chưa có video mới.` : "Chưa ghi nhận video công khai." });
  if (previous && previous.view_count > 0 && channel.view_count < previous.view_count * 0.8) alerts.push({ type: "views_drop", severity: "critical", title: "Lượt xem giảm bất thường", message: "Tổng lượt xem giảm hơn 20% so với lần đồng bộ trước." });
  for (const alert of alerts) {
    const { data: existing } = await admin.from("alerts").select("id").eq("channel_id", channel.id).eq("type", alert.type).eq("is_resolved", false).maybeSingle();
    if (existing) await admin.from("alerts").update({ ...alert }).eq("id", existing.id);
    else await admin.from("alerts").insert({ channel_id: channel.id, ...alert, is_resolved: false });
  }
}

export async function syncChannel(id: string, actorId: string): Promise<{ channel: Channel; syncedVideos: number }> {
  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin.from("channels").select("*").eq("id", id).single();
  if (currentError || !current) throw new AppError("CHANNEL_NOT_FOUND", "Không tìm thấy kênh.", 404);
  const youtube = await getYouTubeChannelById(current.youtube_channel_id);
  const videos = await getPlaylistVideos(youtube.uploadsPlaylistId);
  const now = new Date().toISOString();
  const lastVideoAt = videos[0]?.publishedAt ?? current.last_video_at;
  const { data: updated, error: updateError } = await admin.from("channels").update({
    name: youtube.title,
    custom_url: youtube.customUrl,
    avatar_url: youtube.avatarUrl,
    banner_url: youtube.bannerUrl,
    country: youtube.country,
    subscriber_count: youtube.subscriberCount,
    view_count: youtube.viewCount,
    video_count: youtube.videoCount,
    uploads_playlist_id: youtube.uploadsPlaylistId,
    description: youtube.description,
    last_video_at: lastVideoAt,
    last_synced_at: now,
    health_status: lastVideoAt && Date.now() - new Date(lastVideoAt).getTime() < 7 * 86400000 ? "healthy" : "attention",
  }).eq("id", id).select(CHANNEL_SELECT).single();
  if (updateError) throw updateError;
  if (videos.length) {
    const { error } = await admin.from("videos").upsert(videos.map((video) => ({
      youtube_video_id: video.id,
      channel_id: id,
      title: video.title,
      thumbnail_url: video.thumbnailUrl,
      description: video.description,
      published_at: video.publishedAt,
      duration: video.duration,
      view_count: video.viewCount,
      like_count: video.likeCount,
      comment_count: video.commentCount,
      last_synced_at: now,
    })), { onConflict: "youtube_video_id" });
    if (error) throw error;
  }
  const today = now.slice(0, 10);
  const { data: previousMetric } = await admin.from("channel_metrics").select("subscriber_count,view_count").eq("channel_id", id).lt("metric_date", today).order("metric_date", { ascending: false }).limit(1).maybeSingle();
  await admin.from("channel_metrics").upsert({
    channel_id: id,
    metric_date: today,
    subscriber_count: youtube.subscriberCount,
    view_count: youtube.viewCount,
    video_count: youtube.videoCount,
    subscriber_change: youtube.subscriberCount - Number(previousMetric?.subscriber_count ?? youtube.subscriberCount),
    view_change: youtube.viewCount - Number(previousMetric?.view_count ?? youtube.viewCount),
  }, { onConflict: "channel_id,metric_date" });
  await updateAlerts(updated as unknown as Channel, current as Channel);
  await admin.from("activity_logs").insert({ user_id: actorId, channel_id: id, action: "channel.synced", entity_type: "channel", entity_id: id, new_data: { videos: videos.length } });
  return { channel: updated as unknown as Channel, syncedVideos: videos.length };
}

export async function syncAllChannels(actorId: string) {
  const admin = createSupabaseAdminClient();
  const staleBefore = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin.from("channels").select("id").not("status", "in", '("paused","dead","suspended")').or(`last_synced_at.is.null,last_synced_at.lt.${staleBefore}`).order("last_synced_at", { ascending: true, nullsFirst: true }).limit(25);
  if (error) throw error;
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const channel of data ?? []) {
    try { await syncChannel(channel.id, actorId); results.push({ id: channel.id, ok: true }); }
    catch (error) { results.push({ id: channel.id, ok: false, error: error instanceof Error ? error.message : "Lỗi không xác định" }); }
  }
  return { processed: results.length, succeeded: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length, results };
}
