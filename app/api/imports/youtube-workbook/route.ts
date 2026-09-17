import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { importYoutubeWorkbook } from "@/services/workbook-import";

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable();
const rowSchema = z.object({
  sourceRow: z.number().int().min(2).max(10000),
  email: z.string().trim().email().max(320).nullable(),
  password: nullableText(500),
  recoveryEmail: z.string().trim().email().max(320).nullable(),
  phone: nullableText(80),
  hasTwoFactor: z.boolean(),
  twoFactorSecret: nullableText(500),
  purchasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  status: z.enum(["purchased", "setup", "warm_up", "active", "paused", "warning", "suspended", "dead"]),
  nicheName: nullableText(120),
  channelUrl: z.string().url().max(500).nullable(),
  referenceUrl: z.string().url().max(500).nullable(),
});

const schema = z.object({
  sourceFile: z.string().trim().min(1).max(255),
  rows: z.array(rowSchema).min(1).max(250),
});

export async function POST(request: Request) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const input = schema.parse(await request.json());
    return NextResponse.json({ data: await importYoutubeWorkbook(input, user.id) });
  } catch (error) {
    const payload = publicError(error);
    return NextResponse.json(payload, { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
