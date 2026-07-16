import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClinicShell } from "@/components/ClinicShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { translateVisitSummary } from "@/lib/ai.functions";
import { Languages, Sparkles } from "lucide-react";

export const Route = createFileRoute("/clinic/")({ component: Queue });

type Q = {
  id: string; scheduled_at: string; department: string; status: string;
  ai_context_summary: string | null; worker_notes: string | null; symptom_category: string | null; visit_summary: string | null;
  worker: { full_name: string | null; preferred_language: string | null } | null;
};

function Queue() {
  const { t } = useLang();
  const { user } = useAuth();
  const [items, setItems] = useState<Q[]>([]);
  const [drafts, setDrafts] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const run = useServerFn(translateVisitSummary);

  const reload = () => {
    if (!user) return;
    void supabase.from("appointments")
      .select("id, scheduled_at, department, status, ai_context_summary, worker_notes, symptom_category, visit_summary, worker:profiles!appointments_worker_id_fkey(full_name, preferred_language)")
      .order("scheduled_at", { ascending: true })
      .then(({ data }) => setItems((data ?? []) as never));
  };
  useEffect(reload, [user]);

  async function save(id: string) {
    setBusy(id);
    try { await run({ data: { appointmentId: id, englishSummary: drafts[id] ?? "" } }); toast.success("Sent & translated"); reload(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  async function markStatus(id: string, status: "completed"|"no_show"|"cancelled") {
    await supabase.from("appointments").update({ status }).eq("id", id);
    toast.success(status);
    reload();
  }

  return (
    <ClinicShell>
      <h1 className="mb-4 text-xl font-semibold">{t("incoming_appointments")}</h1>
      <ul className="space-y-3">
        {items.map((q) => (
          <li key={q.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">{q.worker?.full_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{new Date(q.scheduled_at).toLocaleString()} · {q.department} · {q.status}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="flex items-center gap-1 rounded-full bg-accent/20 px-2 py-1 text-xs font-medium text-accent-foreground">
                  <Languages className="h-3 w-3" />{q.worker?.preferred_language ?? "en"}
                </span>
                {q.worker?.preferred_language && !["en","ar"].includes(q.worker.preferred_language) && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Interpreter needed
                  </span>
                )}
              </div>
            </div>
            {q.ai_context_summary && (
              <div className="mt-3 rounded-lg bg-secondary p-3 text-sm">
                <div className="mb-1 flex items-center gap-1 text-xs font-medium text-secondary-foreground"><Sparkles className="h-3 w-3" /> AI context</div>
                {q.ai_context_summary}
              </div>
            )}
            {q.worker_notes && <div className="mt-2 text-xs text-muted-foreground">Patient note: {q.worker_notes}</div>}

            {q.status === "booked" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={()=>markStatus(q.id,"completed")}>Mark completed</Button>
                <Button size="sm" variant="outline" onClick={()=>markStatus(q.id,"no_show")}>No-show</Button>
                <Button size="sm" variant="ghost" onClick={()=>markStatus(q.id,"cancelled")}>Cancel</Button>
              </div>
            )}

            <div className="mt-3">
              <div className="mb-1 text-xs font-medium">{t("post_visit_summary")} (English)</div>
              <Textarea rows={3} value={drafts[q.id] ?? q.visit_summary ?? ""} onChange={(e)=>setDrafts({...drafts, [q.id]: e.target.value})} />
              <Button size="sm" className="mt-2" onClick={()=>save(q.id)} disabled={busy===q.id}>{busy===q.id?t("saving"):"Send translated to patient"}</Button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-muted-foreground">—</li>}
      </ul>
    </ClinicShell>
  );
}
