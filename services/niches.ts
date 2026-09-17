import "server-only";
import { AppError } from "@/lib/api-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Niche } from "@/types/domain";

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createNiche(input: { name: string; description?: string | null }): Promise<Niche> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("niches").insert({ name: input.name, slug: slugify(input.name), description: input.description ?? null }).select("*").single();
  if (error?.code === "23505") throw new AppError("NICHE_EXISTS", "Tên hoặc slug chủ đề đã tồn tại.", 409);
  if (error) throw error;
  return data as Niche;
}

export async function updateNiche(id: string, input: { name?: string; description?: string | null }): Promise<Niche> {
  const admin = createSupabaseAdminClient();
  const payload = { ...input, ...(input.name ? { slug: slugify(input.name) } : {}) };
  const { data, error } = await admin.from("niches").update(payload).eq("id", id).select("*").maybeSingle();
  if (error?.code === "23505") throw new AppError("NICHE_EXISTS", "Tên hoặc slug chủ đề đã tồn tại.", 409);
  if (error) throw error;
  if (!data) throw new AppError("NICHE_NOT_FOUND", "Không tìm thấy chủ đề.", 404);
  return data as Niche;
}

export async function deleteNiche(id: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("niches").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("NICHE_NOT_FOUND", "Không tìm thấy chủ đề.", 404);
}

export async function reorderNiches(ids: string[], actorId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const results = await Promise.all(ids.map((id, index) => admin.from("niches").update({ sort_order: index }).eq("id", id)));
  const error = results.find((result) => result.error)?.error;
  if (error && ["42703", "PGRST204"].includes(error.code)) throw new AppError("DATABASE_NOT_READY", "Hãy chạy migration 008_niche_ordering.sql trong Supabase trước khi sắp xếp chủ đề.", 503);
  if (error) throw error;
  await admin.from("activity_logs").insert({ user_id: actorId, action: "niches.reordered", entity_type: "niche", new_data: { count: ids.length } });
}
