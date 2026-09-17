import { redirect } from "next/navigation";
import { AppShell } from "@/components/channelos/app-shell";
import { isConfigured } from "@/lib/env";
import { getCurrentUser, getUserProfile } from "@/lib/supabase/auth";
import { listChannels } from "@/services/channels";
import { getDashboardData } from "@/services/dashboard";
import { getWorkspaceData } from "@/services/workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isConfigured()) return <SetupRequired />;
  const user = await getCurrentUser();
  if (!user) redirect("/dang-nhap");
  const profile = await getUserProfile(user.id);
  if (!profile) redirect("/dang-nhap?error=profile");
  const [dashboard, channels, workspace] = await Promise.all([
    getDashboardData(),
    listChannels({ page: 1, pageSize: 500 }),
    getWorkspaceData(),
  ]);
  return <AppShell dashboard={dashboard} channels={channels} workspace={workspace} user={{ name: profile.full_name || user.email || "Người dùng", role: profile.role }} />;
}

function SetupRequired() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"><span className="grid size-11 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white">C</span><h1 className="mt-5 text-2xl font-semibold text-slate-950">ChannelOS đang chờ cấu hình</h1><p className="mt-2 text-sm leading-6 text-slate-600">Mã nguồn đã sẵn sàng cho Supabase và YouTube Data API. Thêm các biến môi trường trong <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.local</code>, chạy các migration trong thư mục <code className="rounded bg-slate-100 px-1.5 py-0.5">supabase/migrations</code>, rồi tải lại trang.</p><div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Không dùng dữ liệu giả:</strong> ứng dụng chỉ hiển thị dữ liệu thật sau khi kết nối Supabase.</div></div></main>;
}
