import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { createNiche } from "@/services/niches";

const schema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().max(1000).nullable().optional() });

export async function POST(request: Request) {
  try {
    await requireRole(["admin", "manager"]);
    const input = schema.parse(await request.json());
    return NextResponse.json({ data: await createNiche(input) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
