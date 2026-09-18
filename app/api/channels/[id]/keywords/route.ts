import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { getChannelKeywordReport } from "@/services/keyword-hunter";

const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ limit: z.coerce.number().int().min(10).max(100).default(50) });

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin", "manager", "viewer"]);
    const { id } = paramsSchema.parse(await context.params);
    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const response = NextResponse.json({ data: await getChannelKeywordReport(id, query.limit) });
    response.headers.set("Cache-Control", "private, max-age=60");
    return response;
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
