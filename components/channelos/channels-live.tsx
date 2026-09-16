"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { CirclePlay as Youtube, ExternalLink, LoaderCircle, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Channel, ChannelStatus, Niche, Paginated } from "@/types/domain";
import { compactNumber, healthLabels, relativeDate, statusLabels } from "./format";

type Preview = {
  id: string; title: string; description: string; customUrl: string | null; avatarUrl: string | null;
  country: string | null; subscriberCount: number; viewCount: number; videoCount: number; uploadsPlaylistId: string;
};

export function ChannelsLive({ initial, niches, canManage }: { initial: Paginated<Channel>; niches: Niche[]; canManage: boolean }) {
  const [result, setResult] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const fetchPage = async (page = 1, search = query, selectedStatus = status) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(result.pageSize) });
      if (search) params.set("search", search);
      if (selectedStatus) params.set("status", selectedStatus);
      const response = await fetch(`/api/channels?${params}`);
      const body = await response.json() as Paginated<Channel> & { error?: string };
      if (!response.ok) throw new Error(body.error);
      setResult(body);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể tải danh sách kênh."); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    const id = setTimeout(() => void fetchPage(1), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status]);
  const statuses = useMemo(() => Object.entries(statusLabels) as Array<[ChannelStatus, string]>, []);
  const sync = async (id: string) => {
    const toastId = toast.loading("Đang đồng bộ dữ liệu YouTube…");
    try {
      const response = await fetch(`/api/channels/${id}/sync`, { method: "POST" });
      const body = await response.json() as { data: { syncedVideos: number }; error?: string };
      if (!response.ok) throw new Error(body.error);
      toast.success(`Đã đồng bộ ${body.data.syncedVideos} video.`, { id: toastId });
      await fetchPage(result.page);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Đồng bộ thất bại.", { id: toastId }); }
  };
  return <div className="space-y-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-semibold tracking-tight text-slate-950">Kênh YouTube</h2><p className="mt-1 text-sm text-slate-500">Quản lý trạng thái, liên kết vận hành và dữ liệu YouTube thật.</p></div>{canManage && <Button onClick={() => setAddOpen(true)} className="bg-indigo-600 hover:bg-indigo-700"><Plus /> Thêm kênh</Button>}</div>
    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3"><div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, handle hoặc Channel ID…" className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:bg-white" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Tất cả trạng thái</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Kênh</TableHead><TableHead>Trạng thái</TableHead><TableHead>Chủ đề</TableHead><TableHead>Người đăng ký</TableHead><TableHead>Lượt xem</TableHead><TableHead>Video</TableHead><TableHead>Video gần nhất</TableHead><TableHead>Sức khỏe</TableHead><TableHead /></TableRow></TableHeader><TableBody>{result.data.map((channel) => <TableRow key={channel.id}><TableCell><div className="flex items-center gap-3">{channel.avatar_url ? <img src={channel.avatar_url} alt="" className="size-9 rounded-lg object-cover" /> : <span className="grid size-9 place-items-center rounded-lg bg-red-50 text-red-600"><Youtube className="size-5" /></span>}<div><p className="font-semibold text-slate-900">{channel.name}</p><p className="text-xs text-slate-400">{channel.custom_url ?? channel.youtube_channel_id}</p></div></div></TableCell><TableCell><Badge tone={channel.status}>{statusLabels[channel.status]}</Badge></TableCell><TableCell>{channel.niche?.name ?? "Chưa phân loại"}</TableCell><TableCell className="font-medium">{compactNumber(channel.subscriber_count)}</TableCell><TableCell>{compactNumber(channel.view_count)}</TableCell><TableCell>{channel.video_count.toLocaleString("vi-VN")}</TableCell><TableCell>{relativeDate(channel.last_video_at)}</TableCell><TableCell>{healthLabels[channel.health_status]}</TableCell><TableCell><div className="flex justify-end gap-1">{canManage && <Button onClick={() => void sync(channel.id)} variant="ghost" size="icon-sm" title="Đồng bộ"><RefreshCw className="size-4" /></Button>}<Button asChild variant="ghost" size="icon-sm"><a href={channel.youtube_url} target="_blank" rel="noreferrer" title="Mở trên YouTube"><ExternalLink className="size-4" /></a></Button></div></TableCell></TableRow>)}{!result.data.length && <TableRow><TableCell colSpan={9} className="h-40 text-center text-slate-400">{loading ? "Đang tải…" : "Chưa có kênh phù hợp."}</TableCell></TableRow>}</TableBody></Table></div>
    <div className="flex items-center justify-between text-sm text-slate-500"><span>{result.total.toLocaleString("vi-VN")} kênh</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={loading || result.page <= 1} onClick={() => void fetchPage(result.page - 1)}>Trang trước</Button><span>Trang {result.page}/{result.totalPages}</span><Button variant="outline" size="sm" disabled={loading || result.page >= result.totalPages} onClick={() => void fetchPage(result.page + 1)}>Trang sau</Button></div></div>
    <AddChannelSheet open={addOpen} onOpenChange={setAddOpen} niches={niches} onCreated={async () => { setAddOpen(false); await fetchPage(1); }} />
  </div>;
}

function AddChannelSheet({ open, onOpenChange, niches, onCreated }: { open: boolean; onOpenChange: (value: boolean) => void; niches: Niche[]; onCreated: () => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [status, setStatus] = useState<ChannelStatus>("setup");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const resolve = async () => {
    setLoading(true); setPreview(null);
    try {
      const response = await fetch("/api/youtube/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const body = await response.json() as { data: Preview; error?: string };
      if (!response.ok) throw new Error(body.error);
      setPreview(body.data);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể đọc kênh YouTube."); }
    finally { setLoading(false); }
  };
  const create = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/channels", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ youtubeUrl: url, nicheId: nicheId || null, status, notes: notes || null }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error);
      toast.success("Đã thêm kênh và lưu vào Supabase.");
      setUrl(""); setPreview(null); setNotes(""); setNicheId(""); await onCreated();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể thêm kênh."); }
    finally { setLoading(false); }
  };
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle>Thêm kênh YouTube</SheetTitle><SheetDescription>Dán URL kênh để xác minh bằng YouTube Data API trước khi lưu.</SheetDescription></SheetHeader><div className="space-y-5 px-6 py-5"><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">URL kênh</span><div className="flex gap-2"><input value={url} onChange={(event) => { setUrl(event.target.value); setPreview(null); }} placeholder="https://youtube.com/@tenkenh" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300" /><Button onClick={() => void resolve()} disabled={loading || !url}>{loading ? <LoaderCircle className="animate-spin" /> : "Kiểm tra"}</Button></div></label>{preview && <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4"><div className="flex gap-3">{preview.avatarUrl ? <img src={preview.avatarUrl} alt="" className="size-14 rounded-xl object-cover" /> : <span className="grid size-14 place-items-center rounded-xl bg-white text-red-600"><Youtube /></span>}<div><p className="font-semibold text-slate-950">{preview.title}</p><p className="text-xs text-slate-500">{preview.customUrl ?? preview.id}</p><p className="mt-2 text-sm text-slate-600">{compactNumber(preview.subscriberCount)} người đăng ký · {preview.videoCount.toLocaleString("vi-VN")} video</p></div></div></div>}<div className="grid grid-cols-2 gap-4"><label><span className="mb-1.5 block text-sm font-medium text-slate-700">Trạng thái</span><select value={status} onChange={(event) => setStatus(event.target.value as ChannelStatus)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">{(Object.entries(statusLabels) as Array<[ChannelStatus,string]>).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="mb-1.5 block text-sm font-medium text-slate-700">Chủ đề</span><select value={nicheId} onChange={(event) => setNicheId(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"><option value="">Chưa phân loại</option>{niches.map((niche) => <option key={niche.id} value={niche.id}>{niche.name}</option>)}</select></label></div><label><span className="mb-1.5 block text-sm font-medium text-slate-700">Ghi chú</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-indigo-300" placeholder="Thông tin vận hành, nguồn mua hoặc việc tiếp theo…" /></label><p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Không lưu mật khẩu, mã 2FA hoặc token bí mật trong ghi chú.</p></div><SheetFooter className="border-t border-slate-200 px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button><Button onClick={() => void create()} disabled={!preview || loading} className="bg-indigo-600 hover:bg-indigo-700">{loading && <LoaderCircle className="animate-spin" />} Thêm kênh</Button></SheetFooter></SheetContent></Sheet>;
}

function Badge({ children, tone }: { children: React.ReactNode; tone: string }) { const style = tone === "active" ? "bg-emerald-50 text-emerald-700" : tone === "warning" || tone === "suspended" ? "bg-amber-50 text-amber-700" : tone === "dead" ? "bg-slate-100 text-slate-600" : "bg-indigo-50 text-indigo-700"; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{children}</span>; }
