"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CirclePlay as Youtube, ExternalLink, Eye, EyeOff, FileSpreadsheet, GripVertical, LoaderCircle, Minus, Pencil, Plus, RefreshCw, Search, Trash2, TrendingDown, TrendingUp, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseYoutubeWorkbook } from "@/lib/import/youtube-workbook";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Account, Channel, ChannelStatus, Niche, Paginated } from "@/types/domain";
import type { YoutubeWorkbookImportResult, YoutubeWorkbookPreview } from "@/types/workbook-import";
import { AddAccountSheet } from "./accounts-live";
import { compactNumber, healthLabels, relativeDate, statusLabels } from "./format";

type Preview = {
  id: string; title: string; description: string; customUrl: string | null; avatarUrl: string | null;
  country: string | null; subscriberCount: number; viewCount: number; videoCount: number; uploadsPlaylistId: string;
};

type ChannelsLiveProps = {
  initial: Paginated<Channel>;
  niches: Niche[];
  accounts: Account[];
  linkedAccountIds: string[];
  canManage: boolean;
  canDelete: boolean;
};

type SortKey = "channel" | "email" | "recoveryEmail" | "phone" | "status" | "niche" | "subscribers" | "views" | "videos" | "lastVideo" | "health";
type SortDirection = "asc" | "desc";
type ChannelBoardRow = { kind: "channel"; channel: Channel } | { kind: "account"; account: Account };

export function ChannelsLive({ initial, niches, accounts, linkedAccountIds, canManage, canDelete }: ChannelsLiveProps) {
  const router = useRouter();
  const [result, setResult] = useState(initial);
  const [accountSortOrders, setAccountSortOrders] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [draggingRowKey, setDraggingRowKey] = useState<string | null>(null);
  const [pendingAccountId, setPendingAccountId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const fetchPage = async (page = 1, search = query, selectedStatus = status) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(result.pageSize) });
      if (search) params.set("search", search);
      if (selectedStatus) params.set("status", selectedStatus);
      const response = await fetch(`/api/channels?${params}`);
      const body = await response.json() as Paginated<Channel> & { error?: string };
      if (!response.ok) throw new Error(body.error || "Không thể tải danh sách kênh.");
      setResult(body);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải danh sách kênh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => void fetchPage(1), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status]);

  const statuses = useMemo(() => Object.entries(statusLabels) as Array<[ChannelStatus, string]>, []);
  const accountItems = useMemo(() => {
    return accounts.map((account) => ({ ...account, sort_order: accountSortOrders[account.id] ?? account.sort_order })).sort((left, right) => left.sort_order - right.sort_order);
  }, [accountSortOrders, accounts]);
  const allUnlinkedAccounts = useMemo(() => {
    const linked = new Set(linkedAccountIds);
    return accountItems.filter((account) => !linked.has(account.id));
  }, [accountItems, linkedAccountIds]);
  const unlinkedAccounts = useMemo(() => {
    if (result.page !== 1 || status) return [];
    const search = query.trim().toLowerCase();
    return allUnlinkedAccounts.filter((account) => !search || account.email.toLowerCase().includes(search));
  }, [allUnlinkedAccounts, query, result.page, status]);
  const displayRows = useMemo(() => {
    const rows: ChannelBoardRow[] = [
      ...result.data.map((channel) => ({ kind: "channel" as const, channel })),
      ...unlinkedAccounts.map((account) => ({ kind: "account" as const, account })),
    ];
    if (!sortKey) return rows.sort((left, right) => rowSortOrder(left) - rowSortOrder(right) || (left.kind === right.kind ? 0 : left.kind === "channel" ? -1 : 1));
    return sortItems(rows, (row) => row.kind === "channel" ? channelSortValue(row.channel, sortKey) : accountSortValue(row.account, sortKey), sortDirection);
  }, [result.data, sortDirection, sortKey, unlinkedAccounts]);
  const canReorder = canManage && !sortKey && !query && !status && result.page === 1;

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("asc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }
    setSortKey(null);
    setSortDirection("asc");
  };

  const sync = async (id: string) => {
    const toastId = toast.loading("Đang đồng bộ dữ liệu YouTube…");
    try {
      const response = await fetch(`/api/channels/${id}/sync`, { method: "POST" });
      const body = await response.json() as { data?: { syncedVideos: number }; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Đồng bộ thất bại.");
      toast.success(`Đã đồng bộ ${body.data.syncedVideos} video.`, { id: toastId });
      await fetchPage(result.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Đồng bộ thất bại.", { id: toastId });
    }
  };

  const syncAll = async () => {
    setSyncingAll(true);
    const toastId = toast.loading("Đang đồng bộ các kênh hoạt động…");
    try {
      const response = await fetch("/api/channels/sync-all", { method: "POST" });
      const body = await response.json() as { data?: { processed: number; succeeded: number; failed: number }; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Không thể đồng bộ tất cả kênh.");
      const message = body.data.failed
        ? `Đồng bộ xong ${body.data.succeeded}/${body.data.processed} kênh; ${body.data.failed} kênh lỗi.`
        : `Đã đồng bộ ${body.data.succeeded} kênh.`;
      if (body.data.failed) toast.warning(message, { id: toastId });
      else toast.success(message, { id: toastId });
      await fetchPage(result.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể đồng bộ tất cả kênh.", { id: toastId });
    } finally {
      setSyncingAll(false);
    }
  };

  const remove = async (channel: Channel) => {
    if (!window.confirm(`Xóa kênh “${channel.name}” và toàn bộ video, metrics, cảnh báo liên quan?`)) return;
    const toastId = toast.loading("Đang xóa kênh…");
    try {
      const response = await fetch(`/api/channels/${channel.id}`, { method: "DELETE" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Không thể xóa kênh.");
      toast.success("Đã xóa kênh.", { id: toastId });
      await fetchPage(result.data.length === 1 && result.page > 1 ? result.page - 1 : result.page);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể xóa kênh.", { id: toastId });
    }
  };

  const moveRow = async (targetKey: string) => {
    if (!draggingRowKey || draggingRowKey === targetKey || !canReorder) return;
    const previousChannels = result.data;
    const previousAccountOrders = accountSortOrders;
    const reordered = [...displayRows];
    const from = reordered.findIndex((row) => boardRowKey(row) === draggingRowKey);
    const to = reordered.findIndex((row) => boardRowKey(row) === targetKey);
    if (from < 0 || to < 0) return;
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const channelOrders = new Map<string, number>();
    const nextAccountOrders = { ...accountSortOrders };
    reordered.forEach((row, index) => {
      if (row.kind === "channel") channelOrders.set(row.channel.id, index);
      else nextAccountOrders[row.account.id] = index;
    });
    setResult((current) => ({ ...current, data: current.data.map((channel) => ({ ...channel, sort_order: channelOrders.get(channel.id) ?? channel.sort_order })) }));
    setAccountSortOrders(nextAccountOrders);
    setDraggingRowKey(null);
    try {
      const response = await fetch("/api/channel-rows/reorder", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: reordered.map((row) => ({ id: row.kind === "channel" ? row.channel.id : row.account.id, kind: row.kind })) }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Không thể lưu thứ tự danh sách.");
    } catch (error) {
      setResult((current) => ({ ...current, data: previousChannels }));
      setAccountSortOrders(previousAccountOrders);
      toast.error(error instanceof Error ? error.message : "Không thể lưu thứ tự danh sách.");
    }
  };

  return <div className="space-y-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><h2 className="text-2xl font-semibold tracking-tight text-slate-950">Kênh YouTube</h2><p className="mt-1 text-sm text-slate-500">Kéo biểu tượng bên trái để sắp xếp chung kênh và tài khoản chưa có kênh.</p></div>
      {canManage && <div className="flex flex-wrap gap-2">{canDelete && <Button variant="outline" onClick={() => void syncAll()} disabled={syncingAll}>{syncingAll ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Đồng bộ tất cả</Button>}<Button variant="outline" onClick={() => setImportOpen(true)}><FileSpreadsheet /> Nhập Excel</Button><Button variant="outline" onClick={() => setAddAccountOpen(true)}><Plus /> Thêm tài khoản</Button><Button onClick={() => { setPendingAccountId(""); setAddOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700"><Plus /> Thêm kênh</Button></div>}
    </div>
    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3"><div className="relative min-w-60 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên, handle hoặc Channel ID…" className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:bg-white" /></div><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Tất cả trạng thái</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{sortKey && <Button type="button" variant="ghost" onClick={() => { setSortKey(null); setSortDirection("asc"); }}>Bỏ sắp xếp</Button>}</div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><Table className="min-w-[2380px] table-fixed"><TableHeader className="bg-slate-50"><TableRow><TableHead className="w-10" /><SortableHead className="w-[260px]" column="channel" label="Kênh" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} /><SortableHead className="w-[220px]" column="email" label="Email" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} /><TableHead className="w-[200px]">Mật khẩu</TableHead><SortableHead className="w-[220px]" column="recoveryEmail" label="Email 2" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} /><TableHead className="w-[200px]">2FA</TableHead><SortableHead className="w-[160px]" column="phone" label="SĐT" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} /><SortableHead className="w-[160px]" column="status" label="Trạng thái" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} /><SortableHead className="w-[180px]" column="niche" label="Chủ đề" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} /><SortableHead className="w-[150px]" column="subscribers" label="Người đăng ký" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} /><SortableHead className="w-[140px]" column="views" label="Lượt xem" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} /><SortableHead className="w-[110px]" column="videos" label="Video" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} /><SortableHead className="w-[160px]" column="lastVideo" label="Video gần nhất" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} /><SortableHead className="w-[130px]" column="health" label="Sức khỏe" activeKey={sortKey} direction={sortDirection} onSort={toggleSort} /><TableHead className="w-[150px]" /></TableRow></TableHeader><TableBody>{displayRows.map((row) => row.kind === "channel" ? <ChannelDataRow key={row.channel.id} channel={row.channel} canManage={canManage} canDelete={canDelete} canDrag={canReorder} dragging={draggingRowKey === `channel:${row.channel.id}`} onDragStart={() => setDraggingRowKey(`channel:${row.channel.id}`)} onDragEnd={() => setDraggingRowKey(null)} onDrop={() => void moveRow(`channel:${row.channel.id}`)} onAccountSaved={() => fetchPage(result.page)} onStatusSaved={() => fetchPage(result.page)} onEdit={() => setEditing(row.channel)} onSync={() => void sync(row.channel.id)} onRemove={() => void remove(row.channel)} /> : <UnlinkedAccountRow key={`account-${row.account.id}`} account={row.account} canManage={canManage} canDrag={canReorder} dragging={draggingRowKey === `account:${row.account.id}`} onDragStart={() => setDraggingRowKey(`account:${row.account.id}`)} onDragEnd={() => setDraggingRowKey(null)} onDrop={() => void moveRow(`account:${row.account.id}`)} onAccountSaved={async () => { router.refresh(); }} onAddChannel={(accountId) => { setPendingAccountId(accountId); setAddOpen(true); }} />)}{!displayRows.length && <TableRow><TableCell colSpan={15} className="h-40 text-center text-slate-400">{loading ? "Đang tải…" : "Chưa có kênh phù hợp."}</TableCell></TableRow>}</TableBody></Table></div>
    <div className="flex items-center justify-between text-sm text-slate-500"><span>{result.total.toLocaleString("vi-VN")} kênh · {allUnlinkedAccounts.length.toLocaleString("vi-VN")} tài khoản chưa có kênh</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={loading || result.page <= 1} onClick={() => void fetchPage(result.page - 1)}>Trang trước</Button><span>Trang {result.page}/{result.totalPages}</span><Button variant="outline" size="sm" disabled={loading || result.page >= result.totalPages} onClick={() => void fetchPage(result.page + 1)}>Trang sau</Button></div></div>
    <AddChannelSheet key={pendingAccountId || "new-channel"} open={addOpen} onOpenChange={setAddOpen} niches={niches} accounts={accountItems} defaultAccountId={pendingAccountId} onCreated={async () => { setAddOpen(false); setPendingAccountId(""); await fetchPage(1); router.refresh(); }} />
    <AddAccountSheet open={addAccountOpen} onOpenChange={setAddAccountOpen} onCreated={() => { setAddAccountOpen(false); router.refresh(); }} />
    <ImportWorkbookSheet open={importOpen} onOpenChange={setImportOpen} onImported={async () => { await fetchPage(1); router.refresh(); }} />
    {editing && <EditChannelSheet channel={editing} niches={niches} accounts={accountItems} onOpenChange={(open) => { if (!open) setEditing(null); }} onSaved={async () => { setEditing(null); await fetchPage(result.page); }} />}
  </div>;
}

function ChannelDataRow({ channel, canManage, canDelete, canDrag, dragging, onDragStart, onDragEnd, onDrop, onAccountSaved, onStatusSaved, onEdit, onSync, onRemove }: { channel: Channel; canManage: boolean; canDelete: boolean; canDrag: boolean; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onDrop: () => void; onAccountSaved: () => Promise<void>; onStatusSaved: () => Promise<void>; onEdit: () => void; onSync: () => void; onRemove: () => void }) {
  return <TableRow onDragOver={(event) => { if (canDrag) event.preventDefault(); }} onDrop={() => { if (canDrag) onDrop(); }} className={dragging ? "opacity-50" : undefined}>
    <TableCell><span draggable={canDrag} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", channel.id); onDragStart(); }} onDragEnd={onDragEnd} title={canDrag ? "Kéo để đổi vị trí" : canManage ? "Bỏ tìm kiếm, bộ lọc hoặc sắp xếp cột để kéo thả" : undefined} className={canDrag ? "inline-flex cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing" : "text-slate-300"}><GripVertical className="size-4" /></span></TableCell>
    <TableCell className="overflow-hidden"><div className="flex min-w-0 items-center gap-3">{channel.avatar_url ? <img src={channel.avatar_url} alt="" className="size-9 shrink-0 rounded-lg object-cover" /> : <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600"><Youtube className="size-5" /></span>}<div className="min-w-0"><p className="truncate font-semibold text-slate-900" title={channel.name}>{channel.name}</p><p className="truncate text-xs text-slate-400" title={channel.custom_url ?? channel.youtube_channel_id}>{channel.custom_url ?? channel.youtube_channel_id}</p></div></div></TableCell>
    <TableCell><EditableAccountCell accountId={channel.account?.id} field="email" value={channel.account?.email ?? null} canEdit={canManage} onSaved={onAccountSaved} /></TableCell>
    <TableCell><SecretCell accountId={channel.account?.id} kind="password" hasSecret={Boolean(channel.account?.has_password)} canReveal={canManage} onSaved={onAccountSaved} /></TableCell>
    <TableCell><EditableAccountCell accountId={channel.account?.id} field="recoveryEmail" value={channel.account?.recovery_email ?? null} canEdit={canManage} onSaved={onAccountSaved} /></TableCell>
    <TableCell><SecretCell accountId={channel.account?.id} kind="twoFactorSecret" hasSecret={Boolean(channel.account?.two_factor_enabled)} canReveal={canManage} onSaved={onAccountSaved} /></TableCell>
    <TableCell><EditableAccountCell accountId={channel.account?.id} field="phone" value={channel.account?.phone ?? null} canEdit={canManage} onSaved={onAccountSaved} /></TableCell>
    <TableCell><InlineStatusSelect channel={channel} canEdit={canManage} onSaved={onStatusSaved} /></TableCell>
    <TableCell className="overflow-hidden"><span className="block truncate" title={channel.niche?.name ?? "Chưa phân loại"}>{channel.niche?.name ?? "Chưa phân loại"}</span></TableCell>
    <TableCell className="font-medium"><MetricTrend value={channel.subscriber_count} change={channel.subscriber_change ?? 0} /></TableCell>
    <TableCell><MetricTrend value={channel.view_count} change={channel.view_change ?? 0} /></TableCell>
    <TableCell><MetricTrend value={channel.video_count} change={channel.video_change ?? 0} format={(value) => value.toLocaleString("vi-VN")} /></TableCell>
    <TableCell>{relativeDate(channel.last_video_at)}</TableCell>
    <TableCell>{healthLabels[channel.health_status]}</TableCell>
    <TableCell><div className="flex justify-end gap-1">{canManage && <><Button onClick={onEdit} variant="ghost" size="icon-sm" title="Chỉnh sửa"><Pencil className="size-4" /></Button><Button onClick={onSync} variant="ghost" size="icon-sm" title="Đồng bộ"><RefreshCw className="size-4" /></Button></>}{canDelete && <Button onClick={onRemove} variant="ghost" size="icon-sm" title="Xóa kênh" className="text-red-600 hover:text-red-700"><Trash2 className="size-4" /></Button>}<Button asChild variant="ghost" size="icon-sm"><a href={channel.youtube_url} target="_blank" rel="noreferrer" title="Mở trên YouTube"><ExternalLink className="size-4" /></a></Button></div></TableCell>
  </TableRow>;
}

function SortableHead({ column, label, activeKey, direction, onSort, className }: { column: SortKey; label: string; activeKey: SortKey | null; direction: SortDirection; onSort: (key: SortKey) => void; className?: string }) {
  const active = activeKey === column;
  const Icon = !active ? ArrowUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return <TableHead className={className}><button type="button" onClick={() => onSort(column)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-1 font-medium hover:bg-slate-100 hover:text-slate-950" title={active && direction === "desc" ? "Bấm lần nữa để trở về thứ tự kéo thả" : `Sắp xếp theo ${label.toLowerCase()}`}>{label}<Icon className={`size-3.5 ${active ? "text-indigo-600" : "text-slate-400"}`} /></button></TableHead>;
}

function MetricTrend({ value, change, format = compactNumber }: { value: number; change: number; format?: (value: number) => string }) {
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const label = change > 0 ? `Tăng ${format(Math.abs(change))}` : change < 0 ? `Giảm ${format(Math.abs(change))}` : "Không đổi";
  const tone = change > 0 ? "text-emerald-600" : change < 0 ? "text-red-600" : "text-slate-400";
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span>{format(value)}</span><span title={`${label} so với lần ghi nhận trước`} aria-label={`${label} so với lần ghi nhận trước`} className={`inline-flex ${tone}`}><Icon className="size-3.5" /></span></span>;
}

function boardRowKey(row: ChannelBoardRow): string {
  return `${row.kind}:${row.kind === "channel" ? row.channel.id : row.account.id}`;
}

function rowSortOrder(row: ChannelBoardRow): number {
  return row.kind === "channel" ? row.channel.sort_order : row.account.sort_order;
}

function sortItems<T>(items: T[], valueOf: (item: T) => string | number | null, direction: SortDirection): T[] {
  return [...items].sort((leftItem, rightItem) => {
    const left = valueOf(leftItem);
    const right = valueOf(rightItem);
    const leftMissing = left === null || left === "" || (typeof left === "number" && Number.isNaN(left));
    const rightMissing = right === null || right === "" || (typeof right === "number" && Number.isNaN(right));
    if (leftMissing || rightMissing) return leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1;
    const comparison = typeof left === "number" && typeof right === "number"
      ? left - right
      : String(left).localeCompare(String(right), "vi", { numeric: true, sensitivity: "base" });
    return direction === "asc" ? comparison : -comparison;
  });
}

function channelSortValue(channel: Channel, key: SortKey): string | number | null {
  if (key === "channel") return channel.name;
  if (key === "email") return channel.account?.email ?? null;
  if (key === "recoveryEmail") return channel.account?.recovery_email ?? null;
  if (key === "phone") return channel.account?.phone ?? null;
  if (key === "status") return statusLabels[channel.status];
  if (key === "niche") return channel.niche?.name ?? null;
  if (key === "subscribers") return channel.subscriber_count;
  if (key === "views") return channel.view_count;
  if (key === "videos") return channel.video_count;
  if (key === "lastVideo") return channel.last_video_at ? Date.parse(channel.last_video_at) : null;
  return healthLabels[channel.health_status];
}

function accountSortValue(account: Account, key: SortKey): string | number | null {
  if (key === "email") return account.email;
  if (key === "recoveryEmail") return account.recovery_email;
  if (key === "phone") return account.phone;
  if (key === "status") return "Chưa có kênh";
  return null;
}

function UnlinkedAccountRow({ account, canManage, canDrag, dragging, onDragStart, onDragEnd, onDrop, onAccountSaved, onAddChannel }: { account: Account; canManage: boolean; canDrag: boolean; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onDrop: () => void; onAccountSaved: () => Promise<void>; onAddChannel: (accountId: string) => void }) {
  return <TableRow onDragOver={(event) => { if (canDrag) event.preventDefault(); }} onDrop={() => { if (canDrag) onDrop(); }} className={`bg-amber-50/30 ${dragging ? "opacity-50" : ""}`}>
    <TableCell><span draggable={canDrag} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", account.id); onDragStart(); }} onDragEnd={onDragEnd} title={canDrag ? "Kéo để đổi vị trí tài khoản chưa có kênh" : canManage ? "Bỏ tìm kiếm hoặc sắp xếp cột để kéo thả" : undefined} className={canDrag ? "inline-flex cursor-grab rounded p-1 text-slate-400 hover:bg-amber-100 active:cursor-grabbing" : "inline-flex rounded p-1 text-slate-300"}><GripVertical className="size-4" /></span></TableCell>
    <TableCell className="overflow-hidden"><div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700"><Youtube className="size-5" /></span><div className="min-w-0"><p className="truncate font-semibold text-slate-700">Chưa có kênh</p><p className="truncate text-xs text-slate-500">Tài khoản đã nhập từ Excel</p></div></div></TableCell>
    <TableCell><EditableAccountCell accountId={account.id} field="email" value={account.email} canEdit={canManage} onSaved={onAccountSaved} /></TableCell>
    <TableCell><SecretCell accountId={account.id} kind="password" hasSecret={account.has_password} canReveal={canManage} onSaved={onAccountSaved} /></TableCell>
    <TableCell><EditableAccountCell accountId={account.id} field="recoveryEmail" value={account.recovery_email} canEdit={canManage} onSaved={onAccountSaved} /></TableCell>
    <TableCell><SecretCell accountId={account.id} kind="twoFactorSecret" hasSecret={account.two_factor_enabled} canReveal={canManage} onSaved={onAccountSaved} /></TableCell>
    <TableCell><EditableAccountCell accountId={account.id} field="phone" value={account.phone} canEdit={canManage} onSaved={onAccountSaved} /></TableCell>
    <TableCell><span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">Chưa có kênh</span></TableCell>
    <TableCell colSpan={6} className="text-center text-slate-300">—</TableCell>
    <TableCell>{canManage && <Button type="button" variant="ghost" size="icon-sm" onClick={() => onAddChannel(account.id)} title="Tạo kênh và liên kết tài khoản"><Plus className="size-4" /></Button>}</TableCell>
  </TableRow>;
}

function ImportWorkbookSheet({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (value: boolean) => void; onImported: () => Promise<void> }) {
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<YoutubeWorkbookPreview | null>(null);
  const [result, setResult] = useState<YoutubeWorkbookImportResult | null>(null);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setPreview(null);
    setResult(null);
    setFileName(file.name);
    try {
      setPreview(await parseYoutubeWorkbook(file));
    } catch (error) {
      setFileName("");
      toast.error(error instanceof Error ? error.message : "Không thể đọc file Excel.");
    } finally {
      setReading(false);
    }
  };

  const runImport = async () => {
    if (!preview || !fileName) return;
    setImporting(true);
    const toastId = toast.loading("Đang nhập và xác minh các kênh với YouTube…");
    try {
      const response = await fetch("/api/imports/youtube-workbook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceFile: fileName, rows: preview.rows }),
      });
      const body = await response.json() as { data?: YoutubeWorkbookImportResult; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Không thể nhập dữ liệu Excel.");
      setResult(body.data);
      const importedChannels = body.data.channelsCreated + body.data.channelsUpdated;
      const message = body.data.failedRows
        ? `Đã xử lý ${body.data.processedRows} dòng; ${body.data.failedRows} dòng cần kiểm tra.`
        : `Đã nhập ${importedChannels} kênh từ ${body.data.processedRows} dòng.`;
      if (body.data.failedRows) toast.warning(message, { id: toastId });
      else toast.success(message, { id: toastId });
      await onImported();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể nhập dữ liệu Excel.", { id: toastId });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFileName("");
    setPreview(null);
    setResult(null);
  };

  const channelCount = preview?.rows.filter((row) => row.channelUrl).length ?? 0;
  const referenceCount = preview?.rows.filter((row) => row.referenceUrl).length ?? 0;
  const accountCount = preview?.rows.filter((row) => row.email).length ?? 0;

  return <Sheet open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}><SheetContent className="w-full overflow-y-auto sm:max-w-2xl"><SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle>Nhập dữ liệu từ Excel</SheetTitle><SheetDescription>Chọn file có sheet “Quản lý kênh”. Mật khẩu và 2FA chỉ được gửi đến máy chủ ChannelOS để mã hóa trước khi lưu.</SheetDescription></SheetHeader><div className="space-y-5 px-6 py-5">
    <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/40"><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => void chooseFile(event.target.files?.[0])} disabled={reading || importing} /><span className="grid size-11 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm">{reading ? <LoaderCircle className="animate-spin" /> : <Upload />}</span><span className="text-left"><span className="block text-sm font-semibold text-slate-900">{fileName || "Chọn file .xlsx"}</span><span className="mt-1 block text-xs text-slate-500">Tối đa 10 MB · đọc sheet Quản lý kênh</span></span></label>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Dữ liệu bí mật được bảo vệ:</strong> mật khẩu và secret 2FA được mã hóa trước khi lưu. Link SMS, cookie và các token khác vẫn bị bỏ qua.</div>
    {preview && <><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><ImportStat label="Dòng hợp lệ" value={preview.rows.length} /><ImportStat label="Tài khoản" value={accountCount} /><ImportStat label="Kênh chính" value={channelCount} /><ImportStat label="Kênh tham khảo" value={referenceCount} /></div>
      <div className="overflow-hidden rounded-xl border border-slate-200"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead>Dòng</TableHead><TableHead>Tài khoản</TableHead><TableHead>Trạng thái</TableHead><TableHead>Chủ đề</TableHead><TableHead>Dữ liệu kênh</TableHead></TableRow></TableHeader><TableBody>{preview.rows.slice(0, 8).map((row) => <TableRow key={row.sourceRow}><TableCell>{row.sourceRow}</TableCell><TableCell className="max-w-44 truncate">{row.email ?? "—"}</TableCell><TableCell>{statusLabels[row.status]}</TableCell><TableCell>{row.nicheName ?? "—"}</TableCell><TableCell>{row.channelUrl ? "Kênh chính" : "—"}{row.referenceUrl ? `${row.channelUrl ? " + " : ""}Tham khảo` : ""}</TableCell></TableRow>)}</TableBody></Table>{preview.rows.length > 8 && <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Còn {preview.rows.length - 8} dòng khác sẽ được nhập.</p>}</div>
      {preview.warnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-900">Có {preview.warnings.length} lưu ý</p><ul className="mt-2 space-y-1 text-xs leading-5 text-amber-800">{preview.warnings.slice(0, 5).map((warning) => <li key={warning}>• {warning}</li>)}</ul></div>}</>}
    {result && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="font-semibold text-emerald-900">Kết quả import</p><p className="mt-1 text-sm leading-6 text-emerald-800">{result.accountsImported} tài khoản · {result.nichesCreated} chủ đề mới · {result.channelsCreated} kênh mới · {result.channelsUpdated} kênh cập nhật · {result.referencesCreated + result.referencesUpdated} kênh tham khảo.</p>{result.errors.length > 0 && <ul className="mt-2 space-y-1 text-xs text-red-700">{result.errors.slice(0, 8).map((error) => <li key={`${error.row}-${error.message}`}>Dòng {error.row}: {error.message}</li>)}</ul>}</div>}
  </div><SheetFooter className="border-t border-slate-200 px-6 py-4"><Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>{result ? "Đóng" : "Hủy"}</Button>{!result && <Button onClick={() => void runImport()} disabled={!preview || importing} className="bg-indigo-600 hover:bg-indigo-700">{importing ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />} Nhập vào ChannelOS</Button>}</SheetFooter></SheetContent></Sheet>;
}

function ImportStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p></div>;
}

async function patchAccount(accountId: string, payload: Record<string, string | null>) {
  const response = await fetch(`/api/accounts/${accountId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json() as { error?: string };
  if (!response.ok) throw new Error(body.error || "Không thể cập nhật tài khoản.");
}

function InlineStatusSelect({ channel, canEdit, onSaved }: { channel: Channel; canEdit: boolean; onSaved: () => Promise<void> }) {
  const [pendingValue, setPendingValue] = useState<ChannelStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const value = pendingValue ?? channel.status;

  const changeStatus = async (nextStatus: ChannelStatus) => {
    setPendingValue(nextStatus);
    setSaving(true);
    try {
      const response = await fetch(`/api/channels/${channel.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Không thể cập nhật trạng thái.");
      toast.success("Đã cập nhật trạng thái kênh.");
      await onSaved();
      setPendingValue(null);
    } catch (error) {
      setPendingValue(null);
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật trạng thái.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="relative min-w-36"><select aria-label={`Trạng thái ${channel.name}`} value={value} onChange={(event) => void changeStatus(event.target.value as ChannelStatus)} disabled={!canEdit || saving} className={`h-8 w-full rounded-full border-0 px-3 text-xs font-semibold outline-none ring-1 ring-inset disabled:cursor-default disabled:opacity-100 ${statusTone(value)}`}>{(Object.entries(statusLabels) as Array<[ChannelStatus, string]>).map(([status, label]) => <option key={status} value={status} className={statusTone(status)}>{label}</option>)}</select>{saving && <LoaderCircle className="pointer-events-none absolute -right-5 top-2 size-4 animate-spin" />}</div>;
}

function statusTone(status: ChannelStatus): string {
  const tones: Record<ChannelStatus, string> = {
    purchased: "bg-blue-50 text-blue-700 ring-blue-200",
    setup: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    warm_up: "bg-amber-50 text-amber-700 ring-amber-200",
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    paused: "bg-slate-100 text-slate-600 ring-slate-300",
    warning: "bg-orange-50 text-orange-700 ring-orange-200",
    suspended: "bg-rose-50 text-rose-700 ring-rose-200",
    dead: "bg-zinc-200 text-zinc-800 ring-zinc-400",
  };
  return tones[status];
}

function EditableAccountCell({ accountId, field, value, canEdit, onSaved }: { accountId?: string; field: "email" | "recoveryEmail" | "phone"; value: string | null; canEdit: boolean; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const cancelBlur = useRef(false);

  const startEditing = () => {
    if (!accountId || !canEdit) return;
    setDraft(value ?? "");
    setEditing(true);
  };
  const save = async () => {
    if (!accountId || saving) return;
    const cleaned = draft.trim();
    if (field === "email" && !cleaned) {
      toast.error("Email không được để trống.");
      setDraft(value ?? "");
      setEditing(false);
      return;
    }
    const nextValue = field === "email" ? cleaned : cleaned || null;
    if (nextValue === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await patchAccount(accountId, { [field]: nextValue });
      toast.success("Đã cập nhật tài khoản.");
      setEditing(false);
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật tài khoản.");
      setDraft(value ?? "");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!accountId) return <span className="text-slate-400">—</span>;
  if (editing) return <div className="flex min-w-0 items-center gap-1"><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (cancelBlur.current) { cancelBlur.current = false; return; } void save(); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { cancelBlur.current = true; setDraft(value ?? ""); setEditing(false); } }} disabled={saving} className="h-8 min-w-0 flex-1 rounded-md border border-indigo-300 px-2 text-xs outline-none ring-2 ring-indigo-100" />{saving && <LoaderCircle className="size-4 shrink-0 animate-spin text-indigo-600" />}</div>;
  return <span onDoubleClick={startEditing} title={canEdit ? `${value ?? "—"} · Nhấp đôi để sửa` : value ?? undefined} className={`block max-w-full truncate ${canEdit ? "cursor-text rounded px-1 py-1 hover:bg-indigo-50" : ""}`}>{value ?? "—"}</span>;
}

function SecretCell({ accountId, kind, hasSecret, canReveal, onSaved }: { accountId?: string; kind: "password" | "twoFactorSecret"; hasSecret: boolean; canReveal: boolean; onSaved: () => Promise<void> }) {
  const [value, setValue] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const cancelBlur = useRef(false);

  const loadSecret = async (): Promise<string | null> => {
    if (!accountId || !hasSecret) return null;
    if (value !== null) return value;
    setLoading(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}/credentials`, { cache: "no-store" });
      const body = await response.json() as { data?: { password: string | null; twoFactorSecret: string | null }; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Không thể đọc thông tin đăng nhập.");
      const secret = body.data[kind];
      if (!secret) throw new Error(kind === "password" ? "Tài khoản chưa lưu mật khẩu." : "Tài khoản chưa lưu secret 2FA.");
      setValue(secret);
      return secret;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể đọc thông tin đăng nhập.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (visible) { setVisible(false); return; }
    const secret = await loadSecret();
    if (secret) setVisible(true);
  };
  const startEditing = async () => {
    if (!accountId || !canReveal || loading) return;
    const secret = hasSecret ? await loadSecret() : null;
    if (hasSecret && secret === null) return;
    setDraft(secret ?? "");
    setEditing(true);
  };
  const save = async () => {
    if (!accountId || loading) return;
    const nextValue = draft.trim() || null;
    if (nextValue === value || (!hasSecret && nextValue === null)) {
      setEditing(false);
      return;
    }
    setLoading(true);
    try {
      await patchAccount(accountId, { [kind]: nextValue });
      setValue(nextValue);
      setVisible(Boolean(nextValue));
      setEditing(false);
      toast.success(kind === "password" ? "Đã cập nhật mật khẩu." : "Đã cập nhật 2FA.");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể cập nhật thông tin đăng nhập.");
      setEditing(false);
    } finally {
      setLoading(false);
    }
  };

  if (!accountId) return <span className="text-slate-400">—</span>;
  if (editing) return <div className="flex min-w-0 items-center gap-1"><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (cancelBlur.current) { cancelBlur.current = false; return; } void save(); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { cancelBlur.current = true; setEditing(false); } }} disabled={loading} className="h-8 min-w-0 flex-1 rounded-md border border-indigo-300 px-2 font-mono text-xs outline-none ring-2 ring-indigo-100" />{loading && <LoaderCircle className="size-4 shrink-0 animate-spin text-indigo-600" />}</div>;
  const displayHasSecret = hasSecret || Boolean(value);
  return <div onDoubleClick={() => void startEditing()} title={canReveal ? "Nhấp đôi để sửa" : undefined} className={`flex min-w-0 max-w-full items-center gap-1 rounded px-1 py-0.5 ${canReveal ? "cursor-text hover:bg-indigo-50" : ""}`}><code className="block min-w-0 flex-1 truncate text-xs">{displayHasSecret ? visible ? value : "••••••••" : "—"}</code>{canReveal && displayHasSecret && <Button type="button" variant="ghost" size="icon-sm" onClick={(event) => { event.stopPropagation(); void toggle(); }} disabled={loading} title={visible ? "Ẩn" : "Hiện"} className="shrink-0">{loading ? <LoaderCircle className="size-4 animate-spin" /> : visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>}</div>;
}

function AddChannelSheet({ open, onOpenChange, niches, accounts, defaultAccountId, onCreated }: { open: boolean; onOpenChange: (value: boolean) => void; niches: Niche[]; accounts: Account[]; defaultAccountId: string; onCreated: () => Promise<void> }) {
  const [url, setUrl] = useState("");
  const [nicheId, setNicheId] = useState("");
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [status, setStatus] = useState<ChannelStatus>("setup");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const resolve = async () => {
    setLoading(true); setPreview(null);
    try {
      const response = await fetch("/api/youtube/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const body = await response.json() as { data?: Preview; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Không thể đọc kênh YouTube.");
      setPreview(body.data);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể đọc kênh YouTube."); }
    finally { setLoading(false); }
  };
  const create = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/channels", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ youtubeUrl: url, nicheId: nicheId || null, accountId: accountId || null, status, notes: notes || null }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Không thể thêm kênh.");
      toast.success("Đã thêm kênh và lưu vào Supabase.");
      setUrl(""); setPreview(null); setNotes(""); setNicheId(""); setAccountId(""); await onCreated();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Không thể thêm kênh."); }
    finally { setLoading(false); }
  };
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle>Thêm kênh YouTube</SheetTitle><SheetDescription>Dán URL kênh để xác minh bằng YouTube Data API trước khi lưu.</SheetDescription></SheetHeader><div className="space-y-5 px-6 py-5"><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">URL kênh</span><div className="flex gap-2"><input value={url} onChange={(event) => { setUrl(event.target.value); setPreview(null); }} placeholder="https://youtube.com/@tenkenh" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300" /><Button onClick={() => void resolve()} disabled={loading || !url}>{loading ? <LoaderCircle className="animate-spin" /> : "Kiểm tra"}</Button></div></label>{preview && <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4"><div className="flex gap-3">{preview.avatarUrl ? <img src={preview.avatarUrl} alt="" className="size-14 rounded-xl object-cover" /> : <span className="grid size-14 place-items-center rounded-xl bg-white text-red-600"><Youtube /></span>}<div><p className="font-semibold text-slate-950">{preview.title}</p><p className="text-xs text-slate-500">{preview.customUrl ?? preview.id}</p><p className="mt-2 text-sm text-slate-600">{compactNumber(preview.subscriberCount)} người đăng ký · {preview.videoCount.toLocaleString("vi-VN")} video</p></div></div></div>}<label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Tài khoản vận hành</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Chưa liên kết tài khoản</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.email}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Có thể chọn email đã lưu trước dù lúc tạo tài khoản chưa có kênh.</span></label><ChannelFields status={status} setStatus={setStatus} nicheId={nicheId} setNicheId={setNicheId} notes={notes} setNotes={setNotes} niches={niches} /></div><SheetFooter className="border-t border-slate-200 px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button><Button onClick={() => void create()} disabled={!preview || loading} className="bg-indigo-600 hover:bg-indigo-700">{loading && <LoaderCircle className="animate-spin" />} Thêm kênh</Button></SheetFooter></SheetContent></Sheet>;
}

function EditChannelSheet({ channel, niches, accounts, onOpenChange, onSaved }: { channel: Channel; niches: Niche[]; accounts: Account[]; onOpenChange: (value: boolean) => void; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState<ChannelStatus>(channel.status);
  const [nicheId, setNicheId] = useState(channel.niche_id ?? "");
  const [accountId, setAccountId] = useState(channel.account_id ?? "");
  const [notes, setNotes] = useState(channel.notes ?? "");
  const [loading, setLoading] = useState(false);
  const save = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/channels/${channel.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, nicheId: nicheId || null, accountId: accountId || null, notes: notes || null }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Không thể lưu thay đổi.");
      toast.success("Đã cập nhật kênh.");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể lưu thay đổi.");
    } finally {
      setLoading(false);
    }
  };
  return <Sheet open onOpenChange={onOpenChange}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle>Chỉnh sửa {channel.name}</SheetTitle><SheetDescription>Cập nhật trạng thái, chủ đề và ghi chú vận hành.</SheetDescription></SheetHeader><div className="space-y-5 px-6 py-5"><label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Tài khoản vận hành</span><select value={accountId} onChange={(event) => setAccountId(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Chưa liên kết tài khoản</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.email}</option>)}</select></label><ChannelFields status={status} setStatus={setStatus} nicheId={nicheId} setNicheId={setNicheId} notes={notes} setNotes={setNotes} niches={niches} /></div><SheetFooter className="border-t border-slate-200 px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button><Button onClick={() => void save()} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">{loading && <LoaderCircle className="animate-spin" />} Lưu thay đổi</Button></SheetFooter></SheetContent></Sheet>;
}

function ChannelFields({ status, setStatus, nicheId, setNicheId, notes, setNotes, niches }: { status: ChannelStatus; setStatus: (value: ChannelStatus) => void; nicheId: string; setNicheId: (value: string) => void; notes: string; setNotes: (value: string) => void; niches: Niche[] }) {
  return <><div className="grid grid-cols-2 gap-4"><label><span className="mb-1.5 block text-sm font-medium text-slate-700">Trạng thái</span><select value={status} onChange={(event) => setStatus(event.target.value as ChannelStatus)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">{(Object.entries(statusLabels) as Array<[ChannelStatus, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="mb-1.5 block text-sm font-medium text-slate-700">Chủ đề</span><select value={nicheId} onChange={(event) => setNicheId(event.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"><option value="">Chưa phân loại</option>{niches.map((niche) => <option key={niche.id} value={niche.id}>{niche.name}</option>)}</select></label></div><label><span className="mb-1.5 block text-sm font-medium text-slate-700">Ghi chú</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} maxLength={4000} className="w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-indigo-300" placeholder="Thông tin vận hành hoặc việc tiếp theo…" /></label><p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Không lưu mật khẩu, mã 2FA hoặc token bí mật trong ghi chú.</p></>;
}
