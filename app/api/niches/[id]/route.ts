import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { deleteNiche, updateNiche } from "@/services/niches";

const idSchema = z.string().uuid();
const updateSchema = z.object({ name: z.string().trim().min(1).max(100).optional(), description: z.string().trim().max(1000).nullable().optional() }).refine((value) => Object.keys(value).length > 0, "Không có thay đổi để lưu.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin", "manager"]);
    const { id: rawId } = await context.params;
    return NextResponse.json({ data: await updateNiche(idSchema.parse(rawId), updateSchema.parse(await request.json())) });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin"]);
    const { id: rawId } = await context.params;
    await deleteNiche(idSchema.parse(rawId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
