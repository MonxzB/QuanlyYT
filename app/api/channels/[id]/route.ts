import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { deleteChannel, updateChannel } from "@/services/channels";

const idSchema = z.string().uuid();
const updateSchema = z.object({
  status: z.enum(["purchased", "setup", "warm_up", "active", "paused", "warning", "suspended", "dead"]).optional(),
  nicheId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "Không có thay đổi để lưu.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const { id: rawId } = await context.params;
    const id = idSchema.parse(rawId);
    const input = updateSchema.parse(await request.json());
    return NextResponse.json({ data: await updateChannel(id, input, user.id) });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireRole(["admin"]);
    const { id: rawId } = await context.params;
    const id = idSchema.parse(rawId);
    await deleteChannel(id, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
