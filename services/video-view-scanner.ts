import "server-only";
import { AppError } from "@/lib/api-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlaylistVideoPage, getVideosByIds } from "@/lib/youtube/client";

type ScanChannel = {
  id: string;
  uploads_playlist_id: string | null;
  video_view_scan_status: "idle" | "running" | "complete";
  video_view_scan_page_token: string | null;
  video_view_scan_accumulator: number;
  video_view_scan_video_count: number;
};

export interface VideoViewScanProgress {
  done: boolean;
  processedVideos: number;
  batchVideos: number;
  totalViews: number;
}

export async function scanChannelVideoViews(channelId: string, actorId: string, restart: boolean): Promise<VideoViewScanProgress> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("channels").select("id,uploads_playlist_id,video_view_scan_status,video_view_scan_page_token,video_view_scan_accumulator,video_view_scan_video_count").eq("id", channelId).maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("CHANNEL_NOT_FOUND", "Không tìm thấy kênh.", 404);
  if (!data.uploads_playlist_id) throw new AppError("UPLOADS_PLAYLIST_MISSING", "Kênh chưa có playlist video để quét.", 422);
  const playlistId = data.uploads_playlist_id;

  let current = data as ScanChannel;
  if (restart) {
    const { data: reset, error: resetError } = await admin.from("channels").update({
      video_view_scan_status: "running",
      video_view_scan_page_token: null,
      video_view_scan_accumulator: 0,
      video_view_scan_video_count: 0,
    }).eq("id", channelId).select("id,uploads_playlist_id,video_view_scan_status,video_view_scan_page_token,video_view_scan_accumulator,video_view_scan_video_count").single();
    if (resetError) throw resetError;
    current = reset as ScanChannel;
  } else if (current.video_view_scan_status !== "running") {
    throw new AppError("VIDEO_SCAN_NOT_RUNNING", "Phiên quét video không còn hoạt động. Vui lòng bắt đầu lại.", 409);
  }

  const page = await getPlaylistVideoPage(playlistId, current.video_view_scan_page_token ?? "");
  const videos = await getVideosByIds(page.videoIds);
  const now = new Date().toISOString();
  if (videos.length) {
    const { error: videoError } = await admin.from("videos").upsert(videos.map((video) => ({
      youtube_video_id: video.id,
      channel_id: channelId,
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
    if (videoError) throw videoError;
  }

  const totalViews = Number(current.video_view_scan_accumulator ?? 0) + videos.reduce((sum, video) => sum + video.viewCount, 0);
  const processedVideos = Number(current.video_view_scan_video_count ?? 0) + videos.length;
  const done = !page.nextPageToken;
  const payload = done ? {
    video_view_scan_status: "complete",
    video_view_scan_page_token: null,
    video_view_scan_accumulator: totalViews,
    video_view_scan_video_count: processedVideos,
    public_video_view_count: totalViews,
    public_video_view_scanned_at: now,
  } : {
    video_view_scan_status: "running",
    video_view_scan_page_token: page.nextPageToken,
    video_view_scan_accumulator: totalViews,
    video_view_scan_video_count: processedVideos,
  };
  let update = admin.from("channels").update(payload).eq("id", channelId).eq("video_view_scan_status", "running");
  update = current.video_view_scan_page_token
    ? update.eq("video_view_scan_page_token", current.video_view_scan_page_token)
    : update.is("video_view_scan_page_token", null);
  const { data: updated, error: updateError } = await update.select("id").maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new AppError("VIDEO_SCAN_CONFLICT", "Phiên quét đã được xử lý ở tab khác. Vui lòng tải lại dữ liệu.", 409);

  if (done) {
    await admin.from("activity_logs").insert({
      user_id: actorId,
      channel_id: channelId,
      action: "channel.video_views_scanned",
      entity_type: "channel",
      entity_id: channelId,
      new_data: { videos: processedVideos, public_video_views: totalViews },
    });
  }
  return { done, processedVideos, batchVideos: videos.length, totalViews };
}
