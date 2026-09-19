import { NextResponse } from "next/server";
import { publicError, statusOf } from "@/lib/api-error";
import { requireApiUser } from "@/lib/supabase/auth";
import { getYoutubeQuotaStatus } from "@/lib/youtube/quota";

export async function GET() {
  try {
    await requireApiUser();
    return NextResponse.json(
      { data: await getYoutubeQuotaStatus() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(publicError(error), { status: statusOf(error) });
  }
}
