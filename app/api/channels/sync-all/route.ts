import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { syncAllChannels } from "@/services/channels";

const requestSchema = z.object({
  before: z.string().datetime(),
  limit: z.number().int().min(1).max(5).default(3),
  excludedIds: z.array(z.string().uuid()).max(1000).default([]),
});

export async function POST(request: Request) {
  try {
    const { user } = await requireRole(["admin"]);
    const input = requestSchema.parse(await request.json());
    return NextResponse.json({ data: await syncAllChannels(user.id, input) });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
