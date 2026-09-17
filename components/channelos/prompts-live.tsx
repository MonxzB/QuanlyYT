"use client";

import { useMemo, useState } from "react";
import { Copy, FileSpreadsheet, FileText, GripVertical, LoaderCircle, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parsePromptWorkbook } from "@/lib/import/prompt-workbook";
import type { Niche, Prompt } from "@/types/domain";
import type { PromptWorkbookImportResult, PromptWorkbookPreview } from "@/types/prompt-import";

type EditorState = { prompt: Prompt | null; nicheId: string | null };

export function PromptsLive({ initial, niches, canManage }: { initial: Prompt[]; niches: Niche[]; canManage: boolean }) {
  const [items, setItems] = useState(initial);
  const [nicheItems, setNicheItems] = useState(niches);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingNicheId, setDraggingNicheId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const visibleItems = useMemo(() => normalizedQuery
    ? items.filter((item) => `${item.title ?? ""}\n${item.content}`.toLocaleLowerCase("vi").includes(normalizedQuery))
    : items, [items, normalizedQuery]);
  const columns = useMemo(() => [
    ...nicheItems.map((niche) => ({ id: niche.id as string | null, name: niche.name })),
    { id: null, name: "Chưa phân loại" },
  ], [nicheItems]);

  const remove = async (prompt: Prompt) => {
    if (!window.confirm(`Xóa prompt${prompt.title ? ` “${prompt.title}”` : " này"}?`)) return;
    const response = await fetch(`/api/prompts/${prompt.id}`, { method: "DELETE" });
    const body = await response.json() as { error?: string };
    if (!response.ok) return toast.error(body.error || "Không thể xóa prompt.");
    setItems((current) => current.filter((item) => item.id !== prompt.id));
    toast.success("Đã xóa prompt.");
  };

  const copy = async (prompt: Prompt) => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      toast.success("Đã sao chép prompt.");
    } catch {
      toast.error("Không thể sao chép prompt.");
    }
  };

  const movePrompt = async (targetNicheId: string | null, targetId: string | null = null) => {
    if (!draggingId || draggingId === targetId || normalizedQuery) return;
    const previous = items;
    const dragged = previous.find((item) => item.id === draggingId);
    if (!dragged) return;
    const sourceNicheId = dragged.niche_id;
    const ordered = (nicheId: string | null) => previous.filter((item) => item.niche_id === nicheId && item.id !== dragged.id).sort((left, right) => left.sort_order - right.sort_order);
    const destination = ordered(targetNicheId);
    const targetIndex = targetId ? destination.findIndex((item) => item.id === targetId) : destination.length;
    destination.splice(targetIndex < 0 ? destination.length : targetIndex, 0, { ...dragged, niche_id: targetNicheId });
    const affected = sourceNicheId === targetNicheId
      ? destination.map((item, index) => ({ ...item, sort_order: index }))
      : [...ordered(sourceNicheId).map((item, index) => ({ ...item, sort_order: index })), ...destination.map((item, index) => ({ ...item, sort_order: index }))];
    const updates = new Map(affected.map((item) => [item.id, item]));
    setItems((current) => current.map((item) => updates.get(item.id) ?? item));
    setDraggingId(null);
    try {
      const response = await fetch("/api/prompts/reorder", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: affected.map((item) => ({ id: item.id, nicheId: item.niche_id, sortOrder: item.sort_order })) }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Không thể lưu thứ tự prompt.");
    } catch (error) {
      setItems(previous);
      toast.error(error instanceof Error ? error.message : "Không thể lưu thứ tự prompt.");
    }
  };

  const moveNiche = async (targetId: string | null) => {
    if (!draggingNicheId || draggingNicheId === targetId) return;
    const previous = nicheItems;
    const reordered = [...previous];
    const from = reordered.findIndex((item) => item.id === draggingNicheId);
    if (from < 0) return;
    const [moved] = reordered.splice(from, 1);
    const targetIndex = targetId ? reordered.findIndex((item) => item.id === targetId) : reordered.length;
    reordered.splice(targetIndex < 0 ? reordered.length : targetIndex, 0, moved);
    const ordered = reordered.map((item, index) => ({ ...item, sort_order: index }));
    setNicheItems(ordered);
    setDraggingNicheId(null);
    try {
      const response = await fetch("/api/niches/reorder", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: ordered.map((item) => item.id) }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Không thể lưu thứ tự chủ đề.");
    } catch (error) {
      setNicheItems(previous);
      toast.error(error instanceof Error ? error.message : "Không thể lưu thứ tự chủ đề.");
    }
  };

  return <div className="space-y-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-semibold tracking-tight text-slate-950">Prompt theo chủ đề</h2><p className="mt-1 text-sm text-slate-500">Kéo thẻ để đổi thứ tự hoặc chuyển chủ đề; kéo tiêu đề cột để sắp xếp chủ đề.</p></div>{canManage && <div className="flex gap-2"><Button variant="outline" onClick={() => setImportOpen(true)}><FileSpreadsheet /> Nhập Excel</Button><Button onClick={() => setEditor({ prompt: null, nicheId: nicheItems[0]?.id ?? null })} className="bg-indigo-600 hover:bg-indigo-700"><Plus /> Thêm prompt</Button></div>}</div>
    <div className="relative rounded-xl border border-slate-200 bg-white p-3"><Search className="absolute left-6 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm trong tiêu đề hoặc nội dung prompt…" className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-indigo-300 focus:bg-white" /></div>
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const prompts = visibleItems.filter((item) => item.niche_id === column.id).sort((left, right) => left.sort_order - right.sort_order);
        return <section key={column.id ?? "unclassified"} onDragOver={(event) => { if (canManage && (draggingNicheId || !normalizedQuery)) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); if (draggingNicheId) void moveNiche(column.id); else void movePrompt(column.id); }} className={`w-[320px] shrink-0 overflow-hidden rounded-xl border bg-slate-100/70 transition ${draggingNicheId === column.id ? "border-indigo-400 opacity-50" : "border-slate-200"}`}>
          <header className="flex min-h-14 items-center justify-between gap-3 bg-indigo-600 px-3 py-3 text-white"><div className="flex min-w-0 items-center gap-2">{canManage && column.id && <span draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", `niche:${column.id}`); setDraggingId(null); setDraggingNicheId(column.id); }} onDragEnd={() => setDraggingNicheId(null)} title="Kéo để sắp xếp chủ đề" className="grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-indigo-100 hover:bg-white/15 hover:text-white active:cursor-grabbing"><GripVertical className="size-4" /></span>}<div className="min-w-0"><h3 className="truncate font-semibold">{column.name}</h3><p className="text-xs text-indigo-100">{prompts.length} prompt</p></div></div>{canManage && <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditor({ prompt: null, nicheId: column.id })} title={`Thêm prompt cho ${column.name}`} className="shrink-0 text-white hover:bg-white/15 hover:text-white"><Plus className="size-4" /></Button>}</header>
          <div className="min-h-56 space-y-2 p-2">{prompts.map((prompt) => <article key={prompt.id} draggable={canManage && !normalizedQuery} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", prompt.id); setDraggingNicheId(null); setDraggingId(prompt.id); }} onDragEnd={() => setDraggingId(null)} onDragOver={(event) => { if (canManage && (draggingNicheId || !normalizedQuery)) event.preventDefault(); }} onDrop={(event) => { if (draggingNicheId) return; event.preventDefault(); event.stopPropagation(); void movePrompt(column.id, prompt.id); }} onDoubleClick={() => { if (canManage) setEditor({ prompt, nicheId: prompt.niche_id }); }} title={normalizedQuery ? "Xóa tìm kiếm để kéo thả" : canManage ? "Kéo để sắp xếp hoặc chuyển chủ đề" : undefined} className={`group rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-200 hover:shadow-md ${canManage && !normalizedQuery ? "cursor-grab active:cursor-grabbing" : ""} ${draggingId === prompt.id ? "opacity-40" : ""}`}><div className="flex items-start gap-2"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><FileText className="size-3.5" /></span><div className="min-w-0 flex-1">{prompt.title && <h4 className="mb-1 font-semibold text-slate-900">{prompt.title}</h4>}<p className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{prompt.content}</p></div></div><div className="mt-2 flex justify-end border-t border-slate-100 pt-2 opacity-60 transition group-hover:opacity-100"><Button type="button" variant="ghost" size="icon-sm" title="Sao chép" onClick={() => void copy(prompt)}><Copy className="size-4" /></Button>{canManage && <><Button type="button" variant="ghost" size="icon-sm" title="Chỉnh sửa" onClick={() => setEditor({ prompt, nicheId: prompt.niche_id })}><Pencil className="size-4" /></Button><Button type="button" variant="ghost" size="icon-sm" title="Xóa" className="text-red-600 hover:text-red-700" onClick={() => void remove(prompt)}><Trash2 className="size-4" /></Button></>}</div></article>)}{!prompts.length && <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-slate-300 bg-white/60 px-4 text-center text-sm text-slate-400">{normalizedQuery ? "Không có prompt phù hợp." : "Kéo prompt vào đây hoặc thêm prompt mới."}</div>}</div>
        </section>;
      })}
    </div>
    {editor && <PromptSheet state={editor} niches={nicheItems} onOpenChange={(open) => { if (!open) setEditor(null); }} onSaved={(saved) => { setItems((current) => editor.prompt ? current.map((item) => item.id === saved.id ? saved : item) : [...current, saved]); setEditor(null); }} />}
    <PromptImportSheet open={importOpen} onOpenChange={setImportOpen} onImported={(result) => { setItems((current) => [...current, ...result.prompts.filter((prompt) => !current.some((item) => item.id === prompt.id))]); setNicheItems((current) => [...current, ...result.niches.filter((niche) => !current.some((item) => item.id === niche.id))]); }} />
  </div>;
}

function PromptImportSheet({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (open: boolean) => void; onImported: (result: PromptWorkbookImportResult) => void }) {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<PromptWorkbookPreview | null>(null);
  const [result, setResult] = useState<PromptWorkbookImportResult | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const reset = () => { setFileName(""); setPreview(null); setResult(null); };
  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setResult(null);
    try {
      const parsed = await parsePromptWorkbook(file);
      setFileName(file.name);
      setPreview(parsed);
    } catch (error) {
      setFileName("");
      setPreview(null);
      toast.error(error instanceof Error ? error.message : "Không thể đọc file Excel.");
    } finally {
      setReading(false);
    }
  };
  const runImport = async () => {
    if (!preview) return;
    setImporting(true);
    const toastId = toast.loading("Đang nhập prompt từ Excel…");
    try {
      const response = await fetch("/api/imports/prompt-workbook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rows: preview.rows }) });
      const body = await response.json() as { data?: PromptWorkbookImportResult; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Không thể import prompt.");
      setResult(body.data);
      onImported(body.data);
      toast.success(`Đã thêm ${body.data.created} prompt.`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể import prompt.", { id: toastId });
    } finally {
      setImporting(false);
    }
  };
  const topicCount = preview ? new Set(preview.rows.map((row) => row.nicheName.toLocaleLowerCase("vi"))).size : 0;
  return <Sheet open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}><SheetContent className="w-full overflow-y-auto sm:max-w-3xl"><SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle>Nhập prompt từ Excel</SheetTitle><SheetDescription>Hỗ trợ dạng mỗi cột là một chủ đề như ảnh, hoặc bảng Chủ đề | Tiêu đề | Prompt.</SheetDescription></SheetHeader><div className="space-y-5 px-6 py-5"><label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 transition hover:border-indigo-300 hover:bg-indigo-50/40"><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={reading || importing} onChange={(event) => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }} /><span className="grid size-11 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm">{reading ? <LoaderCircle className="animate-spin" /> : <Upload />}</span><span><span className="block text-sm font-semibold">{fileName || "Chọn file .xlsx"}</span><span className="mt-1 block text-xs text-slate-500">Tối đa 10 MB · tối đa 1.000 prompt</span></span></label>{preview && <><div className="grid grid-cols-3 gap-3"><ImportStat label="Sheet" value={preview.sheetName} /><ImportStat label="Chủ đề" value={topicCount.toLocaleString("vi-VN")} /><ImportStat label="Prompt" value={preview.rows.length.toLocaleString("vi-VN")} /></div><div className="overflow-hidden rounded-xl border border-slate-200"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Ô</TableHead><TableHead>Chủ đề</TableHead><TableHead>Nội dung</TableHead></TableRow></TableHeader><TableBody>{preview.rows.slice(0, 8).map((row) => <TableRow key={`${row.sourceCell}-${row.nicheName}`}><TableCell>{row.sourceCell}</TableCell><TableCell className="font-medium">{row.nicheName}</TableCell><TableCell><p className="max-w-lg truncate">{row.content}</p></TableCell></TableRow>)}</TableBody></Table>{preview.rows.length > 8 && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Còn {preview.rows.length - 8} prompt khác.</p>}</div>{preview.warnings.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{preview.warnings.slice(0, 5).map((warning) => <p key={warning}>• {warning}</p>)}</div>}</>}{result && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-900">Import hoàn tất</p><p className="mt-1 text-sm text-emerald-800">{result.created} prompt mới · {result.skipped} prompt trùng đã bỏ qua · {result.nichesCreated} chủ đề mới.</p></div>}</div><SheetFooter className="border-t border-slate-200 px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>{result ? "Đóng" : "Hủy"}</Button>{preview && !result && <Button onClick={() => void runImport()} disabled={importing} className="bg-indigo-600 hover:bg-indigo-700">{importing && <LoaderCircle className="animate-spin" />} Nhập prompt</Button>}</SheetFooter></SheetContent></Sheet>;
}

function ImportStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 truncate font-semibold text-slate-900">{value}</p></div>;
}

function PromptSheet({ state, niches, onOpenChange, onSaved }: { state: EditorState; niches: Niche[]; onOpenChange: (open: boolean) => void; onSaved: (prompt: Prompt) => void }) {
  const [nicheId, setNicheId] = useState(state.nicheId ?? "");
  const [title, setTitle] = useState(state.prompt?.title ?? "");
  const [content, setContent] = useState(state.prompt?.content ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const response = await fetch(state.prompt ? `/api/prompts/${state.prompt.id}` : "/api/prompts", {
        method: state.prompt ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nicheId: nicheId || null, title: title.trim() || null, content: content.trim() }),
      });
      const body = await response.json() as { data?: Prompt; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Không thể lưu prompt.");
      onSaved(body.data);
      toast.success(state.prompt ? "Đã cập nhật prompt." : "Đã thêm prompt.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu prompt.");
    } finally {
      setSaving(false);
    }
  };
  return <Sheet open onOpenChange={onOpenChange}><SheetContent className="w-full overflow-y-auto sm:max-w-2xl"><SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle>{state.prompt ? "Chỉnh sửa prompt" : "Thêm prompt"}</SheetTitle><SheetDescription>Prompt sẽ xuất hiện trong cột của chủ đề đã chọn.</SheetDescription></SheetHeader><div className="space-y-4 px-6 py-5"><label className="block"><span className="mb-1.5 block text-sm font-medium">Chủ đề</span><select value={nicheId} onChange={(event) => setNicheId(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Chưa phân loại</option>{niches.map((niche) => <option key={niche.id} value={niche.id}>{niche.name}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-sm font-medium">Tiêu đề <span className="font-normal text-slate-400">(không bắt buộc)</span></span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} placeholder="Ví dụ: Viết kịch bản từ thumbnail" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300" /></label><label className="block"><span className="mb-1.5 flex items-center justify-between text-sm font-medium"><span>Nội dung prompt *</span><span className="text-xs font-normal text-slate-400">{content.length.toLocaleString("vi-VN")}/20.000</span></span><textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={20000} rows={16} placeholder="Nhập nội dung prompt…" className="w-full resize-y rounded-lg border border-slate-200 p-3 font-mono text-sm leading-6 outline-none focus:border-indigo-300" /></label></div><SheetFooter className="border-t border-slate-200 px-6 py-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button><Button type="button" disabled={saving || !content.trim()} onClick={() => void save()} className="bg-indigo-600 hover:bg-indigo-700">{saving && <LoaderCircle className="animate-spin" />} Lưu prompt</Button></SheetFooter></SheetContent></Sheet>;
}
