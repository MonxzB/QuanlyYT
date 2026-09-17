import "server-only";
import { AppError } from "@/lib/api-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Prompt } from "@/types/domain";

const PROMPT_SELECT = "*, niche:niches(id,name)";

export interface PromptInput {
  nicheId?: string | null;
  title?: string | null;
  content: string;
}

export async function createPrompt(input: PromptInput, actorId: string): Promise<Prompt> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("prompts").insert({
    niche_id: input.nicheId ?? null,
    title: input.title ?? null,
    content: input.content,
    sort_order: Date.now(),
    created_by: actorId,
  }).select(PROMPT_SELECT).single();
  if (error && ["PGRST205", "42P01"].includes(error.code)) throw new AppError("DATABASE_NOT_READY", "Hãy chạy migration 007_prompts.sql trong Supabase trước khi lưu prompt.", 503);
  if (error) throw error;
  await admin.from("activity_logs").insert({ user_id: actorId, action: "prompt.created", entity_type: "prompt", entity_id: data.id, new_data: { title: data.title, niche_id: data.niche_id } });
  return data as unknown as Prompt;
}

export async function updatePrompt(id: string, input: Partial<PromptInput>, actorId: string): Promise<Prompt> {
  const admin = createSupabaseAdminClient();
  const payload: Record<string, unknown> = {};
  if (input.nicheId !== undefined) payload.niche_id = input.nicheId;
  if (input.title !== undefined) payload.title = input.title;
  if (input.content !== undefined) payload.content = input.content;
  const { data, error } = await admin.from("prompts").update(payload).eq("id", id).select(PROMPT_SELECT).maybeSingle();
  if (error && ["PGRST205", "42P01"].includes(error.code)) throw new AppError("DATABASE_NOT_READY", "Hãy chạy migration 007_prompts.sql trong Supabase trước khi lưu prompt.", 503);
  if (error) throw error;
  if (!data) throw new AppError("PROMPT_NOT_FOUND", "Không tìm thấy prompt.", 404);
  await admin.from("activity_logs").insert({ user_id: actorId, action: "prompt.updated", entity_type: "prompt", entity_id: id, new_data: payload });
  return data as unknown as Prompt;
}

export async function deletePrompt(id: string, actorId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("prompts").delete().eq("id", id).select("id,title,niche_id").maybeSingle();
  if (error && ["PGRST205", "42P01"].includes(error.code)) throw new AppError("DATABASE_NOT_READY", "Hãy chạy migration 007_prompts.sql trong Supabase trước khi lưu prompt.", 503);
  if (error) throw error;
  if (!data) throw new AppError("PROMPT_NOT_FOUND", "Không tìm thấy prompt.", 404);
  await admin.from("activity_logs").insert({ user_id: actorId, action: "prompt.deleted", entity_type: "prompt", entity_id: id, old_data: data });
}

export async function reorderPrompts(items: Array<{ id: string; nicheId: string | null; sortOrder: number }>, actorId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  const results = await Promise.all(items.map((item) => admin.from("prompts").update({ niche_id: item.nicheId, sort_order: item.sortOrder }).eq("id", item.id)));
  const error = results.find((result) => result.error)?.error;
  if (error && ["PGRST205", "42P01"].includes(error.code)) throw new AppError("DATABASE_NOT_READY", "Hãy chạy migration 007_prompts.sql trong Supabase trước khi sắp xếp prompt.", 503);
  if (error) throw error;
  await admin.from("activity_logs").insert({ user_id: actorId, action: "prompts.reordered", entity_type: "prompt", new_data: { count: items.length } });
}
