import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Account, Alert, BrowserProfile, Niche, Profile, Video } from "@/types/domain";

export interface ReferenceChannel {
  id: string; name: string; youtube_url: string; custom_url: string | null; avatar_url: string | null;
  subscriber_count: number; view_count: number; video_count: number; last_synced_at: string | null;
  niche?: Pick<Niche, "id" | "name"> | null;
}

export interface ContentTask {
  id: string; channel_id: string | null; title: string; stage: string; publish_at: string | null;
  progress: number; owner_id: string | null; created_at: string; updated_at: string;
  channel?: { id: string; name: string } | null;
}

export interface WorkspaceData {
  accounts: Account[];
  browserProfiles: BrowserProfile[];
  niches: Array<Niche & { channelCount: number; referenceCount: number }>;
  team: Profile[];
  references: ReferenceChannel[];
  alerts: Alert[];
  contentTasks: ContentTask[];
  recentVideos: Video[];
}

export async function getWorkspaceData(): Promise<WorkspaceData> {
  const supabase = await createSupabaseServerClient();
  const [accounts, profiles, niches, team, references, alerts, contentTasks, recentVideos, channelNiches, referenceNiches] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at", { ascending: false }),
    supabase.from("browser_profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("niches").select("*").order("name"),
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("reference_channels").select("*, niche:niches(id,name)").order("updated_at", { ascending: false }),
    supabase.from("alerts").select("*, channel:channels(id,name)").order("created_at", { ascending: false }).limit(100),
    supabase.from("content_tasks").select("*, channel:channels(id,name)").order("updated_at", { ascending: false }),
    supabase.from("videos").select("*").order("published_at", { ascending: false }).limit(24),
    supabase.from("channels").select("niche_id"),
    supabase.from("reference_channels").select("niche_id"),
  ]);
  const results = [accounts, profiles, niches, team, references, alerts, contentTasks, recentVideos, channelNiches, referenceNiches];
  for (const result of results) if (result.error) throw result.error;
  return {
    accounts: (accounts.data ?? []) as Account[],
    browserProfiles: (profiles.data ?? []) as BrowserProfile[],
    niches: ((niches.data ?? []) as Niche[]).map((niche) => ({
      ...niche,
      channelCount: ((channelNiches.data ?? []) as Array<{ niche_id: string | null }>).filter((item) => item.niche_id === niche.id).length,
      referenceCount: ((referenceNiches.data ?? []) as Array<{ niche_id: string | null }>).filter((item) => item.niche_id === niche.id).length,
    })),
    team: (team.data ?? []) as Profile[],
    references: (references.data ?? []) as unknown as ReferenceChannel[],
    alerts: (alerts.data ?? []) as unknown as Alert[],
    contentTasks: (contentTasks.data ?? []) as unknown as ContentTask[],
    recentVideos: (recentVideos.data ?? []) as Video[],
  };
}
