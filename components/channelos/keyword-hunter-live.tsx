"use client";

import { useMemo, useState } from "react";
import { BarChart3, Copy, ExternalLink, KeyRound, LoaderCircle, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ChannelOption } from "@/services/channels";
import type { ChannelKeywordReport } from "@/services/keyword-hunter";
import { compactNumber } from "./format";

export function KeywordHunterLive({ channels }: { channels: ChannelOption[] }) {
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [report, setReport] = useState<ChannelKeywordReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const selected = channels.find((channel) => channel.id === channelId);
  const keywords = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("vi");
    return (report?.keywords ?? []).filter((item) => !search || item.keyword.toLocaleLowerCase("vi").includes(search));
  }, [query, report]);

  const analyze = async () => {
    if (!channelId || loading) return;
    setLoading(true);
    setReport(null);
    const toastId = toast.loading("Đang phân tích video và YouTube tags…");
    try {
      const response = await fetch(`/api/channels/${channelId}/keywords?limit=60`, { cache: "no-store" });
      const body = await response.json() as { data?: ChannelKeywordReport; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Không thể phân tích từ khóa.");
      setReport(body.data);
      if (!body.data.analyzedVideos) toast.warning("Kênh chưa có video đã đồng bộ. Hãy đồng bộ kênh trước.", { id: toastId });
      else toast.success(`Đã phân tích ${body.data.analyzedVideos} video.`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể phân tích từ khóa.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const copyKeyword = async (keyword: string) => {
    await navigator.clipboard.writeText(keyword);
    toast.success(`Đã sao chép “${keyword}”.`);
  };

  const topViews = report?.keywords.reduce((total, item) => Math.max(total, item.totalViews), 0) ?? 0;

  return <div className="space-y-4">
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-5 md:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl"><span className="mb-3 grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><KeyRound className="size-5" /></span><h2 className="text-2xl font-semibold tracking-tight text-slate-950">Săn từ khóa theo kênh</h2><p className="mt-1.5 text-sm leading-6 text-slate-500">Phân tích tiêu đề, YouTube tags, lượt xem và độ mới của video để tìm cụm từ đang tạo hiệu suất tốt cho từng kênh.</p></div>
          {report && <Button asChild variant="outline"><a href={report.channel.youtubeUrl} target="_blank" rel="noreferrer"><ExternalLink /> Mở kênh YouTube</a></Button>}
        </div>
      </div>
      <div className="grid gap-3 bg-slate-50/70 p-4 md:grid-cols-[minmax(260px,1fr)_auto] md:p-5">
        <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Chọn kênh cần săn key</span><select value={channelId} onChange={(event) => { setChannelId(event.target.value); setReport(null); setQuery(""); }} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"><option value="">Chọn một kênh…</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}{channel.custom_url ? ` · ${channel.custom_url}` : ""}</option>)}</select></label>
        <Button onClick={() => void analyze()} disabled={!channelId || loading} className="self-end bg-indigo-600 hover:bg-indigo-700 md:min-w-44">{loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {loading ? "Đang săn key…" : "Phân tích từ khóa"}</Button>
      </div>
    </section>

    {!report && <section className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-500"><BarChart3 /></span><h3 className="mt-4 font-semibold text-slate-900">Chọn một kênh để bắt đầu</h3><p className="mt-1 max-w-md text-sm leading-6 text-slate-500">Kết quả dùng dữ liệu video đã đồng bộ trong Supabase. Đồng bộ lại kênh để lấy thêm YouTube tags mới nhất.</p></div></section>}

    {report && <>
      <div className="grid gap-3 sm:grid-cols-3"><Stat label="Video đã phân tích" value={report.analyzedVideos.toLocaleString("vi-VN")} /><Stat label="Từ khóa tiềm năng" value={report.keywords.length.toLocaleString("vi-VN")} /><Stat label="Lượt xem nổi bật nhất" value={compactNumber(topViews)} /></div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center"><div><h3 className="font-semibold text-slate-950">Bảng xếp hạng từ khóa</h3><p className="mt-0.5 text-xs text-slate-500">Điểm 100 là cụm từ mạnh nhất trong tập video của {report.channel.name}.</p></div><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Lọc từ khóa…" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:bg-white" /></div></div>
        <div className="overflow-x-auto"><Table className="min-w-[860px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="w-14">#</TableHead><TableHead>Từ khóa</TableHead><TableHead className="w-52">Điểm tiềm năng</TableHead><TableHead className="w-28 text-right">Video</TableHead><TableHead className="w-32 text-right">Lượt xem</TableHead><TableHead className="w-36">Nguồn</TableHead><TableHead className="w-24" /></TableRow></TableHeader><TableBody>{keywords.map((item, index) => <TableRow key={item.keyword}><TableCell className="font-mono text-xs text-slate-400">{String(index + 1).padStart(2, "0")}</TableCell><TableCell><button type="button" onClick={() => void copyKeyword(item.keyword)} className="text-left font-semibold text-slate-900 hover:text-indigo-600 hover:underline">{item.keyword}</button>{item.recentVideos > 0 && <p className="mt-0.5 text-xs text-emerald-600">{item.recentVideos} video trong 90 ngày</p>}</TableCell><TableCell><div className="flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${item.score}%` }} /></div><span className="w-7 text-right text-xs font-semibold text-indigo-700">{item.score}</span></div></TableCell><TableCell className="text-right">{item.videoCount.toLocaleString("vi-VN")}</TableCell><TableCell className="text-right font-medium">{compactNumber(item.totalViews)}</TableCell><TableCell><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.source}</span></TableCell><TableCell><div className="flex justify-end"><Button type="button" variant="ghost" size="icon-sm" title="Sao chép" onClick={() => void copyKeyword(item.keyword)}><Copy /></Button><Button asChild variant="ghost" size="icon-sm"><a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(item.keyword)}`} target="_blank" rel="noreferrer" title="Tìm trên YouTube"><ExternalLink /></a></Button></div></TableCell></TableRow>)}{!keywords.length && <TableRow><TableCell colSpan={7} className="h-36 text-center text-sm text-slate-400">{report.analyzedVideos ? "Không tìm thấy từ khóa phù hợp." : "Chưa có video để phân tích. Hãy đồng bộ kênh trước."}</TableCell></TableRow>}</TableBody></Table></div>
      </section>
    </>}
    {selected && !report && <p className="text-center text-xs text-slate-400">Đã chọn: {selected.name}</p>}
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>;
}
