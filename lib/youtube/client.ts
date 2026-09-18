import "server-only";
import { AppError } from "@/lib/api-error";
import { getServerEnv } from "@/lib/env";

const API_ROOT = "https://www.googleapis.com/youtube/v3";

export interface YouTubeChannel {
  id: string;
  title: string;
  description: string;
  customUrl: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  country: string | null;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  uploadsPlaylistId: string;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  duration: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

type ApiResponse<T> = T & { error?: { code?: number; message?: string; errors?: Array<{ reason?: string }> } };
type ThumbnailSet = { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string } };
interface RawChannel {
  id: string;
  snippet?: { title?: string; description?: string; customUrl?: string; country?: string; thumbnails?: ThumbnailSet };
  statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
  brandingSettings?: { image?: { bannerExternalUrl?: string }; channel?: { country?: string } };
}
interface RawPlaylistItem { contentDetails?: { videoId?: string } }
interface RawVideo {
  id: string;
  snippet?: { title?: string; description?: string; publishedAt?: string; thumbnails?: ThumbnailSet };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}

async function youtubeGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const { YOUTUBE_API_KEY } = getServerEnv();
  const query = new URLSearchParams({ ...params, key: YOUTUBE_API_KEY });
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}/${path}?${query}`, { next: { revalidate: 0 }, signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    if (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name)) {
      throw new AppError("YOUTUBE_TIMEOUT", "YouTube API phản hồi quá chậm. Vui lòng thử lại.", 504);
    }
    throw new AppError("YOUTUBE_NETWORK", "Không thể kết nối YouTube API.", 502);
  }
  const body = await response.json() as ApiResponse<T>;
  if (!response.ok || body.error) {
    const reason = body.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new AppError("YOUTUBE_QUOTA", "Đã hết hạn mức YouTube API hôm nay.", 429);
    }
    throw new AppError("YOUTUBE_API", body.error?.message || "Không thể kết nối YouTube.", response.status || 502);
  }
  return body;
}

function toNumber(value?: string): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function parseChannel(item: RawChannel): YouTubeChannel {
  const uploads = item.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new AppError("YOUTUBE_CHANNEL_INVALID", "Kênh không có playlist tải lên công khai.", 422);
  return {
    id: item.id,
    title: item.snippet?.title ?? "Kênh YouTube",
    description: item.snippet?.description ?? "",
    customUrl: item.snippet?.customUrl ?? null,
    avatarUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    bannerUrl: item.brandingSettings?.image?.bannerExternalUrl ?? null,
    country: item.snippet?.country ?? item.brandingSettings?.channel?.country ?? null,
    subscriberCount: toNumber(item.statistics?.subscriberCount),
    viewCount: toNumber(item.statistics?.viewCount),
    videoCount: toNumber(item.statistics?.videoCount),
    uploadsPlaylistId: uploads,
  };
}

export async function resolveYouTubeChannel(input: string): Promise<YouTubeChannel> {
  let url: URL;
  try { url = new URL(input.trim()); }
  catch { throw new AppError("INVALID_YOUTUBE_URL", "URL YouTube không hợp lệ.", 400); }
  if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname.toLowerCase())) {
    throw new AppError("INVALID_YOUTUBE_URL", "Vui lòng nhập URL kênh youtube.com.", 400);
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const first = parts[0] ?? "";
  let params: Record<string, string> | null = null;
  if (first === "channel" && /^UC[\w-]{20,}$/.test(parts[1] ?? "")) params = { id: parts[1] };
  else if (first.startsWith("@") && first.length > 1) params = { forHandle: first.slice(1) };
  if (!params) throw new AppError("UNSUPPORTED_YOUTUBE_URL", "Hỗ trợ URL dạng /@handle hoặc /channel/UC…", 400);
  const result = await youtubeGet<{ items?: RawChannel[] }>("channels", {
    part: "snippet,statistics,contentDetails,brandingSettings",
    ...params,
  });
  if (!result.items?.[0]) throw new AppError("YOUTUBE_CHANNEL_NOT_FOUND", "Không tìm thấy kênh YouTube.", 404);
  return parseChannel(result.items[0]);
}

export async function getYouTubeChannelById(channelId: string): Promise<YouTubeChannel> {
  const result = await youtubeGet<{ items?: RawChannel[] }>("channels", {
    part: "snippet,statistics,contentDetails,brandingSettings",
    id: channelId,
  });
  if (!result.items?.[0]) throw new AppError("YOUTUBE_CHANNEL_NOT_FOUND", "Kênh YouTube không còn khả dụng.", 404);
  return parseChannel(result.items[0]);
}

export async function getPlaylistVideos(playlistId: string, limit = 200): Promise<YouTubeVideo[]> {
  const ids: string[] = [];
  let pageToken = "";
  while (ids.length < limit) {
    const page = await youtubeGet<{ items?: RawPlaylistItem[]; nextPageToken?: string }>("playlistItems", {
      part: "contentDetails",
      playlistId,
      maxResults: String(Math.min(50, limit - ids.length)),
      ...(pageToken ? { pageToken } : {}),
    });
    ids.push(...(page.items ?? []).map((item) => item.contentDetails?.videoId).filter((id): id is string => Boolean(id)));
    if (!page.nextPageToken) break;
    pageToken = page.nextPageToken;
  }
  const videos: YouTubeVideo[] = [];
  for (let index = 0; index < ids.length; index += 50) {
    const batch = await youtubeGet<{ items?: RawVideo[] }>("videos", {
      part: "snippet,contentDetails,statistics",
      id: ids.slice(index, index + 50).join(","),
      maxResults: "50",
    });
    videos.push(...(batch.items ?? []).map((item) => ({
      id: item.id,
      title: item.snippet?.title ?? "Video",
      description: item.snippet?.description ?? "",
      thumbnailUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? null,
      publishedAt: item.snippet?.publishedAt ?? "",
      duration: item.contentDetails?.duration ?? null,
      viewCount: toNumber(item.statistics?.viewCount),
      likeCount: toNumber(item.statistics?.likeCount),
      commentCount: toNumber(item.statistics?.commentCount),
    })));
  }
  return videos.filter((video) => Boolean(video.publishedAt));
}
