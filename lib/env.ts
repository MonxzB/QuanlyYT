import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  ACCOUNT_SECRETS_ENCRYPTION_KEY: z.string().min(32).optional(),
  YOUTUBE_API_KEY: z.string().min(1),
  YOUTUBE_DAILY_QUOTA: z.coerce.number().int().positive().default(10_000)
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function getServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) throw new Error("Cấu hình máy chủ chưa đầy đủ.");
  return parsed.data;
}

export function isConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY && process.env.YOUTUBE_API_KEY);
}
