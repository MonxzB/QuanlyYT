import { NextResponse } from "next/server";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { syncReferenceChannel } from "@/services/reference-channels";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin", "manager"]);
    const { id } = await context.params;
    return NextResponse.json({ data: await syncReferenceChannel(id) });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: statusOf(error) });
  }
}
