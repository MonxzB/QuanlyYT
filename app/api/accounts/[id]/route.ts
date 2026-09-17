import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { updateAccountDetails } from "@/services/account-credentials";

const idSchema = z.string().uuid();
const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable();
const updateSchema = z.object({
  email: z.string().trim().email().max(320).optional(),
  recoveryEmail: z.string().trim().email().max(320).nullable().optional(),
  phone: nullableText(80).optional(),
  password: nullableText(500).optional(),
  twoFactorSecret: nullableText(500).optional(),
}).refine((value) => Object.keys(value).length > 0, "Không có thay đổi để lưu.");

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin", "manager"]);
    const { id } = await context.params;
    return NextResponse.json({ data: await updateAccountDetails(idSchema.parse(id), updateSchema.parse(await request.json())) });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
