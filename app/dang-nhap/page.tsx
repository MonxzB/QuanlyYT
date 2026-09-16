import { redirect } from "next/navigation";
import { isConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!isConfigured()) redirect("/");
  if (await getCurrentUser()) redirect("/");
  return <main className="grid min-h-screen place-items-center bg-[#f8fafc] p-5"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgb(15_23_42/0.08)]"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-indigo-600 font-bold text-white">C</span><div><h1 className="text-xl font-semibold text-slate-950">Đăng nhập ChannelOS</h1><p className="text-sm text-slate-500">Không gian quản lý mạng lưới YouTube</p></div></div><LoginForm /></div></main>;
}
