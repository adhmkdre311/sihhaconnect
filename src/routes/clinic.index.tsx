import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ClinicShell } from "@/components/ClinicShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { translateVisitSummary } from "@/lib/ai.functions";
import { useClinicQueue, type QueueRow } from "@/hooks/useClinicQueue";
import { useFormat } from "@/lib/format";
import { Languages, Sparkles } from "lucide-react";
import { WalkInDialog } from "@/components/WalkInDialog";

export const Route = createFileRoute("/clinic/")({ component: Queue });

type Q = QueueRow;

const STATUS_OPTIONS = ["pending","booked","confirmed","awaiting_checkin","completed","no_show","cancelled"] as const;
type Status = typeof STATUS_OPTIONS[number];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    booked: "bg-primary/10 text-primary",
    confirmed: "bg-emerald-100 text-emerald-700",
    awaiting_checkin: "bg-amber-100 text-amber-700",
    completed: "bg-secondary text-secondary-foreground",
    no_show: "bg-destructive/10 text-destructive",
    cancelled: "bg-muted text-muted-foreground line-through",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[status] ?? "bg-muted"}`}>{status.replace("_"," ")}</span>;
}

function Queue() {
  const { t } = useLang();
  const { user } = useAuth();
  const fmt = useFormat();
  const [drafts, setDrafts] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const run = useServerFn(translateVisitSummary);
  // E1/E4: query + filtering + realtime refresh live in the hook now.
  const { filtered, days, dayFilter, setDayFilter, reload } = useClinicQueue(Boolean(user));

  async function save(id: string) {
    setBusy(id);
    try { await run({ data: { appointmentId: id, englishSummary: drafts[id] ?? "" } }); toast.success("Sent & translated"); void reload(); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  }

  async function markStatus(row: Q, status: Status) {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    // Notify worker on meaningful transitions
    if (["confirmed","awaiting_checkin","cancelled","no_show"].includes(status)) {
      const titles: Record<string,string> = {
        confirmed: "Appointment confirmed",
        awaiting_checkin: "You can check in now",
        cancelled: "Appointment cancelled",
        no_show: "Marked as no-show",
      };
      await supabase.from("appointments").select("worker_id").eq("id", row.id).single().then(async ({ data }) => {
        if (!data?.worker_id) return;
        await supabase.from("notifications").insert({
          worker_id: data.worker_id, type: "appointment_reminder", channel: "in_app",
          title: titles[status], content: `${row.department} · ${fmt.dateTime(row.scheduled_at)}`,
        });
      });
    }
    toast.success(status.replace("_"," "));
    void reload();
  }

  return (
    <ClinicShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t("incoming_appointments")}</h1>
        <WalkInDialog onCreated={() => void reload()} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={()=>setDayFilter("today")} className={`chip ${dayFilter==="today"?"bg-primary text-primary-foreground":"bg-muted"}`}>Today</button>
        <button onClick={()=>setDayFilter("all")} className={`chip ${dayFilter==="all"?"bg-primary text-primary-foreground":"bg-muted"}`}>All</button>
        {days.filter(d => d !== new Date().toDateString()).map(d => (
          <button key={d} onClick={()=>setDayFilter(d)} className={`chip ${dayFilter===d?"bg-primary text-primary-foreground":"bg-muted"}`}>
            {fmt.date(d)}
          </button>
        ))}
      </div>
      <ul className="space-y-3">
        {filtered.map((q) => (
          <li key={q.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">{q.worker?.full_name ?? "—"}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{fmt.dateTime(q.scheduled_at)}</span>
                  <span>·</span>
                  <span>{q.department}</span>
                  <StatusBadge status={q.status} />
                </div>
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
            {(q.context_note || q.ai_context_summary) && (
              <div className="mt-3 rounded-lg bg-secondary p-3 text-sm">
                <div className="mb-1 flex items-center gap-1 text-xs font-medium text-secondary-foreground"><Sparkles className="h-3 w-3" /> Patient note (translated)</div>
                <div>{q.context_note_translated ?? q.ai_context_summary ?? q.context_note}</div>
                {q.context_note && q.context_note_translated && q.context_note !== q.context_note_translated && (
                  <div className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground" dir="auto">
                    <span className="font-medium">Original:</span> {q.context_note}
                  </div>
                )}
              </div>
            )}
            {q.worker_notes && <div className="mt-2 text-xs text-muted-foreground">Patient note: {q.worker_notes}</div>}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted-foreground">Update status</label>
              <select
                value={q.status}
                onChange={(e)=>markStatus(q, e.target.value as Status)}
                className="rounded-md border bg-background px-2 py-1 text-sm"
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
              </select>
            </div>

            <div className="mt-3">
              <div className="mb-1 text-xs font-medium">{t("post_visit_summary")} (English)</div>
              <Textarea rows={3} value={drafts[q.id] ?? q.visit_summary ?? ""} onChange={(e)=>setDrafts({...drafts, [q.id]: e.target.value})} />
              <Button size="sm" className="mt-2" onClick={()=>save(q.id)} disabled={busy===q.id}>{busy===q.id?t("saving"):"Send translated to patient"}</Button>
            </div>
          </li>
        ))}
        {filtered.length === 0 && <li className="text-sm text-muted-foreground">No appointments for this day.</li>}
      </ul>
    </ClinicShell>
  );
}
