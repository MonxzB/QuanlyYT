import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { importPromptWorkbook } from "@/services/prompt-workbook-import";

const rowSchema = z.object({
  sourceCell: z.string().trim().min(1).max(20),
  nicheName: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(200).nullable(),
  content: z.string().trim().min(1).max(20000),
});
const schema = z.object({ rows: z.array(rowSchema).min(1).max(1000) });

export async function POST(request: Request) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const { rows } = schema.parse(await request.json());
    return NextResponse.json({ data: await importPromptWorkbook(rows, user.id) });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
