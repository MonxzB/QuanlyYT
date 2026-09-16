import "server-only";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/api-error";
import { createSupabaseServerClient } from "./server";
import type { Profile, UserRole } from "@/types/domain";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function requireUser(returnTo = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(`/dang-nhap?returnTo=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHORIZED", "Phiên đăng nhập không hợp lệ.", 401);
  return user;
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name, avatar_url, role, created_at, updated_at").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function requireRole(roles: UserRole[]) {
  const user = await requireApiUser();
  const profile = await getUserProfile(user.id);
  if (!profile || !roles.includes(profile.role)) throw new AppError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.", 403);
  return { user, profile };
}
