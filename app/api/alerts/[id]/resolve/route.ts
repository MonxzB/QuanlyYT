import { NextResponse } from "next/server";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin", "manager"]);
    const { id } = await context.params;
    const { error } = await createSupabaseAdminClient().from("alerts").update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const payload = publicError(error);
    return NextResponse.json(payload, { status: statusOf(error) });
  }
}
