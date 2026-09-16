import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireApiUser, requireRole } from "@/lib/supabase/auth";
import { resolveYouTubeChannel } from "@/lib/youtube/client";
import { createChannel, listChannels } from "@/services/channels";

const createSchema = z.object({
  youtubeUrl: z.string().url(),
  status: z.enum(["purchased", "setup", "warm_up", "active", "paused", "warning", "suspended", "dead"]).optional(),
  nicheId: z.string().uuid().nullish(),
  accountId: z.string().uuid().nullish(),
  profileId: z.string().uuid().nullish(),
  ownerId: z.string().uuid().nullish(),
  notes: z.string().max(4000).nullish(),
});

export async function GET(request: Request) {
  try {
    await requireApiUser();
    const url = new URL(request.url);
    const result = await listChannels({
      page: Number(url.searchParams.get("page") || 1),
      pageSize: Number(url.searchParams.get("pageSize") || 20),
      search: url.searchParams.get("search") || undefined,
      status: url.searchParams.get("status") || undefined,
      nicheId: url.searchParams.get("nicheId") || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const payload = publicError(error);
    return NextResponse.json(payload, { status: statusOf(error) });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const input = createSchema.parse(await request.json());
    const youtube = await resolveYouTubeChannel(input.youtubeUrl);
    const channel = await createChannel({ ...input, youtube }, user.id);
    return NextResponse.json({ data: channel }, { status: 201 });
  } catch (error) {
    const payload = publicError(error);
    const status = error instanceof z.ZodError ? 400 : statusOf(error);
    return NextResponse.json(payload, { status });
  }
}
