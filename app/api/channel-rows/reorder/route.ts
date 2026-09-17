import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { reorderChannelRows } from "@/services/channel-rows";

const schema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    kind: z.enum(["channel", "account"]),
  })).min(1).max(1000),
});

export async function POST(request: Request) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const { items } = schema.parse(await request.json());
    await reorderChannelRows(items, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
