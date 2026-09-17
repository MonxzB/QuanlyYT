"use client";

import { useState } from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Niche } from "@/types/domain";

type NicheItem = Niche & { channelCount: number; referenceCount: number };

export function NichesLive({ initial, canManage, canDelete }: { initial: NicheItem[]; canManage: boolean; canDelete: boolean }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<NicheItem | null | undefined>(undefined);

  const remove = async (item: NicheItem) => {
    if (!window.confirm(`Xóa chủ đề “${item.name}”? Các kênh liên quan sẽ chuyển về chưa phân loại.`)) return;
    const response = await fetch(`/api/niches/${item.id}`, { method: "DELETE" });
    const body = await response.json() as { error?: string };
    if (!response.ok) return toast.error(body.error || "Không thể xóa chủ đề.");
    setItems((current) => current.filter((value) => value.id !== item.id));
    toast.success("Đã xóa chủ đề.");
  };

  return <div className="space-y-4">
    <div className="flex items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight text-slate-950">Chủ đề</h2><p className="mt-1 text-sm text-slate-500">Phân loại kênh vận hành và kênh tham khảo.</p></div>{canManage && <Button onClick={() => setEditing(null)}><Plus /> Thêm chủ đề</Button>}</div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-2"><span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white">{item.name[0]}</span>{canManage && <div className="flex"><Button variant="ghost" size="icon-sm" title="Chỉnh sửa" onClick={() => setEditing(item)}><Pencil /></Button>{canDelete && <Button variant="ghost" size="icon-sm" title="Xóa" className="text-red-600" onClick={() => void remove(item)}><Trash2 /></Button>}</div>}</div><h3 className="mt-4 text-lg font-semibold">{item.name}</h3><p className="mt-1 min-h-10 text-sm text-slate-500">{item.description ?? "Chưa có mô tả."}</p><div className="mt-4 grid grid-cols-2 border-t border-slate-100 pt-4"><div><p className="text-xs text-slate-400">Kênh vận hành</p><strong>{item.channelCount}</strong></div><div><p className="text-xs text-slate-400">Kênh tham khảo</p><strong>{item.referenceCount}</strong></div></div></div>)}{!items.length && <div className="col-span-full rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">Chưa có chủ đề.</div>}</div>
    {editing !== undefined && <NicheSheet item={editing} onOpenChange={(open) => { if (!open) setEditing(undefined); }} onSaved={(saved) => { setItems((current) => editing ? current.map((item) => item.id === saved.id ? { ...saved, channelCount: item.channelCount, referenceCount: item.referenceCount } : item) : [{ ...saved, channelCount: 0, referenceCount: 0 }, ...current]); setEditing(undefined); }} />}
  </div>;
}

function NicheSheet({ item, onOpenChange, onSaved }: { item: NicheItem | null; onOpenChange: (value: boolean) => void; onSaved: (item: Niche) => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    try {
      const response = await fetch(item ? `/api/niches/${item.id}` : "/api/niches", { method: item ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description: description || null }) });
      const body = await response.json() as { data?: Niche; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Không thể lưu chủ đề.");
      onSaved(body.data);
      toast.success(item ? "Đã cập nhật chủ đề." : "Đã thêm chủ đề.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu chủ đề.");
    } finally {
      setLoading(false);
    }
  };
  return <Sheet open onOpenChange={onOpenChange}><SheetContent className="w-full sm:max-w-lg"><SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle>{item ? "Chỉnh sửa chủ đề" : "Thêm chủ đề"}</SheetTitle><SheetDescription>Dùng chủ đề để nhóm kênh và dữ liệu nghiên cứu.</SheetDescription></SheetHeader><div className="space-y-4 px-6 py-5"><label className="block"><span className="mb-1.5 block text-sm font-medium">Tên chủ đề</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300" /></label><label className="block"><span className="mb-1.5 block text-sm font-medium">Mô tả</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={4} className="w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-indigo-300" /></label></div><SheetFooter className="border-t border-slate-200 px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button><Button disabled={loading || !name.trim()} onClick={() => void save()}>{loading && <LoaderCircle className="animate-spin" />} Lưu</Button></SheetFooter></SheetContent></Sheet>;
}
