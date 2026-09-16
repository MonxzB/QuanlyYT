"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { CirclePlay, ExternalLink, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Niche } from "@/types/domain";
import type { ReferenceChannel } from "@/services/workspace";
import { compactNumber, relativeDate } from "./format";

export function ReferencesLive({ initial, niches, canManage }: { initial: ReferenceChannel[]; niches: Niche[]; canManage: boolean }) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [loading, setLoading] = useState(false);
  const refresh = async () => {
    const response = await fetch("/api/reference-channels");
    const body = await response.json() as { data?: ReferenceChannel[] };
    if (response.ok && body.data) setItems(body.data);
  };
  const create = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/reference-channels", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ youtubeUrl: url, nicheId: nicheId || null }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Không thể thêm kênh tham khảo.");
      toast.success("Đã thêm kênh tham khảo.");
      setOpen(false); setUrl(""); setNicheId(""); await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể thêm kênh tham khảo."); }
    finally { setLoading(false); }
  };
  const sync = async (id: string) => {
    const toastId = toast.loading("Đang đồng bộ kênh tham khảo…");
    try {
      const response = await fetch(`/api/reference-channels/${id}/sync`, { method: "POST" });
      const body = await response.json() as { data?: { syncedVideos: number }; error?: string };
      if (!response.ok) throw new Error(body.error || "Đồng bộ thất bại.");
      toast.success(`Đã đồng bộ ${body.data?.syncedVideos ?? 0} video.`, { id: toastId });
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Đồng bộ thất bại.", { id: toastId }); }
  };
  return <div className="space-y-4"><div className="flex items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight text-slate-950">Nghiên cứu</h2><p className="mt-1 text-sm text-slate-500">Theo dõi các kênh tham khảo và thư viện video công khai.</p></div>{canManage && <Button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700"><Plus /> Thêm kênh tham khảo</Button>}</div><div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Kênh tham khảo</TableHead><TableHead>Chủ đề</TableHead><TableHead>Người đăng ký</TableHead><TableHead>Lượt xem</TableHead><TableHead>Video</TableHead><TableHead>Lần đồng bộ</TableHead><TableHead /></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell><div className="flex items-center gap-3">{item.avatar_url ? <img src={item.avatar_url} alt="" className="size-9 rounded-lg object-cover" /> : <span className="grid size-9 place-items-center rounded-lg bg-red-50 text-red-600"><CirclePlay /></span>}<strong>{item.name}</strong></div></TableCell><TableCell>{item.niche?.name ?? "Chưa phân loại"}</TableCell><TableCell>{compactNumber(item.subscriber_count)}</TableCell><TableCell>{compactNumber(item.view_count)}</TableCell><TableCell>{item.video_count.toLocaleString("vi-VN")}</TableCell><TableCell>{relativeDate(item.last_synced_at)}</TableCell><TableCell><div className="flex justify-end">{canManage && <Button variant="ghost" size="icon-sm" onClick={() => void sync(item.id)}><RefreshCw className="size-4" /></Button>}<Button asChild variant="ghost" size="icon-sm"><a href={item.youtube_url} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a></Button></div></TableCell></TableRow>)}{!items.length && <TableRow><TableCell colSpan={7} className="h-40 text-center text-slate-400">Chưa có kênh tham khảo.</TableCell></TableRow>}</TableBody></Table></div><Sheet open={open} onOpenChange={setOpen}><SheetContent className="w-full sm:max-w-lg"><SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle>Thêm kênh tham khảo</SheetTitle><SheetDescription>ChannelOS sẽ xác minh URL và lấy dữ liệu công khai từ YouTube.</SheetDescription></SheetHeader><div className="space-y-4 px-6 py-5"><label className="block"><span className="mb-1.5 block text-sm font-medium">URL kênh YouTube</span><input value={url} onChange={(event) => setUrl(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300" placeholder="https://youtube.com/@kenhthamkhao" /></label><label className="block"><span className="mb-1.5 block text-sm font-medium">Chủ đề</span><select value={nicheId} onChange={(event) => setNicheId(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"><option value="">Chưa phân loại</option>{niches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div><SheetFooter className="border-t border-slate-200 px-6 py-4"><Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button disabled={loading || !url} onClick={() => void create()}>{loading && <LoaderCircle className="animate-spin" />} Thêm kênh</Button></SheetFooter></SheetContent></Sheet></div>;
}
