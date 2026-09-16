import { NextResponse } from "next/server";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { syncAllChannels } from "@/services/channels";

export async function POST() {
  try {
    const { user } = await requireRole(["admin"]);
    return NextResponse.json({ data: await syncAllChannels(user.id) });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: statusOf(error) });
  }
}
