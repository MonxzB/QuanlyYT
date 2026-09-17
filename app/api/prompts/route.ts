import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { createPrompt } from "@/services/prompts";

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();
const schema = z.object({
  nicheId: z.string().uuid().nullable().optional(),
  title: nullableText(200),
  content: z.string().trim().min(1).max(20000),
});

export async function POST(request: Request) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const input = schema.parse(await request.json());
    return NextResponse.json({ data: await createPrompt(input, user.id) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
