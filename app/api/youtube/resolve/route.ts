import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { resolveYouTubeChannel } from "@/lib/youtube/client";

const schema = z.object({ url: z.string().url() });

export async function POST(request: Request) {
  try {
    await requireRole(["admin", "manager"]);
    const { url } = schema.parse(await request.json());
    return NextResponse.json({ data: await resolveYouTubeChannel(url) });
  } catch (error) {
    const payload = publicError(error);
    const status = error instanceof z.ZodError ? 400 : statusOf(error);
    return NextResponse.json(payload, { status });
  }
}
