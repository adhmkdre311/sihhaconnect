import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ClinicShell } from "@/components/ClinicShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { clinicAddDocument } from "@/lib/clinic.functions";
import { Languages, FileText, X } from "lucide-react";
import { useClinicPerms } from "@/lib/useClinicPerms";

export const Route = createFileRoute("/clinic/patients")({ component: Patients });

type Patient = { worker_id: string; full_name: string | null; preferred_language: string | null; visit_count: number; last_visit: string };
type Doc = { id: string; type: string; original_text: string | null; ai_plain_language_summary: string | null; created_at: string };

function Patients() {
  const { user } = useAuth();
  const { perms } = useClinicPerms();
  const canAddDocs = perms?.can_add_documents ?? false;
  const [rows, setRows] = useState<Patient[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Patient | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [form, setForm] = useState({ type: "visit_summary", title: "", text: "" });
  const [busy, setBusy] = useState(false);
  const add = useServerFn(clinicAddDocument);

  const reload = async () => {
    if (!user) return;
    const { data } = await supabase.from("appointments")
      .select("worker_id, scheduled_at, worker:profiles!appointments_worker_id_fkey(full_name, preferred_language)")
      .order("scheduled_at", { ascending: false });
    const map = new Map<string, Patient>();
    type Row = { worker_id: string; scheduled_at: string; worker: { full_name?: string | null; preferred_language?: string | null } | null };
    ((data ?? []) as unknown as Row[]).forEach((r) => {
      const existing = map.get(r.worker_id);
      if (existing) existing.visit_count += 1;
      else map.set(r.worker_id, {
        worker_id: r.worker_id,
        full_name: r.worker?.full_name ?? null,
        preferred_language: r.worker?.preferred_language ?? null,
        visit_count: 1,
        last_visit: r.scheduled_at,
      });
    });
    setRows(Array.from(map.values()));
  };
  useEffect(() => { void reload(); }, [user]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(r => (r.full_name ?? "").toLowerCase().includes(s));
  }, [rows, q]);

  const openPatient = async (p: Patient) => {
    setOpen(p);
    setDocs([]);
    const { data } = await supabase.from("documents")
      .select("id, type, original_text, ai_plain_language_summary, created_at")
      .eq("worker_id", p.worker_id).order("created_at", { ascending: false });
    setDocs((data ?? []) as Doc[]);
  };

  const submitDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!open) return;
    setBusy(true);
    try {
      await add({ data: {
        workerId: open.worker_id,
        type: form.type as "prescription"|"lab_report"|"visit_summary"|"insurance_form"|"other",
        title: form.title || undefined,
        text: form.text,
      }});
      toast.success("Document added and explained to patient");
      setForm({ type: "visit_summary", title: "", text: "" });
      void openPatient(open);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <ClinicShell>
      <h1 className="mb-4 text-xl font-semibold">Patient records</h1>
      <Input placeholder="Search by name…" value={q} onChange={(e)=>setQ(e.target.value)} className="mb-4 max-w-sm" />
      <div className="rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-start text-xs text-muted-foreground">
            <tr><th className="p-3">Name</th><th className="p-3">Language</th><th className="p-3">Visits</th><th className="p-3">Last visit</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.worker_id} className="border-b last:border-0">
                <td className="p-3 font-medium">{r.full_name ?? "—"}</td>
                <td className="p-3"><span className="chip bg-accent/20 text-accent-foreground"><Languages className="me-1 inline h-3 w-3" />{r.preferred_language ?? "en"}</span></td>
                <td className="p-3">{r.visit_count}</td>
                <td className="p-3">{new Date(r.last_visit).toLocaleDateString()}</td>
                <td className="p-3"><Button size="sm" variant="outline" onClick={()=>openPatient(r)}>Open</Button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">No patients yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setOpen(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-xl" onClick={(e)=>e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{open.full_name}</h2>
                <p className="text-xs text-muted-foreground">Preferred language: {open.preferred_language ?? "en"} · {open.visit_count} visit(s)</p>
              </div>
              <button onClick={()=>setOpen(null)} aria-label="close"><X className="h-5 w-5" /></button>
            </div>

            <h3 className="mb-2 text-sm font-semibold">Documents on file</h3>
            <ul className="mb-6 space-y-2">
              {docs.map(d => (
                <li key={d.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center gap-2 text-xs font-medium"><FileText className="h-3 w-3" /> {d.type.replace("_"," ")} · {new Date(d.created_at).toLocaleDateString()}</div>
                  {d.ai_plain_language_summary && <div className="mt-1 text-xs text-muted-foreground">{d.ai_plain_language_summary}</div>}
                </li>
              ))}
              {docs.length === 0 && <li className="text-xs text-muted-foreground">No documents yet.</li>}
            </ul>

            {canAddDocs ? (
            <form onSubmit={submitDoc} className="space-y-3 rounded-lg border bg-secondary/30 p-4">
              <h3 className="text-sm font-semibold">Add document</h3>
              <div>
                <Label>Type</Label>
                <select className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm" value={form.type} onChange={(e)=>setForm({...form, type:e.target.value})}>
                  <option value="visit_summary">Visit summary</option>
                  <option value="prescription">Prescription</option>
                  <option value="lab_report">Lab report</option>
                  <option value="insurance_form">Insurance form</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div><Label>Title (optional)</Label><Input value={form.title} onChange={(e)=>setForm({...form, title:e.target.value})} /></div>
              <div><Label>Text</Label><Textarea rows={6} value={form.text} onChange={(e)=>setForm({...form, text:e.target.value})} required /></div>
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save and explain to patient"}</Button>
            </form>
            ) : (
              <div className="rounded-lg border bg-muted p-3 text-xs text-muted-foreground">
                Ask a clinic manager for the "Add documents" permission to upload patient records.
              </div>
            )}
          </div>
        </div>
      )}
    </ClinicShell>
  );
}