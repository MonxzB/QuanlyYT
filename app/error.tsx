"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center"><h1 className="text-xl font-semibold text-slate-950">Không thể tải dữ liệu</h1><p className="mt-2 text-sm text-slate-500">Kiểm tra kết nối Supabase hoặc thử tải lại trang.</p><Button onClick={reset} className="mt-5">Thử lại</Button></div></main>;
}
