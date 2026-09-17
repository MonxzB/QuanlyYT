import "server-only";
import { AppError } from "@/lib/api-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Niche, Prompt } from "@/types/domain";
import type { PromptWorkbookImportResult, PromptWorkbookRow } from "@/types/prompt-import";

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/\s+/g, " ").trim();
}

function slugify(value: string): string {
  const slug = normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || `chu-de-${[...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0).toString(36)}`;
}

function databaseError(error: { code?: string } | null): never {
  if (error && ["PGRST205", "42P01"].includes(error.code ?? "")) throw new AppError("DATABASE_NOT_READY", "Hãy chạy migration 007_prompts.sql trong Supabase trước khi import prompt.", 503);
  throw error;
}

export async function importPromptWorkbook(rows: PromptWorkbookRow[], actorId: string): Promise<PromptWorkbookImportResult> {
  const admin = createSupabaseAdminClient();
  const [nicheResult, promptResult] = await Promise.all([
    admin.from("niches").select("*"),
    admin.from("prompts").select("id,niche_id,content"),
  ]);
  if (nicheResult.error) throw nicheResult.error;
  if (promptResult.error) databaseError(promptResult.error);
  const nicheCache = new Map<string, Niche>((nicheResult.data ?? []).map((niche) => [normalize(niche.name), niche as Niche]));
  const existing = new Set((promptResult.data ?? []).map((prompt) => `${prompt.niche_id ?? ""}\u0000${normalize(prompt.content)}`));
  const createdPrompts: Prompt[] = [];
  const createdNiches: Niche[] = [];
  let skipped = 0;

  for (const row of rows) {
    const nicheKey = normalize(row.nicheName);
    let niche = nicheCache.get(nicheKey);
    if (!niche) {
      let nicheWasCreated = false;
      const { data, error } = await admin.from("niches").insert({ name: row.nicheName, slug: slugify(row.nicheName), description: "Tạo tự động khi import prompt từ Excel." }).select("*").single();
      if (error?.code === "23505") {
        const { data: existingNiche, error: readError } = await admin.from("niches").select("*").eq("slug", slugify(row.nicheName)).maybeSingle();
        if (readError) throw readError;
        if (!existingNiche) throw error;
        niche = existingNiche as Niche;
      } else if (error) throw error;
      else {
        niche = data as Niche;
        nicheWasCreated = true;
      }
      if (!niche) throw new AppError("NICHE_IMPORT_FAILED", "Không thể tạo chủ đề cho prompt.", 500);
      nicheCache.set(nicheKey, niche);
      if (nicheWasCreated) createdNiches.push(niche);
    }
    const duplicateKey = `${niche.id}\u0000${normalize(row.content)}`;
    if (existing.has(duplicateKey)) {
      skipped += 1;
      continue;
    }
    const { data, error } = await admin.from("prompts").insert({ niche_id: niche.id, title: row.title, content: row.content, sort_order: Date.now() + createdPrompts.length, created_by: actorId }).select("*, niche:niches(id,name)").single();
    if (error) databaseError(error);
    existing.add(duplicateKey);
    createdPrompts.push(data as unknown as Prompt);
  }

  await admin.from("activity_logs").insert({ user_id: actorId, action: "prompt_workbook.imported", entity_type: "prompt", new_data: { processed: rows.length, created: createdPrompts.length, skipped, niches_created: createdNiches.length } });
  return { processed: rows.length, created: createdPrompts.length, skipped, nichesCreated: createdNiches.length, prompts: createdPrompts, niches: createdNiches };
}
