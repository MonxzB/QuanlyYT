"use client";

import { Activity, AlertTriangle, ChevronRight, CircleUserRound, SlidersHorizontal } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PageIntro } from "./shared";

const cards = [
  ["Total channels", "128", "+6 this month", "#6366f1"], ["Active", "72", "56.3% of network", "#22c55e"],
  ["Warm-up", "20", "8 ready this week", "#f59e0b"], ["Paused", "8", "2 need review", "#94a3b8"],
  ["Warning", "5", "3 new alerts", "#f97316"], ["Dead", "23", "18.0% of network", "#3f3f46"],
];
const statusData = [
  { name: "Active", value: 72, color: "#16a34a" }, { name: "Warm-up", value: 20, color: "#f59e0b" },
  { name: "Paused", value: 8, color: "#94a3b8" }, { name: "Warning", value: 5, color: "#f97316" }, { name: "Dead", value: 23, color: "#3f3f46" },
];
const growthData = [
  { day: "Aug 18", views: 430000 }, { day: "Aug 23", views: 512000 }, { day: "Aug 28", views: 498000 },
  { day: "Sep 02", views: 647000 }, { day: "Sep 07", views: 728000 }, { day: "Sep 12", views: 890000 }, { day: "Sep 16", views: 962000 },
];
const alerts = [
  ["History World", "No upload for 10 days", "warning", "18 min"], ["Fishing Lab", "Channel requires attention", "critical", "1 hr"], ["Defense Files", "Views increased 180% in 48 hours", "success", "3 hr"],
];
const activity = [
  ["Ancient Archive", "Status changed to Active", "10 min ago"], ["Fishing World", "Reference channel added", "48 min ago"],
  ["Roam Atlas", "Niche updated to Travel", "2 hours ago"], ["Ghibli Dreamscape", "Channel created", "Yesterday"],
];

export function DashboardPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  return <>
    <PageIntro title="Network overview" description="Monitor channel health, growth and actions across your workspace." action={<Button variant="outline" className="w-fit rounded-lg bg-white text-slate-700"><SlidersHorizontal /> Customize</Button>} />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">{cards.map(([label, value, helper, color]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.03)]"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><span className="size-2 rounded-full" style={{ backgroundColor: color }} /></div><p className="text-[28px] font-semibold leading-none tracking-[-0.04em] text-slate-950">{value}</p><p className="mt-2 text-xs text-slate-500">{helper}</p></div>)}</section>
    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
      <div className="rounded-xl border border-slate-200 bg-white p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Growth overview</h3><p className="mt-1 text-sm text-slate-500">Views and subscribers across all active channels</p></div><div className="flex rounded-lg bg-slate-100 p-1 text-xs font-medium"><button className="rounded-md px-3 py-1.5 text-slate-500">7D</button><button className="rounded-md bg-white px-3 py-1.5 text-slate-900 shadow-sm">30D</button><button className="rounded-md px-3 py-1.5 text-slate-500">90D</button></div></div><div className="mb-3 flex gap-6"><div><span className="text-xs text-slate-500">Total views</span><p className="text-xl font-semibold text-slate-900">4.24M <span className="text-xs text-emerald-600">+18.2%</span></p></div><div><span className="text-xs text-slate-500">Subscribers</span><p className="text-xl font-semibold text-slate-900">27.4K <span className="text-xs text-emerald-600">+9.6%</span></p></div></div><ChartContainer config={{ views: { label: "Views", color: "#4f46e5" } }} className="h-[250px] w-full aspect-auto"><AreaChart data={growthData} margin={{ left: 0, right: 8, top: 10 }}><defs><linearGradient id="growth" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f46e5" stopOpacity={0.18}/><stop offset="100%" stopColor="#4f46e5" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="day" axisLine={false} tickLine={false} tickMargin={10} /><YAxis hide /><ChartTooltip content={<ChartTooltipContent />} /><Area type="monotone" dataKey="views" stroke="#4f46e5" strokeWidth={2.5} fill="url(#growth)" /></AreaChart></ChartContainer></div>
      <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-slate-900">Channel status</h3><p className="mt-1 text-sm text-slate-500">Distribution across 128 channels</p><div className="mt-2 grid grid-cols-[160px_1fr] items-center gap-2 xl:grid-cols-1 2xl:grid-cols-[180px_1fr]"><ChartContainer config={{ value: { label: "Channels" } }} className="h-[190px] w-full aspect-auto"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={77} paddingAngle={3} strokeWidth={0}>{statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><ChartTooltip content={<ChartTooltipContent nameKey="name" />} /></PieChart></ChartContainer><div className="space-y-3">{statusData.map((item) => <div key={item.name} className="flex items-center text-sm"><span className="mr-2 size-2.5 rounded-full" style={{ background: item.color }} /><span className="flex-1 text-slate-600">{item.name}</span><span className="font-semibold text-slate-900">{item.value}</span></div>)}</div></div></div>
    </section>
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-semibold text-slate-900">Recent alerts</h3><p className="mt-0.5 text-sm text-slate-500">Items that need attention</p></div><button onClick={() => onNavigate("Alerts")} className="flex items-center gap-1 text-sm font-medium text-indigo-600">View all <ChevronRight className="size-4" /></button></div><div className="divide-y divide-slate-100">{alerts.map(([channel, text, tone, time]) => <button key={channel} onClick={() => onNavigate("Alerts")} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50"><span className={`grid size-9 place-items-center rounded-lg alert-${tone}`}><AlertTriangle className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{channel}</span><span className="block truncate text-xs text-slate-500">{text}</span></span><span className="text-xs text-slate-400">{time}</span></button>)}</div></div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="font-semibold text-slate-900">Recent activity</h3><p className="mt-0.5 text-sm text-slate-500">Latest changes in your workspace</p></div><Activity className="size-4 text-slate-400" /></div><div className="divide-y divide-slate-100">{activity.map(([channel, label, time]) => <div key={channel} className="flex items-center gap-3 px-5 py-3.5"><span className="grid size-9 place-items-center rounded-full bg-slate-100 text-slate-500"><CircleUserRound className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm text-slate-700"><strong className="font-semibold text-slate-900">{channel}</strong> · {label}</span><span className="text-xs text-slate-400">by Monz</span></span><span className="text-xs text-slate-400">{time}</span></div>)}</div></div>
    </section>
  </>;
}
