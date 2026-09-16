"use client";

import { AlertTriangle, Activity, ChevronRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { DashboardData } from "@/types/domain";
import { compactNumber, statusLabels } from "./format";

const colors: Record<string, string> = { active: "#22c55e", warm_up: "#f59e0b", paused: "#94a3b8", warning: "#f97316", dead: "#3f3f46", setup: "#6366f1", purchased: "#0ea5e9", suspended: "#ef4444" };

export function DashboardLive({ data, onNavigate }: { data: DashboardData; onNavigate: (page: string) => void }) {
  const cards = [
    ["Tổng số kênh", data.totalChannels, "Toàn bộ mạng lưới", "#6366f1"],
    ["Đang hoạt động", data.activeChannels, "Đang xuất bản nội dung", "#22c55e"],
    ["Đang nuôi", data.warmUpChannels, "Chuẩn bị vận hành", "#f59e0b"],
    ["Cảnh báo", data.warningChannels, "Cần được kiểm tra", "#f97316"],
    ["Ngừng hoạt động", data.deadChannels, "Đã dừng vận hành", "#3f3f46"],
  ] as const;
  const statusData = data.statusDistribution.map((item) => ({ name: statusLabels[item.status], value: item.count, color: colors[item.status] }));
  const chartData = data.metrics.map((item) => ({ ...item, day: new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(item.date)) }));
  return <div className="space-y-4">
    <div><h2 className="text-2xl font-semibold tracking-tight text-slate-950">Tổng quan mạng lưới</h2><p className="mt-1 text-sm text-slate-500">Theo dõi sức khỏe, tăng trưởng và các việc cần xử lý.</p></div>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">{cards.map(([label, value, helper, color]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className="size-2 rounded-full" style={{ backgroundColor: color }} /></div><p className="text-[28px] font-semibold leading-none text-slate-950">{value}</p><p className="mt-2 text-xs text-slate-500">{helper}</p></div>)}</section>
    <section className="grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
      <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">Tăng trưởng 30 ngày</h3><p className="mt-1 text-sm text-slate-500">Tổng lượt xem ghi nhận theo ngày</p>{chartData.length ? <ChartContainer config={{ views: { label: "Lượt xem", color: "#4f46e5" } }} className="mt-5 h-[260px] w-full aspect-auto"><AreaChart data={chartData}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="day" axisLine={false} tickLine={false} /><YAxis tickFormatter={compactNumber} axisLine={false} tickLine={false} width={55} /><ChartTooltip content={<ChartTooltipContent />} /><Area type="monotone" dataKey="views" stroke="#4f46e5" strokeWidth={2.5} fill="#eef2ff" /></AreaChart></ChartContainer> : <Empty text="Chưa có metrics. Hãy đồng bộ một kênh để bắt đầu." />}</div>
      <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">Trạng thái kênh</h3><p className="mt-1 text-sm text-slate-500">Phân bổ theo vòng đời</p>{statusData.length ? <><ChartContainer config={{ value: { label: "Kênh" } }} className="h-[190px] w-full aspect-auto"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={3} strokeWidth={0}>{statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><ChartTooltip content={<ChartTooltipContent nameKey="name" />} /></PieChart></ChartContainer><div className="space-y-2">{statusData.map((item) => <div key={item.name} className="flex items-center text-sm"><span className="mr-2 size-2.5 rounded-full" style={{ background: item.color }} /><span className="flex-1 text-slate-600">{item.name}</span><strong>{item.value}</strong></div>)}</div></> : <Empty text="Chưa có kênh." />}</div>
    </section>
    <section className="grid gap-4 lg:grid-cols-2">
      <Panel title="Cảnh báo gần đây" action={<button onClick={() => onNavigate("alerts")} className="flex items-center text-sm font-medium text-indigo-600">Xem tất cả <ChevronRight className="size-4" /></button>}>{data.recentAlerts.length ? data.recentAlerts.map((alert) => <div key={alert.id} className="flex items-start gap-3 border-t border-slate-100 px-5 py-3.5"><span className="mt-0.5 grid size-9 place-items-center rounded-lg bg-amber-50 text-amber-600"><AlertTriangle className="size-4" /></span><div><p className="text-sm font-semibold text-slate-900">{alert.channel?.name ?? "Hệ thống"}</p><p className="text-xs text-slate-500">{alert.message}</p></div></div>) : <Empty text="Không có cảnh báo đang mở." />}</Panel>
      <Panel title="Hoạt động gần đây" action={<Activity className="size-4 text-slate-400" />}>{data.recentActivities.length ? data.recentActivities.map((item) => <div key={item.id} className="border-t border-slate-100 px-5 py-3.5"><p className="text-sm font-medium text-slate-800">{item.action}</p><p className="text-xs text-slate-400">{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</p></div>) : <Empty text="Chưa có hoạt động." />}</Panel>
    </section>
  </div>;
}

function Panel({ title, action, children }: { title: string; action: React.ReactNode; children: React.ReactNode }) { return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between px-5 py-4"><h3 className="font-semibold text-slate-900">{title}</h3>{action}</div>{children}</div>; }
function Empty({ text }: { text: string }) { return <div className="grid min-h-32 place-items-center px-5 text-center text-sm text-slate-400">{text}</div>; }
