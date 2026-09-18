import "server-only";
import { AppError } from "@/lib/api-error";
import { encryptAccountSecret } from "@/lib/crypto/account-secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveYouTubeChannel, type YouTubeChannel } from "@/lib/youtube/client";
import type { YoutubeWorkbookImportResult, YoutubeWorkbookRow } from "@/types/workbook-import";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

function normalizeName(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/\s+/g, " ").trim();
}

function slugify(value: string): string {
  const slug = normalizeName(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || `chu-de-${[...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0).toString(36)}`;
}

function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  return code === "PGRST205" || code === "42P01";
}

function rowErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return "Không thể lưu dữ liệu của dòng này.";
}

async function upsertNiche(admin: AdminClient, name: string, cache: Map<string, string>): Promise<{ id: string; created: boolean }> {
  const key = normalizeName(name);
  const cached = cache.get(key);
  if (cached) return { id: cached, created: false };

  const slug = slugify(name);
  const { data: existing, error: readError } = await admin.from("niches").select("id").eq("slug", slug).maybeSingle();
  if (readError) throw readError;
  if (existing) {
    cache.set(key, existing.id);
    return { id: existing.id, created: false };
  }

  const { data, error } = await admin.from("niches").insert({ name, slug }).select("id").single();
  if (error) throw error;
  cache.set(key, data.id);
  return { id: data.id, created: true };
}

async function upsertAccount(admin: AdminClient, row: YoutubeWorkbookRow, sourceFile: string): Promise<string | null> {
  if (!row.email) return null;
  const { data: existing, error: readError } = await admin.from("accounts").select("id,recovery_email,phone,two_factor_enabled,has_password").eq("email", row.email).maybeSingle();
  if (readError) throw readError;
  const payload = {
    email: row.email,
    recovery_email: row.recoveryEmail ?? existing?.recovery_email ?? null,
    phone: row.phone ?? existing?.phone ?? null,
    two_factor_enabled: row.hasTwoFactor || Boolean(existing?.two_factor_enabled),
    has_password: Boolean(row.password) || Boolean(existing?.has_password),
    source: `Excel: ${sourceFile}`,
    status: "active",
  };
  const { data, error } = existing
    ? await admin.from("accounts").update(payload).eq("id", existing.id).select("id").single()
    : await admin.from("accounts").insert({ ...payload, sort_order: Date.now() }).select("id").single();
  if (error) throw error;
  try {
    if (row.password || row.twoFactorSecret) {
      const { data: existingSecrets, error: secretReadError } = await admin.from("account_secrets").select("password_encrypted,two_factor_secret_encrypted").eq("account_id", data.id).maybeSingle();
      if (secretReadError) throw secretReadError;
      const { error: secretError } = await admin.from("account_secrets").upsert({
        account_id: data.id,
        password_encrypted: row.password ? await encryptAccountSecret(row.password) : existingSecrets?.password_encrypted ?? null,
        two_factor_secret_encrypted: row.twoFactorSecret ? await encryptAccountSecret(row.twoFactorSecret) : existingSecrets?.two_factor_secret_encrypted ?? null,
      }, { onConflict: "account_id" });
      if (secretError) throw secretError;
    }
  } catch (secretError) {
    if (!existing) {
      const { error: rollbackError } = await admin.from("accounts").delete().eq("id", data.id);
      if (rollbackError) console.error("Failed to roll back imported account", rollbackError);
    }
    throw secretError;
  }
  return data.id;
}

function channelPayload(row: YoutubeWorkbookRow, youtube: YouTubeChannel, actorId: string, accountId: string | null, nicheId: string | null) {
  return {
    name: youtube.title,
    youtube_channel_id: youtube.id,
    youtube_url: row.channelUrl,
    custom_url: youtube.customUrl,
    avatar_url: youtube.avatarUrl,
    banner_url: youtube.bannerUrl,
    status: row.status,
    health_status: "healthy",
    niche_id: nicheId,
    account_id: accountId,
    owner_id: actorId,
    country: youtube.country,
    subscriber_count: youtube.subscriberCount,
    view_count: youtube.viewCount,
    video_count: youtube.videoCount,
    uploads_playlist_id: youtube.uploadsPlaylistId,
    purchased_at: row.purchasedAt,
    description: youtube.description,
    last_synced_at: new Date().toISOString(),
  };
}

async function importChannel(admin: AdminClient, row: YoutubeWorkbookRow, actorId: string, accountId: string | null, nicheId: string | null): Promise<"created" | "updated"> {
  if (!row.channelUrl) throw new AppError("CHANNEL_URL_MISSING", "Dòng không có link kênh.", 400);
  const youtube = await resolveYouTubeChannel(row.channelUrl);
  const payload = channelPayload(row, youtube, actorId, accountId, nicheId);
  const { data: existing, error: readError } = await admin.from("channels").select("id").eq("youtube_channel_id", youtube.id).maybeSingle();
  if (readError) throw readError;

  let channelId: string;
  if (existing) {
    const { error } = await admin.from("channels").update(payload).eq("id", existing.id);
    if (error) throw error;
    channelId = existing.id;
  } else {
    const { data, error } = await admin.from("channels").insert({ ...payload, sort_order: Date.now() }).select("id").single();
    if (error) throw error;
    channelId = data.id;
  }

  const { error: metricError } = await admin.from("channel_metrics").upsert({
    channel_id: channelId,
    metric_date: new Date().toISOString().slice(0, 10),
    subscriber_count: youtube.subscriberCount,
    view_count: youtube.viewCount,
    video_count: youtube.videoCount,
    subscriber_change: 0,
    view_change: 0,
  }, { onConflict: "channel_id,metric_date" });
  if (metricError) {
    if (!existing) {
      const { error: rollbackError } = await admin.from("channels").delete().eq("id", channelId);
      if (rollbackError) console.error("Failed to roll back imported channel", rollbackError);
    }
    throw metricError;
  }
  return existing ? "updated" : "created";
}

async function importReference(admin: AdminClient, row: YoutubeWorkbookRow, nicheId: string | null): Promise<"created" | "updated"> {
  if (!row.referenceUrl) throw new AppError("REFERENCE_URL_MISSING", "Dòng không có link kênh tham khảo.", 400);
  const youtube = await resolveYouTubeChannel(row.referenceUrl);
  const payload = {
    youtube_channel_id: youtube.id,
    youtube_url: row.referenceUrl,
    name: youtube.title,
    custom_url: youtube.customUrl,
    avatar_url: youtube.avatarUrl,
    niche_id: nicheId,
    subscriber_count: youtube.subscriberCount,
    view_count: youtube.viewCount,
    video_count: youtube.videoCount,
    uploads_playlist_id: youtube.uploadsPlaylistId,
    last_synced_at: new Date().toISOString(),
    is_following: true,
  };
  const { data: existing, error: readError } = await admin.from("reference_channels").select("id").eq("youtube_channel_id", youtube.id).maybeSingle();
  if (readError) throw readError;
  if (existing) {
    const { error } = await admin.from("reference_channels").update(payload).eq("id", existing.id);
    if (error) throw error;
    return "updated";
  }
  const { error } = await admin.from("reference_channels").insert(payload);
  if (error) throw error;
  return "created";
}

export async function importYoutubeWorkbook(input: { sourceFile: string; rows: YoutubeWorkbookRow[] }, actorId: string): Promise<YoutubeWorkbookImportResult> {
  const admin = createSupabaseAdminClient();
  const sourceFile = input.sourceFile.replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 120) || "Youtube.xlsx";
  const nicheCache = new Map<string, string>();
  const result: YoutubeWorkbookImportResult = {
    processedRows: 0,
    failedRows: 0,
    accountsImported: 0,
    nichesCreated: 0,
    channelsCreated: 0,
    channelsUpdated: 0,
    referencesCreated: 0,
    referencesUpdated: 0,
    errors: [],
  };

  for (const row of input.rows) {
    result.processedRows += 1;
    const failures: string[] = [];
    let accountId: string | null = null;
    let nicheId: string | null = null;
    try {
      accountId = await upsertAccount(admin, row, sourceFile);
      if (accountId) result.accountsImported += 1;
      if (row.nicheName) {
        const niche = await upsertNiche(admin, row.nicheName, nicheCache);
        nicheId = niche.id;
        if (niche.created) result.nichesCreated += 1;
      }
    } catch (error) {
      if (isMissingSchemaError(error)) throw new AppError("DATABASE_NOT_READY", "Supabase chưa có đủ bảng. Hãy chạy các migration trước khi import.", 503);
      result.failedRows += 1;
      result.errors.push({ row: row.sourceRow, message: rowErrorMessage(error) });
      continue;
    }

    if (row.channelUrl) {
      try {
        const action = await importChannel(admin, row, actorId, accountId, nicheId);
        if (action === "created") result.channelsCreated += 1;
        else result.channelsUpdated += 1;
      } catch (error) {
        if (isMissingSchemaError(error)) throw new AppError("DATABASE_NOT_READY", "Supabase chưa có đủ bảng. Hãy chạy các migration trước khi import.", 503);
        const accountNote = accountId ? " Tài khoản của dòng này vẫn đã được lưu." : "";
        failures.push(`kênh chính: ${rowErrorMessage(error)}${accountNote}`);
      }
    }

    if (row.referenceUrl) {
      try {
        const action = await importReference(admin, row, nicheId);
        if (action === "created") result.referencesCreated += 1;
        else result.referencesUpdated += 1;
      } catch (error) {
        if (isMissingSchemaError(error)) throw new AppError("DATABASE_NOT_READY", "Supabase chưa có đủ bảng. Hãy chạy các migration trước khi import.", 503);
        failures.push(`kênh tham khảo: ${rowErrorMessage(error)}`);
      }
    }

    if (failures.length) {
      result.failedRows += 1;
      result.errors.push({ row: row.sourceRow, message: failures.join("; ") });
    }
  }

  const { error: logError } = await admin.from("activity_logs").insert({
    user_id: actorId,
    action: "workbook.imported",
    entity_type: "workbook",
    new_data: {
      source_file: sourceFile,
      processed_rows: result.processedRows,
      failed_rows: result.failedRows,
      channels_created: result.channelsCreated,
      channels_updated: result.channelsUpdated,
      references_created: result.referencesCreated,
      references_updated: result.referencesUpdated,
    },
  });
  if (logError && isMissingSchemaError(logError)) throw new AppError("DATABASE_NOT_READY", "Supabase chưa có đủ bảng. Hãy chạy các migration trước khi import.", 503);
  return result;
}
