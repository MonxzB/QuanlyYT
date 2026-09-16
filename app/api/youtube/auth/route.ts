import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { publicError, statusOf } from "@/lib/api-error";
import { requireRole } from "@/lib/supabase/auth";
import { createOAuthUrl } from "@/lib/youtube/oauth";

export async function GET() {
  try {
    await requireRole(["admin", "manager"]);
    const state = randomUUID();
    (await cookies()).set("youtube_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
    return NextResponse.redirect(createOAuthUrl(state));
  } catch (error) {
    const payload = publicError(error);
    return NextResponse.json(payload, { status: statusOf(error) });
  }
}
