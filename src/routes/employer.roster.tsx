import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmployerInviteLinks } from "@/components/EmployerInviteLinks";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { useEmployerWorkers, type WorkerRow } from "@/hooks/useEmployerWorkers";
import { useFormat } from "@/lib/format";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { addWorkerToEmployer, setWorkerActive } from "@/lib/roles.functions";
import { Copy, Plus } from "lucide-react";

export const Route = createFileRoute("/employer/roster")({ component: Roster });

function Roster() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const fmt = useFormat();
  const { filtered, inviteCode: invite, loading, query, setQuery, reload } =
    useEmployerWorkers(user?.id);
  const [form, setForm] = useState({ fullName: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const runAdd = useServerFn(addWorkerToEmployer);
  const runToggle = useServerFn(setWorkerActive);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const r = await runAdd({ data: { fullName: form.fullName, email: form.email, phoneNumber: form.phone, preferredLanguage: lang } });
      toast.success(`Added. Temp password: ${r.tempPassword}`);
      setForm({ fullName:"", email:"", phone:"" });
      await reload();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const lines = text.split(/\r?\n/).slice(1).filter(Boolean);
    let added = 0;
    for (const line of lines) {
      const [fullName, email, phone] = line.split(",").map(s => s?.trim());
      if (!fullName || !email || !phone) continue;
      try { await runAdd({ data: { fullName, email, phoneNumber: phone, preferredLanguage: lang } }); added++; } catch {}
    }
    toast.success(`Imported ${added}`); void reload();
  }

  async function toggle(id: string, next: boolean) {
    try { await runToggle({ data: { workerId: id, isActive: next } }); toast.success(next ? "Reactivated" : "Deactivated"); await reload(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  const columns: DataTableColumn<WorkerRow>[] = [
    { key: "full_name", header: t("full_name"), cell: (w) => w.full_name ?? "—" },
    { key: "phone_number", header: t("phone"), cell: (w) => <span dir="ltr">{w.phone_number ?? "—"}</span> },
    { key: "preferred_language", header: t("language") },
    { key: "created_at", header: "Joined", cell: (w) => fmt.date(w.created_at) },
    {
      key: "is_active",
      header: "Status",
      cell: (w) => (
        <span className={`rounded-full px-2 py-0.5 text-xs ${w.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {w.is_active ? "Active" : "Deactivated"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-end",
      cell: (w) => (
        <Button size="sm" variant={w.is_active ? "outline" : "default"} onClick={() => toggle(w.id, !w.is_active)}>
          {w.is_active ? "Deactivate" : "Reactivate"}
        </Button>
      ),
    },
  ];

  return (
    <AdminShell>
      <div className="mb-6 rounded-2xl border bg-card p-4">
        <div className="text-xs text-muted-foreground">{t("generate_invite")}</div>
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-2 py-1 text-lg">{invite || "—"}</code>
          {invite && <Button size="sm" variant="ghost" onClick={()=>{ navigator.clipboard.writeText(invite); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Share with workers when they sign up.</p>
      </div>

      <EmployerInviteLinks />

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <form onSubmit={submit} className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold">{t("add_worker")}</div>
          <div><Label>{t("full_name")}</Label><Input value={form.fullName} onChange={e=>setForm({...form, fullName:e.target.value})} required /></div>
          <div><Label>{t("email")}</Label><Input type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required /></div>
          <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} required /></div>
          <Button type="submit" disabled={busy}><Plus className="me-1 h-4 w-4" />{busy?t("saving"):t("add_worker")}</Button>
        </form>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-sm font-semibold">{t("import_csv")}</div>
          <p className="text-xs text-muted-foreground">Format: full_name,email,phone</p>
          <input type="file" accept=".csv" onChange={e=> e.target.files?.[0] && void importCsv(e.target.files[0])} className="mt-2 text-xs" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border bg-card p-3">
          <Input placeholder="Search by name or phone" value={query} onChange={(e)=>setQuery(e.target.value)} />
        </div>
        <DataTable columns={columns} rows={filtered} rowKey={(w) => w.id} loading={loading} empty="No workers yet" />
      </div>
    </AdminShell>
  );
}
