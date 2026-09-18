import "server-only";
import { AppError } from "@/lib/api-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "your", "you", "are", "was", "were", "have", "has", "how", "why", "what", "when", "where", "who", "not", "but", "all", "new", "best", "video", "official", "part", "episode",
  "của", "và", "cho", "trong", "với", "một", "những", "các", "được", "khi", "tại", "từ", "đến", "này", "đó", "trên", "dưới", "về", "để", "không", "đang", "sẽ", "rất", "thật", "nhất", "mới", "phần", "tập", "video",
]);

type VideoRow = { title: string; tags: string[] | null; view_count: number; published_at: string };

export interface KeywordInsight {
  keyword: string;
  score: number;
  videoCount: number;
  totalViews: number;
  recentVideos: number;
  source: "Tiêu đề" | "YouTube tag" | "Tiêu đề + tag";
}

export interface ChannelKeywordReport {
  channel: { id: string; name: string; youtubeUrl: string };
  analyzedVideos: number;
  generatedAt: string;
  keywords: KeywordInsight[];
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("vi").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function usefulToken(value: string): boolean {
  return value.length >= 3 && !/^\d+$/.test(value) && !STOP_WORDS.has(value);
}

function phrasesFromTitle(title: string): string[] {
  const rawTokens = normalize(title).match(/[\p{L}\p{N}]+/gu) ?? [];
  const segments: string[][] = [];
  let segment: string[] = [];
  for (const token of rawTokens) {
    if (!usefulToken(token)) {
      if (segment.length) segments.push(segment);
      segment = [];
      continue;
    }
    segment.push(token);
  }
  if (segment.length) segments.push(segment);
  const phrases = new Set<string>();
  for (const tokens of segments) {
    for (let size = 1; size <= 3; size += 1) {
      for (let index = 0; index + size <= tokens.length; index += 1) {
        phrases.add(tokens.slice(index, index + size).join(" "));
      }
    }
  }
  return Array.from(phrases);
}

function normalizedTag(tag: string): string | null {
  const value = normalize(tag);
  if (!value || value.length > 80) return null;
  const tokens = value.split(" ");
  return tokens.some(usefulToken) ? value : null;
}

export async function getChannelKeywordReport(channelId: string, limit = 50): Promise<ChannelKeywordReport> {
  const supabase = await createSupabaseServerClient();
  const [{ data: channel, error: channelError }, { data: videoData, error: videoError }] = await Promise.all([
    supabase.from("channels").select("id,name,youtube_url").eq("id", channelId).maybeSingle(),
    supabase.from("videos").select("title,tags,view_count,published_at").eq("channel_id", channelId).order("published_at", { ascending: false }).limit(200),
  ]);
  if (channelError) throw channelError;
  if (!channel) throw new AppError("CHANNEL_NOT_FOUND", "Không tìm thấy kênh.", 404);
  if (videoError) throw videoError;

  const videos = (videoData ?? []) as VideoRow[];
  const channelName = normalize(channel.name);
  const stats = new Map<string, { videoCount: number; totalViews: number; recentVideos: number; titleHits: number; tagHits: number; rawScore: number }>();
  const recentCutoff = Date.now() - 90 * 86400000;

  for (const video of videos) {
    const candidates = new Map<string, { title: boolean; tag: boolean }>();
    for (const phrase of phrasesFromTitle(video.title)) candidates.set(phrase, { title: true, tag: false });
    for (const rawTag of video.tags ?? []) {
      const tag = normalizedTag(rawTag);
      if (!tag) continue;
      const current = candidates.get(tag);
      candidates.set(tag, { title: current?.title ?? false, tag: true });
    }
    for (const [keyword, source] of candidates) {
      if (keyword === channelName) continue;
      const current = stats.get(keyword) ?? { videoCount: 0, totalViews: 0, recentVideos: 0, titleHits: 0, tagHits: 0, rawScore: 0 };
      current.videoCount += 1;
      current.totalViews += Number(video.view_count || 0);
      current.recentVideos += new Date(video.published_at).getTime() >= recentCutoff ? 1 : 0;
      current.titleHits += source.title ? 1 : 0;
      current.tagHits += source.tag ? 1 : 0;
      stats.set(keyword, current);
    }
  }

  const ranked = Array.from(stats, ([keyword, item]) => {
    const words = keyword.split(" ").length;
    item.rawScore = item.videoCount * 16 + item.tagHits * 7 + item.recentVideos * 4 + Math.log10(item.totalViews + 1) * 12 + Math.min(words, 3) * 2;
    return { keyword, ...item };
  }).filter((item) => item.videoCount >= 2 || item.tagHits >= 1).sort((left, right) => right.rawScore - left.rawScore || right.totalViews - left.totalViews);
  const topScore = ranked[0]?.rawScore ?? 1;
  const keywords = ranked.slice(0, Math.min(100, Math.max(10, limit))).map<KeywordInsight>((item) => ({
    keyword: item.keyword,
    score: Math.max(1, Math.round(item.rawScore / topScore * 100)),
    videoCount: item.videoCount,
    totalViews: item.totalViews,
    recentVideos: item.recentVideos,
    source: item.titleHits && item.tagHits ? "Tiêu đề + tag" : item.tagHits ? "YouTube tag" : "Tiêu đề",
  }));

  return {
    channel: { id: channel.id, name: channel.name, youtubeUrl: channel.youtube_url },
    analyzedVideos: videos.length,
    generatedAt: new Date().toISOString(),
    keywords,
  };
}
