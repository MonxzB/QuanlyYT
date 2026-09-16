import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { requireRole } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptToken, exchangeOAuthCode, getOAuthIdentity } from "@/lib/youtube/oauth";

export async function GET(request: Request) {
  const env = getServerEnv();
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const cookieStore = await cookies();
    const expected = cookieStore.get("youtube_oauth_state")?.value;
    cookieStore.delete("youtube_oauth_state");
    if (!code || !state || !expected || state !== expected) throw new Error("OAuth state không hợp lệ.");
    const tokens = await exchangeOAuthCode(code);
    const identity = await getOAuthIdentity(tokens.access_token);
    const admin = createSupabaseAdminClient();
    await admin.from("youtube_connections").delete().eq("user_id", user.id).is("channel_id", null);
    const { error } = await admin.from("youtube_connections").insert({
      user_id: user.id,
      channel_id: null,
      google_account_email: identity.email,
      youtube_channel_id: identity.channelId,
      youtube_channel_name: identity.channelName,
      access_token_encrypted: await encryptToken(tokens.access_token),
      refresh_token_encrypted: tokens.refresh_token ? await encryptToken(tokens.refresh_token) : null,
      token_expires_at: new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000).toISOString(),
      scope: tokens.scope ?? null,
      status: "connected",
    });
    if (error) throw error;
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/?oauth=connected`);
  } catch {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/?oauth=error`);
  }
}
