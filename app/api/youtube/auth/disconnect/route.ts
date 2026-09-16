import { NextResponse } from "next/server";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const { error } = await createSupabaseAdminClient().from("youtube_connections").delete().eq("user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const payload = publicError(error);
    return NextResponse.json(payload, { status: statusOf(error) });
  }
}
