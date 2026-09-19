import { NextResponse } from "next/server";
import { publicError, statusOf } from "@/lib/api-error";
import { requireApiUser } from "@/lib/supabase/auth";
import { refreshPublishingReminders } from "@/services/publishing-plans";

export async function POST() {
  try {
    await requireApiUser();
    await refreshPublishingReminders();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: statusOf(error) });
  }
}
