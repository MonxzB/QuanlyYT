import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { scanChannelVideoViews } from "@/services/video-view-scanner";

const idSchema = z.string().uuid();
const bodySchema = z.object({ action: z.enum(["start", "continue"]) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());
    return NextResponse.json({ data: await scanChannelVideoViews(idSchema.parse(id), user.id, body.action === "start") });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
