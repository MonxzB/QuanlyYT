import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { reorderNiches } from "@/services/niches";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export async function POST(request: Request) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const { ids } = schema.parse(await request.json());
    await reorderNiches(ids, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
