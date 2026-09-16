import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireApiUser, requireRole } from "@/lib/supabase/auth";
import { createReferenceChannel, listReferenceChannels } from "@/services/reference-channels";

const schema = z.object({ youtubeUrl: z.string().url(), nicheId: z.string().uuid().nullish(), notes: z.string().max(4000).nullish() });

export async function GET() {
  try {
    await requireApiUser();
    return NextResponse.json({ data: await listReferenceChannels() });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: statusOf(error) });
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["admin", "manager"]);
    const input = schema.parse(await request.json());
    return NextResponse.json({ data: await createReferenceChannel(input) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
