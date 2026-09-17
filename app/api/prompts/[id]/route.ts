import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { deletePrompt, updatePrompt } from "@/services/prompts";

const idSchema = z.string().uuid();
const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();
const updateSchema = z.object({
  nicheId: z.string().uuid().nullable().optional(),
  title: nullableText(200),
  content: z.string().trim().min(1).max(20000).optional(),
}).refine((value) => Object.keys(value).length > 0, "Không có thay đổi để lưu.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const { id } = await context.params;
    return NextResponse.json({ data: await updatePrompt(idSchema.parse(id), updateSchema.parse(await request.json()), user.id) });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const { id } = await context.params;
    await deletePrompt(idSchema.parse(id), user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
