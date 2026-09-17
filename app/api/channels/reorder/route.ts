import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { reorderChannels } from "@/services/channels";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  startIndex: z.number().int().min(0).max(100000),
});

export async function POST(request: Request) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const input = schema.parse(await request.json());
    await reorderChannels(input.ids, input.startIndex, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
