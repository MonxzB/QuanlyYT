import "server-only";
import { AppError } from "@/lib/api-error";
import { getServerEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type YoutubeQuotaStatus = {
  usageDate: string;
  used: number;
  limit: number;
  remaining: number;
  usedPercent: number;
  updatedAt: string | null;
  estimated: true;
};

const MISSING_QUOTA_SCHEMA_CODES = new Set(["42P01", "42883", "PGRST202", "PGRST205"]);

function pacificUsageDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function recordYoutubeQuotaUsage(units = 1): Promise<void> {
  if (!Number.isInteger(units) || units <= 0) return;
  try {
    const { error } = await createSupabaseAdminClient().rpc("increment_youtube_quota", { p_units: units });
    if (error && !MISSING_QUOTA_SCHEMA_CODES.has(error.code ?? "")) {
      console.error("Không thể ghi nhận quota YouTube", error);
    }
  } catch (error) {
    console.error("Không thể ghi nhận quota YouTube", error);
  }
}

export async function getYoutubeQuotaStatus(): Promise<YoutubeQuotaStatus> {
  const usageDate = pacificUsageDate();
  const limit = getServerEnv().YOUTUBE_DAILY_QUOTA;
  const { data, error } = await createSupabaseAdminClient()
    .from("youtube_quota_usage")
    .select("used_units, updated_at")
    .eq("usage_date", usageDate)
    .maybeSingle();

  if (error) {
    if (MISSING_QUOTA_SCHEMA_CODES.has(error.code ?? "")) {
      throw new AppError("DATABASE_NOT_READY", "Hãy chạy migration 014_youtube_quota_usage.sql để theo dõi quota YouTube.", 503);
    }
    throw error;
  }

  const used = Math.max(0, Number(data?.used_units ?? 0));
  return {
    usageDate,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    usedPercent: Math.min(100, Math.round((used / limit) * 100)),
    updatedAt: data?.updated_at ?? null,
    estimated: true,
  };
}
