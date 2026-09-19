import "server-only";
import { AppError } from "@/lib/api-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlaylistVideos, getYouTubeChannelById, type YouTubeChannel } from "@/lib/youtube/client";
import type { Channel, ChannelStatus, Paginated } from "@/types/domain";

const CHANNEL_SELECT = "*, niche:niches(id,name), account:accounts(id,email,recovery_email,phone,two_factor_enabled,has_password), browser_profile:browser_profiles(id,name), owner:profiles(id,full_name)";

export interface ChannelUpdate {
  status?: ChannelStatus;
  nicheId?: string | null;
  accountId?: string | null;
  notes?: string | null;
  publishIntervalDays?: number | null;
  nextPublishDate?: string | null;
  publishReminderDays?: number;
}

export async function listChannels(input: { page?: number; pageSize?: number; search?: string; status?: string; nicheId?: string } = {}): Promise<Paginated<Channel>> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("channels").select(CHANNEL_SELECT, { count: "exact" });
  if (input.search) {
    const search = input.search.replace(/[,%()]/g, " ").trim();
    if (search) query = query.or(`name.ilike.%${search}%,custom_url.ilike.%${search}%,youtube_channel_id.ilike.%${search}%`);
  }
  if (input.status) query = query.eq("status", input.status);
  if (input.nicheId) query = query.eq("niche_id", input.nicheId);
  const { data, count, error } = await query.order("sort_order", { ascending: true }).order("updated_at", { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  const channelRows = (data ?? []) as unknown as Channel[];
  const ids = channelRows.map((channel) => channel.id);
  const changes = ids.length
    ? await supabase.from("channel_metric_changes").select("channel_id,metric_date,subscriber_change,view_change,video_change").in("channel_id", ids)
    : { data: [], error: null };
  const changesUnavailable = changes.error && ["PGRST205", "42P01"].includes(changes.error.code ?? "");
  if (changes.error && !changesUnavailable) throw changes.error;
  type ChangeRow = { channel_id: string; metric_date: string; subscriber_change: number; view_change: number; video_change: number };
  const changesByChannel = new Map(((changes.data ?? []) as ChangeRow[]).map((change) => [change.channel_id, change]));
  const total = count ?? 0;
  return {
    data: channelRows.map((channel) => {
      const change = changesByChannel.get(channel.id);
      return { ...channel, subscriber_change: Number(change?.subscriber_change ?? 0), view_change: Number(change?.view_change ?? 0), video_change: Number(change?.video_change ?? 0), metric_date: change?.metric_date ?? null };
    }),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
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
    sort_order: Date.now(),
    last_synced_at: new Date().toISOString(),
  };
  const { data, error } = await admin.from("channels").insert(payload).select(CHANNEL_SELECT).single();
  if (error?.code === "23505") throw new AppError("CHANNEL_EXISTS", "Kênh này đã có trong hệ thống.", 409);
  if (error) throw error;
  const { error: metricError } = await admin.from("channel_metrics").insert({
    channel_id: data.id,
    metric_date: new Date().toISOString().slice(0, 10),
    subscriber_count: input.youtube.subscriberCount,
    view_count: input.youtube.viewCount,
    video_count: input.youtube.videoCount,
    subscriber_change: 0,
    view_change: 0,
  });
  if (metricError) {
    const { error: rollbackError } = await admin.from("channels").delete().eq("id", data.id);
    if (rollbackError) console.error("Failed to roll back channel creation", rollbackError);
    throw metricError;
  }
  await admin.from("activity_logs").insert({ user_id: actorId, channel_id: data.id, action: "channel.created", entity_type: "channel", entity_id: data.id, new_data: { name: data.name } });
  return data as unknown as Channel;
}

export async function updateChannel(id: string, input: ChannelUpdate, actorId: string): Promise<Channel> {
  const admin = createSupabaseAdminClient();
  const payload: Record<string, unknown> = {};
  if (input.status !== undefined) payload.status = input.status;
  if (input.nicheId !== undefined) payload.niche_id = input.nicheId;
  if (input.accountId !== undefined) payload.account_id = input.accountId;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.publishIntervalDays !== undefined) payload.publish_interval_days = input.publishIntervalDays;
  if (input.nextPublishDate !== undefined) payload.next_publish_date = input.nextPublishDate;
  if (input.publishReminderDays !== undefined) payload.publish_reminder_days = input.publishReminderDays;
  const { data, error } = await admin.from("channels").update(payload).eq("id", id).select(CHANNEL_SELECT).maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("CHANNEL_NOT_FOUND", "Không tìm thấy kênh.", 404);
  await admin.from("activity_logs").insert({
    user_id: actorId,
    channel_id: id,
    action: "channel.updated",
    entity_type: "channel",
    entity_id: id,
    new_data: payload,
  });
  return data as unknown as Channel;
}

export async function deleteChannel(id: string, actorId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: current, error: readError } = await admin.from("channels").select("id,name").eq("id", id).maybeSingle();
  if (readError) throw readError;
  if (!current) throw new AppError("CHANNEL_NOT_FOUND", "Không tìm thấy kênh.", 404);
  const { error } = await admin.from("channels").delete().eq("id", id);
  if (error) throw error;
  await admin.from("activity_logs").insert({
    user_id: actorId,
    channel_id: null,
    action: "channel.deleted",
    entity_type: "channel",
    entity_id: id,
    old_data: { name: current.name },
  });
}

export async function reorderChannels(ids: string[], startIndex: number, actorId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  for (const [index, id] of ids.entries()) {
    const { error } = await admin.from("channels").update({ sort_order: startIndex + index }).eq("id", id);
    if (error) throw error;
  }
  await admin.from("activity_logs").insert({ user_id: actorId, action: "channels.reordered", entity_type: "channel", new_data: { count: ids.length, start_index: startIndex } });
}

async function updateAlerts(channel: Channel, previous: Channel | null) {
  const admin = createSupabaseAdminClient();
  const alerts: Array<{ type: string; severity: "warning" | "critical"; title: string; message: string }> = [];
  const daysSinceUpload = channel.last_video_at ? (Date.now() - new Date(channel.last_video_at).getTime()) / 86400000 : Infinity;
  if (daysSinceUpload > 7) alerts.push({ type: "no_upload_7d", severity: daysSinceUpload > 21 ? "critical" : "warning", title: "Kênh lâu chưa đăng video", message: channel.last_video_at ? `Đã ${Math.floor(daysSinceUpload)} ngày chưa có video mới.` : "Chưa ghi nhận video công khai." });
  if (previous && previous.view_count > 0 && channel.view_count < previous.view_count * 0.8) alerts.push({ type: "views_drop", severity: "critical", title: "Lượt xem giảm bất thường", message: "Tổng lượt xem giảm hơn 20% so với lần đồng bộ trước." });
  for (const alert of alerts) {
    const { data: existing, error: readError } = await admin.from("alerts").select("id").eq("channel_id", channel.id).eq("type", alert.type).eq("is_resolved", false).maybeSingle();
    if (readError) throw readError;
    const { error } = existing
      ? await admin.from("alerts").update({ ...alert }).eq("id", existing.id)
      : await admin.from("alerts").insert({ channel_id: channel.id, ...alert, is_resolved: false });
    if (error) throw error;
  }
  const activeTypes = alerts.map((alert) => alert.type);
  let resolvedQuery = admin.from("alerts").update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq("channel_id", channel.id).eq("is_resolved", false).in("type", ["no_upload_7d", "views_drop"]);
  if (activeTypes.length) resolvedQuery = resolvedQuery.not("type", "in", `(${activeTypes.map((type) => `"${type}"`).join(",")})`);
  const { error: resolveError } = await resolvedQuery;
  if (resolveError) throw resolveError;
}

export async function syncChannel(id: string, actorId: string): Promise<{ channel: Channel; syncedVideos: number; videoPlaylistAvailable: boolean; warning?: string }> {
  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin.from("channels").select("*").eq("id", id).single();
  if (currentError || !current) throw new AppError("CHANNEL_NOT_FOUND", "Không tìm thấy kênh.", 404);
  const youtube = await getYouTubeChannelById(current.youtube_channel_id);
  let videos: Awaited<ReturnType<typeof getPlaylistVideos>> = [];
  let playlistWarning: string | undefined;
  try {
    videos = await getPlaylistVideos(youtube.uploadsPlaylistId);
  } catch (videoError) {
    if (!(videoError instanceof AppError) || videoError.code !== "YOUTUBE_PLAYLIST_NOT_FOUND") throw videoError;
    playlistWarning = videoError.message;
  }
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
      tags: video.tags,
      last_synced_at: now,
    })), { onConflict: "youtube_video_id,channel_id,reference_channel_id" });
    if (error) throw error;
  }
  const today = now.slice(0, 10);
  const { data: previousMetric, error: previousMetricError } = await admin.from("channel_metrics").select("subscriber_count,view_count").eq("channel_id", id).lt("metric_date", today).order("metric_date", { ascending: false }).limit(1).maybeSingle();
  if (previousMetricError) throw previousMetricError;
  const { error: metricError } = await admin.from("channel_metrics").upsert({
    channel_id: id,
    metric_date: today,
    subscriber_count: youtube.subscriberCount,
    view_count: youtube.viewCount,
    video_count: youtube.videoCount,
    subscriber_change: youtube.subscriberCount - Number(previousMetric?.subscriber_count ?? youtube.subscriberCount),
    view_change: youtube.viewCount - Number(previousMetric?.view_count ?? youtube.viewCount),
  }, { onConflict: "channel_id,metric_date" });
  if (metricError) throw metricError;
  await updateAlerts(updated as unknown as Channel, current as Channel);
  await admin.from("activity_logs").insert({ user_id: actorId, channel_id: id, action: "channel.synced", entity_type: "channel", entity_id: id, new_data: { videos: videos.length, playlist_warning: playlistWarning ?? null } });
  return { channel: updated as unknown as Channel, syncedVideos: videos.length, videoPlaylistAvailable: !playlistWarning, ...(playlistWarning ? { warning: playlistWarning } : {}) };
}

export async function syncAllChannels(actorId: string, input: { before: string; limit?: number; excludedIds?: string[] }) {
  const admin = createSupabaseAdminClient();
  const limit = Math.min(5, Math.max(1, input.limit ?? 3));
  let query = admin.from("channels")
    .select("id,name")
    .not("status", "in", '("paused","dead","suspended")')
    .or(`last_synced_at.is.null,last_synced_at.lt.${input.before}`)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit + 1);
  if (input.excludedIds?.length) query = query.not("id", "in", `(${input.excludedIds.join(",")})`);
  const { data, error } = await query;
  if (error) throw error;
  const channels = (data ?? []).slice(0, limit);
  const results: Array<{ id: string; name: string; ok: boolean; videoPlaylistAvailable?: boolean; warning?: string; error?: string }> = [];
  await Promise.all(channels.map(async (channel) => {
    try {
      const synced = await syncChannel(channel.id, actorId);
      results.push({ id: channel.id, name: channel.name, ok: true, videoPlaylistAvailable: synced.videoPlaylistAvailable, warning: synced.warning });
    }
    catch (syncError) { results.push({ id: channel.id, name: channel.name, ok: false, error: syncError instanceof AppError ? syncError.message : "Không thể đồng bộ dữ liệu kênh." }); }
  }));
  return {
    processed: results.length,
    succeeded: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).length,
    attemptedIds: channels.map((channel) => channel.id),
    hasMore: (data ?? []).length > limit,
    results,
  };
}

export type ChannelOption = Pick<Channel, "id" | "name" | "custom_url" | "youtube_url" | "avatar_url">;

export async function listChannelOptions(): Promise<ChannelOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("channels").select("id,name,custom_url,youtube_url,avatar_url").order("name");
  if (error) throw error;
  return (data ?? []) as ChannelOption[];
}
