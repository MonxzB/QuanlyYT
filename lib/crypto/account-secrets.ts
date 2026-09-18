import "server-only";
import { AppError } from "@/lib/api-error";
import { getServerEnv } from "@/lib/env";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let dedicatedKeyPromise: Promise<CryptoKey> | null = null;
let legacyKeyPromise: Promise<CryptoKey> | null = null;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function importEncryptionKey(material: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(material));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function dedicatedEncryptionKey(): Promise<CryptoKey> {
  const secret = getServerEnv().ACCOUNT_SECRETS_ENCRYPTION_KEY;
  if (!secret) {
    throw new AppError("ACCOUNT_ENCRYPTION_NOT_CONFIGURED", "Chưa cấu hình khóa mã hóa thông tin tài khoản riêng.", 503);
  }
  if (!dedicatedKeyPromise) {
    dedicatedKeyPromise = importEncryptionKey(`channelos:account-secrets:v2:${secret}`);
  }
  return dedicatedKeyPromise;
}

async function legacyEncryptionKey(): Promise<CryptoKey> {
  if (!legacyKeyPromise) {
    legacyKeyPromise = (async () => {
      const material = await crypto.subtle.digest("SHA-256", encoder.encode(`channelos:account-secrets:v1:${getServerEnv().SUPABASE_SECRET_KEY}`));
      return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    })();
  }
  return legacyKeyPromise;
}

export async function encryptAccountSecret(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await dedicatedEncryptionKey(), encoder.encode(value));
  return `v2.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptAccountSecret(value: string | null): Promise<string | null> {
  if (!value) return null;
  const [version, iv, payload] = value.split(".");
  if (!["v1", "v2"].includes(version) || !iv || !payload) throw new AppError("CREDENTIAL_DECRYPT_FAILED", "Không thể giải mã thông tin đăng nhập.", 500);
  try {
    const key = version === "v2" ? await dedicatedEncryptionKey() : await legacyEncryptionKey();
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(iv) }, key, fromBase64Url(payload));
    return decoder.decode(decrypted);
  } catch {
    throw new AppError("CREDENTIAL_DECRYPT_FAILED", "Không thể giải mã thông tin đăng nhập. Khóa máy chủ có thể đã thay đổi.", 500);
  }
}

export function isLegacyAccountSecret(value: string | null): boolean {
  return Boolean(value?.startsWith("v1."));
}
