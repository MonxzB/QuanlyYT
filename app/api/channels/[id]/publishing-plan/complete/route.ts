import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { completePublishingPlan } from "@/services/publishing-plans";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const { id: rawId } = await context.params;
    const id = z.string().uuid().parse(rawId);
    return NextResponse.json({ data: await completePublishingPlan(id, user.id) });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
