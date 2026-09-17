export type UserRole = "admin" | "manager" | "viewer";
export type ChannelStatus = "purchased" | "setup" | "warm_up" | "active" | "paused" | "warning" | "suspended" | "dead";
export type HealthStatus = "healthy" | "attention" | "critical" | "unknown";
export type AlertSeverity = "info" | "warning" | "critical";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Channel {
  id: string;
  name: string;
  youtube_channel_id: string;
  youtube_url: string;
  custom_url: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  status: ChannelStatus;
  health_status: HealthStatus;
  niche_id: string | null;
  account_id: string | null;
  profile_id: string | null;
  owner_id: string | null;
  country: string | null;
  subscriber_count: number;
  view_count: number;
  video_count: number;
  subscriber_change?: number;
  view_change?: number;
  video_change?: number;
  metric_date?: string | null;
  uploads_playlist_id: string | null;
  last_video_at: string | null;
  last_synced_at: string | null;
  purchased_at: string | null;
  started_at: string | null;
  description: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  niche?: Pick<Niche, "id" | "name"> | null;
  account?: Pick<Account, "id" | "email" | "recovery_email" | "phone" | "two_factor_enabled" | "has_password"> | null;
  browser_profile?: Pick<BrowserProfile, "id" | "name"> | null;
  owner?: Pick<Profile, "id" | "full_name"> | null;
}

export interface Account { id: string; email: string; recovery_email: string | null; phone: string | null; two_factor_enabled: boolean; has_password: boolean; country: string | null; source: string | null; status: string; sort_order: number; created_at: string; updated_at: string; }
export interface BrowserProfile { id: string; name: string; ip_label: string | null; country: string | null; status: string; notes: string | null; created_at: string; updated_at: string; }
export interface Niche { id: string; name: string; slug: string; description: string | null; sort_order?: number; created_at: string; }
export interface Prompt { id: string; niche_id: string | null; title: string | null; content: string; sort_order: number; created_by: string | null; created_at: string; updated_at: string; niche?: Pick<Niche, "id" | "name"> | null; }
export interface Video { id: string; youtube_video_id: string; channel_id: string; title: string; thumbnail_url: string | null; description: string | null; published_at: string; duration: string | null; view_count: number; like_count: number; comment_count: number; created_at: string; updated_at: string; last_synced_at: string | null; }
export interface Metric { id: string; channel_id: string; metric_date: string; subscriber_count: number; view_count: number; video_count: number; subscriber_change: number; view_change: number; created_at: string; }
export interface Alert { id: string; channel_id: string | null; type: string; severity: AlertSeverity; title: string; message: string; is_read: boolean; is_resolved: boolean; created_at: string; resolved_at: string | null; channel?: Pick<Channel, "id" | "name"> | null; }
export interface ActivityLog { id: string; user_id: string | null; channel_id: string | null; action: string; entity_type: string; entity_id: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; created_at: string; }

export interface Paginated<T> { data: T[]; page: number; pageSize: number; total: number; totalPages: number; }
export interface DashboardData { totalChannels: number; activeChannels: number; warmUpChannels: number; warningChannels: number; deadChannels: number; statusDistribution: Array<{ status: ChannelStatus; count: number }>; healthDistribution: Array<{ health: HealthStatus; count: number }>; nicheDistribution: Array<{ niche: string; count: number }>; recentAlerts: Alert[]; openAlertCount: number; recentActivities: ActivityLog[]; topGrowing: Array<Channel & { subscriber_change: number; view_change: number }>; recentlySynced: Channel[]; metrics: Array<{ date: string; subscribers: number; views: number; videos: number }>; }
