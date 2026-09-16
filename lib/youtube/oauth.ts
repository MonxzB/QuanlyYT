import "server-only";
import { AppError } from "@/lib/api-error";
import { getServerEnv } from "@/lib/env";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function oauthEnv() {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.OAUTH_TOKEN_ENCRYPTION_KEY) {
    throw new AppError("OAUTH_NOT_CONFIGURED", "YouTube Analytics OAuth chưa được cấu hình.", 503);
  }
  return env as typeof env & { GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string; OAUTH_TOKEN_ENCRYPTION_KEY: string };
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function encryptionKey() {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(oauthEnv().OAUTH_TOKEN_ENCRYPTION_KEY));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptToken(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), encoder.encode(value));
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(encrypted))}`;
}

export async function decryptToken(value: string): Promise<string> {
  const [version, iv, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !encrypted) throw new AppError("TOKEN_INVALID", "Token OAuth không hợp lệ.", 500);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(iv, "base64url") }, await encryptionKey(), Buffer.from(encrypted, "base64url"));
  return decoder.decode(plain);
}

export function createOAuthUrl(state: string): string {
  const env = oauthEnv();
  const query = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/youtube/auth/callback`,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: "openid email https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}

export async function exchangeOAuthCode(code: string) {
  const env = oauthEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/youtube/auth/callback`,
      grant_type: "authorization_code",
    }),
  });
  const body = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string };
  if (!response.ok || !body.access_token) throw new AppError("OAUTH_EXCHANGE_FAILED", body.error_description || "Không thể kết nối tài khoản Google.", 400);
  return body as Required<Pick<typeof body, "access_token">> & typeof body;
}

export async function getOAuthIdentity(accessToken: string) {
  const [userInfoResponse, channelResponse] = await Promise.all([
    fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${accessToken}` } }),
    fetch("https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true", { headers: { authorization: `Bearer ${accessToken}` } }),
  ]);
  const userInfo = await userInfoResponse.json() as { email?: string };
  const channelBody = await channelResponse.json() as { items?: Array<{ id: string; snippet?: { title?: string } }> };
  if (!userInfoResponse.ok || !channelResponse.ok) throw new AppError("OAUTH_IDENTITY_FAILED", "Không thể đọc tài khoản YouTube đã kết nối.", 400);
  return { email: userInfo.email ?? null, channelId: channelBody.items?.[0]?.id ?? null, channelName: channelBody.items?.[0]?.snippet?.title ?? null };
}
