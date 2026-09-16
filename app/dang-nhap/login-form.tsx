"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(search.get("error") === "profile" ? "Tài khoản chưa có hồ sơ hoặc quyền truy cập." : "");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    const { error: authError } = await createSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    if (authError) { setError("Email hoặc mật khẩu không đúng."); setLoading(false); return; }
    const returnTo = search.get("returnTo");
    router.replace(returnTo?.startsWith("/") ? returnTo : "/");
    router.refresh();
  };
  return <form onSubmit={submit} className="mt-7 space-y-4"><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Email</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" placeholder="ban@congty.com" /></label><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Mật khẩu</span><input type="password" required minLength={6} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100" /></label>{error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button type="submit" disabled={loading} className="h-11 w-full bg-indigo-600 hover:bg-indigo-700">{loading && <LoaderCircle className="animate-spin" />} Đăng nhập</Button><p className="text-center text-xs leading-5 text-slate-400">Tài khoản do quản trị viên tạo trong Supabase Auth.</p></form>;
}
