"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ChannelStatus } from "./data";

const statusStyles: Record<string, string> = {
  Purchased: "bg-violet-50 text-violet-700 ring-violet-200",
  Setup: "bg-blue-50 text-blue-700 ring-blue-200",
  "Warm-up": "bg-amber-50 text-amber-700 ring-amber-200",
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Paused: "bg-slate-100 text-slate-600 ring-slate-200",
  Warning: "bg-orange-50 text-orange-700 ring-orange-200",
  Suspended: "bg-red-50 text-red-700 ring-red-200",
  Dead: "bg-zinc-200 text-zinc-700 ring-zinc-300",
  Review: "bg-amber-50 text-amber-700 ring-amber-200",
  Critical: "bg-red-50 text-red-700 ring-red-200",
  Healthy: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Blocked: "bg-red-50 text-red-700 ring-red-200",
  Locked: "bg-red-50 text-red-700 ring-red-200",
};

export function StatusBadge({ status }: { status: ChannelStatus | string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusStyles[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}><span className="size-1.5 rounded-full bg-current opacity-75" />{status}</span>;
}

export function PageIntro({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{title}</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p></div>{action}</div>;
}

export function MiniTrend({ value }: { value: string }) {
  const down = value.startsWith("-"); const flat = value === "—";
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold ${down ? "text-red-600" : flat ? "text-slate-400" : "text-emerald-600"}`}>{down ? <ArrowDown className="size-3" /> : flat ? <Minus className="size-3" /> : <ArrowUp className="size-3" />}{value}</span>;
}

export function MetricCard({ label, value, helper, icon }: { label: string; value: string; helper: string; icon?: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.03)]"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p>{icon}</div><p className="mt-3 text-[28px] font-semibold leading-none tracking-[-0.04em] text-slate-950">{value}</p><p className="mt-2 text-xs text-slate-500">{helper}</p></div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 text-center"><div><div className="mx-auto mb-3 size-10 rounded-xl border border-slate-200 bg-white shadow-sm" /><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></div></div>;
}
