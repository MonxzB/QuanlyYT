import { NextResponse } from "next/server";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { syncChannel } from "@/services/channels";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireRole(["admin", "manager"]);
    const { id } = await context.params;
    return NextResponse.json({ data: await syncChannel(id, user.id) });
  } catch (error) {
    const payload = publicError(error);
    return NextResponse.json(payload, { status: statusOf(error) });
  }
}
