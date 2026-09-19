"use client";
/* eslint-disable @typescript-eslint/no-unused-vars, @next/next/no-img-element */

import { useEffect, useState, type MouseEvent } from "react";
import { AlertTriangle, Bell, BookOpenText, CalendarClock, CirclePlay, FolderKanban, Globe2, KeyRound, LayoutDashboard, Lightbulb, LoaderCircle, LogOut, MessageSquareText, Settings, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { t } from "@/lib/i18n";
import type { Channel, DashboardData, Paginated, UserRole } from "@/types/domain";
import type { WorkspaceData } from "@/services/workspace";
import type { ChannelOption } from "@/services/channels";
import { ChannelsLive } from "./channels-live";
import { DashboardLive } from "./dashboard-live";
import { ReferencesLive } from "./references-live";
import { NichesLive } from "./niches-live";
import { PromptsLive } from "./prompts-live";
import { KeywordHunterLive } from "./keyword-hunter-live";
import { compactNumber, relativeDate } from "./format";

const nav = [
  { id: "dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
  { id: "channels", label: t("nav.channels"), icon: CirclePlay },
  { id: "keyword-hunter", label: t("nav.keywordHunter"), icon: KeyRound },
  { id: "content", label: t("nav.content"), icon: FolderKanban },
  { id: "niches", label: t("nav.niches"), icon: Lightbulb },
  { id: "prompts", label: t("nav.prompts"), icon: MessageSquareText },
  { id: "research", label: t("nav.research"), icon: BookOpenText },
  { id: "profiles", label: t("nav.profiles"), icon: Globe2 },
  { id: "alerts", label: t("nav.alerts"), icon: Bell },
] as const;

const Youtube = CirclePlay;

type PageId = typeof nav[number]["id"] | "settings";

const pageIds = new Set<PageId>([...nav.map((item) => item.id), "settings"]);

function validPage(value?: string | null): PageId {
  return value && pageIds.has(value as PageId) ? value as PageId : "dashboard";
}

function pageHref(page: PageId): string {
  return page === "dashboard" ? "/" : `/?tab=${page}`;
}

export function AppShell({ dashboard, channels, channelOptions, workspace, user, initialPage }: { dashboard: DashboardData; channels: Paginated<Channel>; channelOptions: ChannelOption[]; workspace: WorkspaceData; user: { name: string; role: UserRole }; initialPage?: string }) {
  const router = useRouter();
  const [page, setPage] = useState<PageId>(() => validPage(initialPage));
  const canManage = user.role === "admin" || user.role === "manager";
  const signOut = async () => { await createSupabaseBrowserClient().auth.signOut(); router.replace("/dang-nhap"); router.refresh(); };
  const navigate = (event: MouseEvent<HTMLAnchorElement>, nextPage: PageId) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setPage(nextPage);
    window.history.pushState(null, "", pageHref(nextPage));
  };
  useEffect(() => {
    const syncPageFromUrl = () => setPage(validPage(new URLSearchParams(window.location.search).get("tab")));
    window.addEventListener("popstate", syncPageFromUrl);
    return () => window.removeEventListener("popstate", syncPageFromUrl);
  }, []);
  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const response = await fetch("/api/publishing-plans/reminders", { method: "POST" });
        if (response.ok) router.refresh();
      } catch {
        // Việc kiểm tra nền không được làm gián đoạn thao tác đang có trên trang.
      }
    }, 3_600_000);
    return () => window.clearInterval(id);
  }, [router]);
  const content = page === "dashboard" ? <DashboardLive data={dashboard} onNavigate={(value) => setPage(value as PageId)} />
    : page === "channels" ? <ChannelsLive initial={channels} niches={workspace.niches} accounts={workspace.accounts} linkedAccountIds={workspace.linkedAccountIds} canManage={canManage} canDelete={user.role === "admin"} canRevealCredentials={user.role === "admin"} />
    : page === "keyword-hunter" ? <KeywordHunterLive channels={channelOptions} />
    : page === "content" ? <ContentView data={workspace} />
    : page === "niches" ? <NichesLive initial={workspace.niches} canManage={canManage} canDelete={user.role === "admin"} />
    : page === "prompts" ? <PromptsLive initial={workspace.prompts} niches={workspace.niches} canManage={canManage} />
    : page === "research" ? <ReferencesLive initial={workspace.references} niches={workspace.niches} canManage={canManage} />
    : page === "profiles" ? <ProfilesView data={workspace} />
    : page === "alerts" ? <AlertsView data={workspace} />
    : <SettingsView />;
  return <SidebarProvider>
    <Sidebar collapsible="icon" className="border-r border-slate-200 bg-[#fbfcfe]">
      <SidebarHeader className="border-b border-slate-200 p-3"><div className="flex h-12 items-center gap-2.5 px-2"><span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-indigo-600 text-white"><CirclePlay className="size-[18px]" /></span><div className="group-data-[collapsible=icon]:hidden"><p className="text-[15px] font-semibold">ChannelOS</p><p className="text-xs text-slate-500">Quản lý mạng lưới</p></div></div></SidebarHeader>
      <SidebarContent className="px-2 py-3"><SidebarGroup className="p-0"><SidebarGroupContent><SidebarMenu className="gap-1">{nav.map((item) => <SidebarMenuItem key={item.id}><SidebarMenuButton asChild tooltip={item.label} isActive={page === item.id} className="h-10 rounded-[10px] px-3 text-[14px] font-medium text-slate-600 data-[active=true]:bg-indigo-50 data-[active=true]:text-indigo-700"><a href={pageHref(item.id)} onClick={(event) => navigate(event, item.id)}><item.icon className="size-[18px]" /><span>{item.label}</span>{item.id === "alerts" && workspace.alerts.filter((alert) => !alert.is_resolved).length > 0 && <span className="ml-auto rounded-full bg-red-50 px-2 text-xs font-semibold text-red-600">{workspace.alerts.filter((alert) => !alert.is_resolved).length}</span>}</a></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
      <SidebarRail />
    </Sidebar>
    <SidebarInset className="min-w-0 bg-white">
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
        <SidebarTrigger className="size-9 rounded-lg border border-slate-200" />
        <div className="min-w-0 flex-1"><h1 className="truncate text-lg font-semibold text-slate-950">{pageTitle(page)}</h1></div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button asChild variant={page === "settings" ? "secondary" : "ghost"} size="sm" title="Cài đặt" className="gap-2"><a href={pageHref("settings")} onClick={(event) => navigate(event, "settings")}><Settings className="size-4" /><span className="hidden md:inline">Cài đặt</span></a></Button>
          <span className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{user.name.slice(0, 1).toUpperCase()}</span>
          <span className="hidden min-w-0 max-w-40 text-left sm:grid"><span className="truncate text-sm font-semibold text-slate-900">{user.name}</span><span className="text-xs text-slate-500">{roleLabel(user.role)}</span></span>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => void signOut()} title="Đăng xuất"><LogOut className="size-4" /></Button>
        </div>
      </header>
      <main className="min-h-[calc(100vh-64px)] w-full max-w-none bg-[#f8fafc] p-3 md:p-4 lg:p-5">{content}</main>
    </SidebarInset>
    <Toaster richColors position="bottom-right" />
  </SidebarProvider>;
}

function Title({ title, description }: { title: string; description: string }) { return <div><h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-36 place-items-center text-center text-sm text-slate-400">{text}</div>; }
function DataTable({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty?: boolean }) { return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><Table><TableHeader className="bg-slate-50"><TableRow>{headers.map((item) => <TableHead key={item}>{item}</TableHead>)}</TableRow></TableHeader><TableBody>{empty ? <TableRow><TableCell colSpan={headers.length}><Empty text="Chưa có dữ liệu." /></TableCell></TableRow> : children}</TableBody></Table></div>; }

function ProfilesView({ data }: { data: WorkspaceData }) { return <div className="space-y-4"><Title title="Hồ sơ trình duyệt" description="Theo dõi môi trường trình duyệt tách biệt và nhãn IP." /><DataTable empty={!data.browserProfiles.length} headers={["Tên hồ sơ", "Nhãn IP", "Quốc gia", "Trạng thái", "Ghi chú"]}>{data.browserProfiles.map((item) => <TableRow key={item.id}><TableCell className="font-semibold">{item.name}</TableCell><TableCell className="font-mono text-xs">{item.ip_label ?? "—"}</TableCell><TableCell>{item.country ?? "—"}</TableCell><TableCell>{item.status}</TableCell><TableCell>{item.notes ?? "—"}</TableCell></TableRow>)}</DataTable></div>; }
function ResearchView({ data }: { data: WorkspaceData }) { return <div className="space-y-4"><Title title="Nghiên cứu" description="Theo dõi kênh tham khảo và các video mới nhất." /><DataTable empty={!data.references.length} headers={["Kênh tham khảo", "Chủ đề", "Người đăng ký", "Lượt xem", "Video", "Đồng bộ"]}>{data.references.map((item) => <TableRow key={item.id}><TableCell><a href={item.youtube_url} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600">{item.name}</a></TableCell><TableCell>{item.niche?.name ?? "Chưa phân loại"}</TableCell><TableCell>{compactNumber(item.subscriber_count)}</TableCell><TableCell>{compactNumber(item.view_count)}</TableCell><TableCell>{item.video_count.toLocaleString("vi-VN")}</TableCell><TableCell>{relativeDate(item.last_synced_at)}</TableCell></TableRow>)}</DataTable>{data.recentVideos.length > 0 && <div><h3 className="mb-3 font-semibold">Video mới ghi nhận</h3><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.recentVideos.slice(0, 9).map((video) => <a key={video.id} href={`https://youtube.com/watch?v=${video.youtube_video_id}`} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-indigo-200">{video.thumbnail_url ? <img src={video.thumbnail_url} alt="" className="aspect-video w-full object-cover" /> : <div className="grid aspect-video place-items-center bg-slate-100"><Youtube /></div>}<div className="p-4"><h4 className="line-clamp-2 font-semibold">{video.title}</h4><p className="mt-2 text-sm text-slate-500">{compactNumber(video.view_count)} lượt xem · {relativeDate(video.published_at)}</p></div></a>)}</div></div>}</div>; }
function ContentView({ data }: { data: WorkspaceData }) { const stages = [["idea","Ý tưởng"],["script","Kịch bản"],["voice","Lồng tiếng"],["editing","Dựng video"],["thumbnail","Ảnh bìa"],["scheduled","Đã lên lịch"],["published","Đã xuất bản"]]; return <div className="space-y-4"><Title title="Quy trình nội dung" description="Theo dõi tiến độ từ ý tưởng đến xuất bản." /><div className="flex gap-3 overflow-x-auto pb-4">{stages.map(([value,label]) => <section key={value} className="w-[280px] shrink-0"><div className="mb-2 flex justify-between px-1"><h3 className="text-sm font-semibold">{label}</h3><span className="rounded-full bg-slate-200 px-2 text-xs">{data.contentTasks.filter((item) => item.stage === value).length}</span></div><div className="min-h-72 space-y-2 rounded-xl bg-slate-100 p-2">{data.contentTasks.filter((item) => item.stage === value).map((item) => <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"><h4 className="text-sm font-semibold">{item.title}</h4><p className="mt-1 text-xs text-slate-500">{item.channel?.name ?? "Chưa gán kênh"}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-indigo-500" style={{ width: `${item.progress}%` }} /></div></article>)}</div></section>)}</div></div>; }
function AlertsView({ data }: { data: WorkspaceData }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(data.alerts);
  const [busyId, setBusyId] = useState<string | null>(null);
  const handleAlert = async (item: WorkspaceData["alerts"][number]) => {
    const publishReminder = item.type.startsWith("publish_schedule:");
    setBusyId(item.id);
    try {
      const endpoint = publishReminder && item.channel_id ? `/api/channels/${item.channel_id}/publishing-plan/complete` : `/api/alerts/${item.id}/resolve`;
      const response = await fetch(endpoint, { method: "POST" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Không thể cập nhật cảnh báo.");
      setAlerts((items) => items.map((alert) => alert.id === item.id ? { ...alert, is_resolved: true } : alert));
      toast.success(publishReminder ? "Đã ghi nhận video và chuyển sang lịch kế tiếp." : "Đã xử lý cảnh báo.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật cảnh báo.");
    } finally {
      setBusyId(null);
    }
  };
  return <div className="space-y-4"><Title title="Trung tâm cảnh báo" description="Theo dõi lịch đăng, rủi ro và bất thường trong mạng lưới." /><div className="overflow-hidden rounded-xl border border-slate-200 bg-white">{alerts.length ? alerts.map((item) => { const publishReminder = item.type.startsWith("publish_schedule:"); const Icon = publishReminder ? CalendarClock : AlertTriangle; return <div key={item.id} className={`flex items-center gap-3 border-b border-slate-100 p-4 ${item.is_resolved ? "opacity-50" : ""}`}><span className={`grid size-10 place-items-center rounded-xl ${item.severity === "critical" ? "bg-red-50 text-red-600" : publishReminder ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"}`}><Icon className="size-5" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{item.channel?.name ?? item.title}</p><p className="text-sm text-slate-500">{item.message}</p></div>{!item.is_resolved && <Button size="sm" variant="outline" onClick={() => void handleAlert(item)} disabled={busyId === item.id}>{busyId === item.id && <LoaderCircle className="animate-spin" />}{publishReminder ? "Đã đăng" : "Đánh dấu đã xử lý"}</Button>}</div>; }) : <Empty text="Không có cảnh báo." />}</div></div>;
}
function SettingsView() { return <div className="space-y-4"><Title title="Cài đặt" description="Thông tin bảo mật và kết nối dữ liệu." /><div className="rounded-xl border border-slate-200 bg-white p-5"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck /></span><h3 className="mt-4 font-semibold">Bảo mật dữ liệu</h3><p className="mt-1 text-sm leading-6 text-slate-500">Dữ liệu được bảo vệ bằng Supabase Auth và RLS. Secret key và YouTube API key chỉ được dùng ở phía server.</p></div></div>; }
function roleLabel(role: UserRole) { return role === "admin" ? "Quản trị viên" : role === "manager" ? "Quản lý" : "Người xem"; }
function pageTitle(page: PageId) { return nav.find((item) => item.id === page)?.label ?? "Cài đặt"; }
