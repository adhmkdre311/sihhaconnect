import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { addWorkerToEmployer } from "@/lib/roles.functions";
import { Copy, Plus } from "lucide-react";

export const Route = createFileRoute("/employer/roster")({ component: Roster });

function Roster() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const [workers, setWorkers] = useState<{id:string; full_name:string|null; phone_number:string|null; preferred_language:string}[]>([]);
  const [invite, setInvite] = useState<string>("");
  const [form, setForm] = useState({ fullName: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const runAdd = useServerFn(addWorkerToEmployer);

  const reload = async () => {
    if (!user) return;
    const { data: role } = await supabase.from("user_roles").select("employer_id").eq("user_id", user.id).eq("role","employer_admin").maybeSingle();
    if (!role?.employer_id) return;
    const { data: emp } = await supabase.from("employers").select("invite_code").eq("id", role.employer_id).single();
    setInvite(emp?.invite_code ?? "");
    const { data: ws } = await supabase.from("profiles").select("id, full_name, phone_number, preferred_language").eq("employer_id", role.employer_id);
    setWorkers(ws ?? []);
  };
  useEffect(() => { void reload(); }, [user]);

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
    toast.success(`Imported ${added}`); reload();
  }

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

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <form onSubmit={submit} className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="text-sm font-semibold">{t("add_worker")}</div>
          <div><Label>{t("full_name")}</Label><Input value={form.fullName} onChange={e=>setForm({...form, fullName:e.target.value})} required /></div>
          <div><Label>{t("email")}</Label><Input type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} required /></div>
          <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} required /></div>
          <Button type="submit" disabled={busy}><Plus className="mr-1 h-4 w-4" />{busy?t("saving"):t("add_worker")}</Button>
        </form>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-sm font-semibold">{t("import_csv")}</div>
          <p className="text-xs text-muted-foreground">Format: full_name,email,phone</p>
          <input type="file" accept=".csv" onChange={e=> e.target.files?.[0] && void importCsv(e.target.files[0])} className="mt-2 text-xs" />
        </div>
      </div>

      <div className="rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr><th className="p-3">{t("full_name")}</th><th className="p-3">{t("phone")}</th><th className="p-3">{t("language")}</th></tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} className="border-b last:border-0">
                <td className="p-3">{w.full_name}</td>
                <td className="p-3">{w.phone_number}</td>
                <td className="p-3">{w.preferred_language}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
