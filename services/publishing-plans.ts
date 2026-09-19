import "server-only";
import { AppError } from "@/lib/api-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ALERT_PREFIX = "publish_schedule:";
const MISSING_SCHEDULE_CODES = new Set(["42703", "PGRST204"]);

type ScheduleChannel = {
  id: string;
  name: string;
  publish_interval_days: number | null;
  next_publish_date: string | null;
  publish_reminder_days: number;
};

function vietnamDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function reminderCopy(channel: ScheduleChannel, daysUntil: number) {
  if (daysUntil < 0) {
    const lateDays = Math.abs(daysUntil);
    return {
      severity: "critical" as const,
      title: "Đã quá lịch đăng video",
      message: `Đã quá lịch đăng ${lateDays} ngày (lịch ${formatDate(channel.next_publish_date!)}). Hãy kiểm tra và cập nhật kế hoạch.`,
    };
  }
  if (daysUntil === 0) {
    return { severity: "warning" as const, title: "Hôm nay đến lịch đăng video", message: `Hôm nay (${formatDate(channel.next_publish_date!)}) là lịch đăng video của kênh.` };
  }
  return { severity: "warning" as const, title: "Sắp đến lịch đăng video", message: `Còn ${daysUntil} ngày đến lịch đăng video (${formatDate(channel.next_publish_date!)}).` };
}

export async function refreshPublishingReminders(): Promise<void> {
  const admin = createSupabaseAdminClient();
  const channelsResult = await admin.from("channels").select("id,name,publish_interval_days,next_publish_date,publish_reminder_days");
  if (channelsResult.error && MISSING_SCHEDULE_CODES.has(channelsResult.error.code ?? "")) return;
  if (channelsResult.error) throw channelsResult.error;

  const alertsResult = await admin.from("alerts").select("id,channel_id,type,is_resolved").like("type", `${ALERT_PREFIX}%`).order("created_at", { ascending: false });
  if (alertsResult.error) throw alertsResult.error;

  const today = vietnamDateKey();
  const channels = (channelsResult.data ?? []) as ScheduleChannel[];
  const alerts = (alertsResult.data ?? []) as Array<{ id: string; channel_id: string | null; type: string; is_resolved: boolean }>;
  const currentKeys = new Set<string>();
  const alertByKey = new Map<string, (typeof alerts)[number]>();
  for (const alert of alerts) {
    const key = `${alert.channel_id}:${alert.type}`;
    if (!alertByKey.has(key)) alertByKey.set(key, alert);
  }

  for (const channel of channels) {
    if (!channel.publish_interval_days || !channel.next_publish_date) continue;
    const daysUntil = daysBetween(today, channel.next_publish_date);
    if (daysUntil > channel.publish_reminder_days) continue;
    const type = `${ALERT_PREFIX}${channel.next_publish_date}`;
    const key = `${channel.id}:${type}`;
    currentKeys.add(key);
    const existing = alertByKey.get(key);
    if (existing?.is_resolved) continue;
    const copy = reminderCopy(channel, daysUntil);
    if (existing) {
      const { error } = await admin.from("alerts").update(copy).eq("id", existing.id);
      if (error) throw error;
      continue;
    }
    const { error } = await admin.from("alerts").insert({ channel_id: channel.id, type, ...copy, is_read: false, is_resolved: false });
    if (error?.code === "23505") continue;
    if (error) throw error;
  }

  const staleIds = alerts.filter((alert) => !alert.is_resolved && !currentKeys.has(`${alert.channel_id}:${alert.type}`)).map((alert) => alert.id);
  if (staleIds.length) {
    const { error } = await admin.from("alerts").update({ is_resolved: true, resolved_at: new Date().toISOString() }).in("id", staleIds);
    if (error) throw error;
  }
}

export async function completePublishingPlan(channelId: string, actorId: string): Promise<{ nextPublishDate: string }> {
  const admin = createSupabaseAdminClient();
  const { data: channel, error: readError } = await admin.from("channels").select("id,publish_interval_days,next_publish_date").eq("id", channelId).maybeSingle();
  if (readError) throw readError;
  if (!channel) throw new AppError("CHANNEL_NOT_FOUND", "Không tìm thấy kênh.", 404);
  if (!channel.publish_interval_days || !channel.next_publish_date) throw new AppError("PUBLISHING_PLAN_NOT_SET", "Kênh chưa có lịch đăng định kỳ.", 422);

  const today = vietnamDateKey();
  const nextPublishDate = addDays(today, Number(channel.publish_interval_days));
  const { error: updateError } = await admin.from("channels").update({ next_publish_date: nextPublishDate }).eq("id", channelId);
  if (updateError) throw updateError;
  const { error: alertError } = await admin.from("alerts").update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq("channel_id", channelId).eq("is_resolved", false).like("type", `${ALERT_PREFIX}%`);
  if (alertError) throw alertError;
  const { error: activityError } = await admin.from("activity_logs").insert({
    user_id: actorId,
    channel_id: channelId,
    action: "channel.publish_completed",
    entity_type: "channel",
    entity_id: channelId,
    new_data: { completed_on: today, next_publish_date: nextPublishDate, interval_days: channel.publish_interval_days },
  });
  if (activityError) throw activityError;
  return { nextPublishDate };
}
