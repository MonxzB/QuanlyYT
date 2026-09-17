import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { getAccountCredentials } from "@/services/account-credentials";

const idSchema = z.string().uuid();

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin", "manager"]);
    const { id } = await context.params;
    const response = NextResponse.json({ data: await getAccountCredentials(idSchema.parse(id)) });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
