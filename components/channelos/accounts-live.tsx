"use client";

import { useState } from "react";
import { Eye, EyeOff, GripVertical, LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Account } from "@/types/domain";

export function AccountsLive({ initial, canManage }: { initial: Account[]; canManage: boolean }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initial);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const moveAccount = async (targetId: string) => {
    if (!draggingId || draggingId === targetId) return;
    const previous = accounts;
    const from = previous.findIndex((item) => item.id === draggingId);
    const to = previous.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...previous];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setAccounts(reordered);
    setDraggingId(null);
    try {
      const response = await fetch("/api/accounts/reorder", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: reordered.map((item) => item.id) }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Không thể lưu thứ tự tài khoản.");
    } catch (error) {
      setAccounts(previous);
      toast.error(error instanceof Error ? error.message : "Không thể lưu thứ tự tài khoản.");
    }
  };

  return <div className="space-y-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-semibold tracking-tight text-slate-950">Tài khoản</h2><p className="mt-1 text-sm text-slate-500">Email có thể được lưu trước khi có kênh. Kéo biểu tượng bên trái để đổi vị trí.</p></div>{canManage && <Button onClick={() => setAddOpen(true)} className="bg-indigo-600 hover:bg-indigo-700"><Plus /> Thêm tài khoản</Button>}</div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><Table className="min-w-[1050px]"><TableHeader className="bg-slate-50"><TableRow><TableHead className="w-10" /><TableHead>Email</TableHead><TableHead>Mật khẩu</TableHead><TableHead>Email 2</TableHead><TableHead>2FA</TableHead><TableHead>SĐT</TableHead><TableHead>Nguồn</TableHead><TableHead>Trạng thái</TableHead></TableRow></TableHeader><TableBody>{accounts.map((account) => <TableRow key={account.id} onDragOver={(event) => { if (canManage) event.preventDefault(); }} onDrop={() => void moveAccount(account.id)} className={draggingId === account.id ? "opacity-50" : undefined}><TableCell><span draggable={canManage} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", account.id); setDraggingId(account.id); }} onDragEnd={() => setDraggingId(null)} title={canManage ? "Kéo để đổi vị trí" : undefined} className={canManage ? "inline-flex cursor-grab rounded p-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing" : "text-slate-300"}><GripVertical className="size-4" /></span></TableCell><TableCell className="font-semibold">{account.email}</TableCell><TableCell><AccountSecret accountId={account.id} kind="password" available={account.has_password} canReveal={canManage} /></TableCell><TableCell>{account.recovery_email ?? "—"}</TableCell><TableCell><AccountSecret accountId={account.id} kind="twoFactorSecret" available={account.two_factor_enabled} canReveal={canManage} /></TableCell><TableCell>{account.phone ?? "—"}</TableCell><TableCell>{account.source ?? "—"}</TableCell><TableCell>{account.status}</TableCell></TableRow>)}{!accounts.length && <TableRow><TableCell colSpan={8} className="h-40 text-center text-slate-400">Chưa có tài khoản.</TableCell></TableRow>}</TableBody></Table></div>
    <AddAccountSheet open={addOpen} onOpenChange={setAddOpen} onCreated={(account) => { setAccounts((items) => [...items, account]); setAddOpen(false); router.refresh(); }} />
  </div>;
}

function AccountSecret({ accountId, kind, available, canReveal }: { accountId: string; kind: "password" | "twoFactorSecret"; available: boolean; canReveal: boolean }) {
  const [value, setValue] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  if (!available) return <span className="text-slate-400">—</span>;
  const toggle = async () => {
    if (visible) { setVisible(false); return; }
    if (value) { setVisible(true); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}/credentials`, { cache: "no-store" });
      const body = await response.json() as { data?: { password: string | null; twoFactorSecret: string | null }; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Không thể đọc thông tin đăng nhập.");
      const secret = body.data[kind];
      if (!secret) throw new Error("Chưa có dữ liệu.");
      setValue(secret);
      setVisible(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể đọc thông tin đăng nhập.");
    } finally {
      setLoading(false);
    }
  };
  return <div className="flex max-w-56 items-center gap-1"><code className="block max-w-44 truncate text-xs">{visible ? value : "••••••••"}</code>{canReveal && <Button type="button" variant="ghost" size="icon-sm" onClick={() => void toggle()} disabled={loading}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>}</div>;
}

export function AddAccountSheet({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (value: boolean) => void; onCreated: (account: Account) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const reset = () => { setEmail(""); setPassword(""); setRecoveryEmail(""); setTwoFactorSecret(""); setPhone(""); };
  const create = async () => {
    if (!email.trim()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim(), password: password || null, recoveryEmail: recoveryEmail.trim() || null, twoFactorSecret: twoFactorSecret.trim() || null, phone: phone.trim() || null }) });
      const body = await response.json() as { data?: Account; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Không thể thêm tài khoản.");
      toast.success("Đã thêm tài khoản. Có thể liên kết kênh sau.");
      reset();
      onCreated(body.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể thêm tài khoản.");
    } finally {
      setSaving(false);
    }
  };
  const fieldClass = "h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-300";
  return <Sheet open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}><SheetContent className="w-full overflow-y-auto sm:max-w-xl"><SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle>Thêm tài khoản chưa có kênh</SheetTitle><SheetDescription>Lưu email trước; khi có kênh YouTube bạn có thể liên kết sau.</SheetDescription></SheetHeader><div className="grid gap-4 px-6 py-5 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium">Email *</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} /></label><label><span className="mb-1.5 block text-sm font-medium">Mật khẩu</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} autoComplete="new-password" /></label><label><span className="mb-1.5 block text-sm font-medium">Email 2</span><input type="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} className={fieldClass} /></label><label><span className="mb-1.5 block text-sm font-medium">2FA</span><input value={twoFactorSecret} onChange={(event) => setTwoFactorSecret(event.target.value)} className={fieldClass} /></label><label><span className="mb-1.5 block text-sm font-medium">SĐT</span><input value={phone} onChange={(event) => setPhone(event.target.value)} className={fieldClass} /></label></div><SheetFooter className="border-t border-slate-200 px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button><Button onClick={() => void create()} disabled={!email.trim() || saving} className="bg-indigo-600 hover:bg-indigo-700">{saving && <LoaderCircle className="animate-spin" />} Thêm tài khoản</Button></SheetFooter></SheetContent></Sheet>;
}
