import "server-only";
import { AppError } from "@/lib/api-error";
import { decryptAccountSecret, encryptAccountSecret } from "@/lib/crypto/account-secrets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface AccountDetailsUpdate {
  email?: string;
  recoveryEmail?: string | null;
  phone?: string | null;
  password?: string | null;
  twoFactorSecret?: string | null;
}

export interface AccountCreateInput {
  email: string;
  recoveryEmail?: string | null;
  phone?: string | null;
  password?: string | null;
  twoFactorSecret?: string | null;
}

export async function getAccountCredentials(accountId: string): Promise<{ password: string | null; twoFactorSecret: string | null }> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("account_secrets").select("password_encrypted,two_factor_secret_encrypted").eq("account_id", accountId).maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("CREDENTIALS_NOT_FOUND", "Tài khoản chưa có thông tin đăng nhập đã lưu.", 404);
  const [password, twoFactorSecret] = await Promise.all([
    decryptAccountSecret(data.password_encrypted),
    decryptAccountSecret(data.two_factor_secret_encrypted),
  ]);
  return { password, twoFactorSecret };
}

export async function updateAccountDetails(accountId: string, input: AccountDetailsUpdate) {
  const admin = createSupabaseAdminClient();
  const { data: account, error: accountError } = await admin.from("accounts").select("id,email,recovery_email,phone,has_password,two_factor_enabled").eq("id", accountId).maybeSingle();
  if (accountError) throw accountError;
  if (!account) throw new AppError("ACCOUNT_NOT_FOUND", "Không tìm thấy tài khoản.", 404);

  const accountUpdate: Record<string, unknown> = {};
  if (input.email !== undefined) accountUpdate.email = input.email;
  if (input.recoveryEmail !== undefined) accountUpdate.recovery_email = input.recoveryEmail;
  if (input.phone !== undefined) accountUpdate.phone = input.phone;

  if (input.password !== undefined || input.twoFactorSecret !== undefined) {
    const { data: currentSecrets, error: secretReadError } = await admin.from("account_secrets").select("password_encrypted,two_factor_secret_encrypted").eq("account_id", accountId).maybeSingle();
    if (secretReadError) throw secretReadError;
    const passwordEncrypted = input.password === undefined
      ? currentSecrets?.password_encrypted ?? null
      : input.password ? await encryptAccountSecret(input.password) : null;
    const twoFactorEncrypted = input.twoFactorSecret === undefined
      ? currentSecrets?.two_factor_secret_encrypted ?? null
      : input.twoFactorSecret ? await encryptAccountSecret(input.twoFactorSecret) : null;
    const { error: secretError } = await admin.from("account_secrets").upsert({
      account_id: accountId,
      password_encrypted: passwordEncrypted,
      two_factor_secret_encrypted: twoFactorEncrypted,
    }, { onConflict: "account_id" });
    if (secretError) throw secretError;
    accountUpdate.has_password = Boolean(passwordEncrypted);
    accountUpdate.two_factor_enabled = Boolean(twoFactorEncrypted);
  }

  if (!Object.keys(accountUpdate).length) return account;
  const { data, error } = await admin.from("accounts").update(accountUpdate).eq("id", accountId).select("id,email,recovery_email,phone,has_password,two_factor_enabled").single();
  if (error?.code === "23505") throw new AppError("ACCOUNT_EMAIL_EXISTS", "Email này đã thuộc một tài khoản khác.", 409);
  if (error) throw error;
  return data;
}

export async function createAccount(input: AccountCreateInput) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("accounts").insert({
    email: input.email,
    recovery_email: input.recoveryEmail ?? null,
    phone: input.phone ?? null,
    has_password: false,
    two_factor_enabled: false,
    source: "Nhập thủ công",
    status: "active",
    sort_order: Date.now(),
  }).select("*").single();
  if (error?.code === "23505") throw new AppError("ACCOUNT_EMAIL_EXISTS", "Email này đã có trong hệ thống.", 409);
  if (error) throw error;
  if (input.password || input.twoFactorSecret) {
    await updateAccountDetails(data.id, { password: input.password ?? null, twoFactorSecret: input.twoFactorSecret ?? null });
    const { data: updated, error: readError } = await admin.from("accounts").select("*").eq("id", data.id).single();
    if (readError) throw readError;
    return updated;
  }
  return data;
}

export async function reorderAccounts(ids: string[]): Promise<void> {
  const admin = createSupabaseAdminClient();
  for (const [index, id] of ids.entries()) {
    const { error } = await admin.from("accounts").update({ sort_order: index }).eq("id", id);
    if (error) throw error;
  }
}
