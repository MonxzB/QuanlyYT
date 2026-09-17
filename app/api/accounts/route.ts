import { NextResponse } from "next/server";
import { z } from "zod";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { createAccount } from "@/services/account-credentials";

const nullableText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();
const schema = z.object({
  email: z.string().trim().email().max(320),
  recoveryEmail: z.string().trim().email().max(320).nullable().optional(),
  phone: nullableText(80),
  password: nullableText(500),
  twoFactorSecret: nullableText(500),
});

export async function POST(request: Request) {
  try {
    await requireRole(["admin", "manager"]);
    return NextResponse.json({ data: await createAccount(schema.parse(await request.json())) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(publicError(error), { status: error instanceof z.ZodError ? 400 : statusOf(error) });
  }
}
