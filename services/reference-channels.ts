import "server-only";
import { AppError } from "@/lib/api-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlaylistVideos, getYouTubeChannelById, resolveYouTubeChannel } from "@/lib/youtube/client";
import type { ReferenceChannel } from "@/services/workspace";

export async function listReferenceChannels(): Promise<ReferenceChannel[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("reference_channels").select("*, niche:niches(id,name)").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ReferenceChannel[];
}

export async function createReferenceChannel(input: { youtubeUrl: string; nicheId?: string | null; notes?: string | null }) {
  const youtube = await resolveYouTubeChannel(input.youtubeUrl);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("reference_channels").insert({
    youtube_channel_id: youtube.id,
    youtube_url: input.youtubeUrl,
    name: youtube.title,
    custom_url: youtube.customUrl,
    avatar_url: youtube.avatarUrl,
    niche_id: input.nicheId ?? null,
    subscriber_count: youtube.subscriberCount,
    view_count: youtube.viewCount,
    video_count: youtube.videoCount,
    uploads_playlist_id: youtube.uploadsPlaylistId,
    last_synced_at: new Date().toISOString(),
    notes: input.notes ?? null,
  }).select("*, niche:niches(id,name)").single();
  if (error?.code === "23505") throw new AppError("REFERENCE_EXISTS", "Kênh tham khảo này đã tồn tại.", 409);
  if (error) throw error;
  return data as unknown as ReferenceChannel;
}

export async function syncReferenceChannel(id: string) {
  const admin = createSupabaseAdminClient();
  const { data: current, error: currentError } = await admin.from("reference_channels").select("*").eq("id", id).single();
  if (currentError || !current) throw new AppError("REFERENCE_NOT_FOUND", "Không tìm thấy kênh tham khảo.", 404);
  const youtube = await getYouTubeChannelById(current.youtube_channel_id);
  const videos = await getPlaylistVideos(youtube.uploadsPlaylistId, 100);
  const now = new Date().toISOString();
  const { data, error } = await admin.from("reference_channels").update({
    name: youtube.title,
    custom_url: youtube.customUrl,
    avatar_url: youtube.avatarUrl,
    subscriber_count: youtube.subscriberCount,
    view_count: youtube.viewCount,
    video_count: youtube.videoCount,
    uploads_playlist_id: youtube.uploadsPlaylistId,
    last_synced_at: now,
  }).eq("id", id).select("*, niche:niches(id,name)").single();
  if (error) throw error;
  if (videos.length) {
    const { error: videoError } = await admin.from("videos").upsert(videos.map((video) => ({
      youtube_video_id: video.id,
      reference_channel_id: id,
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
    if (videoError) throw videoError;
  }
  return { reference: data as unknown as ReferenceChannel, syncedVideos: videos.length };
}
