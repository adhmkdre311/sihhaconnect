// M5: front-desk walk-in registration.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createWalkInAppointment, findWalkInWorker } from "@/lib/clinicWalkIn.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, UserPlus, X } from "lucide-react";

type Match = { id: string; full_name: string | null; phone_number: string | null; preferred_language: string | null };
const REASONS = ["fever", "injury", "dental", "checkup", "medication_review", "other"] as const;

export function WalkInDialog({ onCreated }: { onCreated: () => void }) {
  const search = useServerFn(findWalkInWorker);
  const create = useServerFn(createWalkInAppointment);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [picked, setPicked] = useState<Match | null>(null);
  const [department, setDepartment] = useState("General");
  const [reason, setReason] = useState<(typeof REASONS)[number]>("other");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => { setQuery(""); setMatches([]); setPicked(null); setNote(""); setReason("other"); };

  async function runSearch() {
    setBusy(true);
    try {
      const rows = await search({ data: { query } });
      setMatches(rows);
      if (rows.length === 0) toast.info("No worker found. Ask them to sign up with their employer invite first.");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Search failed"); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!picked) return;
    setBusy(true);
    try {
      await create({ data: { workerId: picked.id, department, reason, note: note || undefined } });
      toast.success("Walk-in added to the queue");
      setOpen(false); reset(); onCreated();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="me-1 h-4 w-4" /> Register walk-in
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold">Register a walk-in</h2>
            <p className="text-xs text-muted-foreground">Find the worker, then add them to today's queue.</p>
          </div>
          <button onClick={() => setOpen(false)} aria-label="close"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex gap-2">
          <Input placeholder="Name, phone or email" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && query.trim().length >= 4) void runSearch(); }} />
          <Button variant="outline" disabled={busy || query.trim().length < 4} onClick={() => void runSearch()}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {matches.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {matches.map((m) => (
              <li key={m.id}>
                <button onClick={() => setPicked(m)}
                  className={`w-full rounded-lg border p-2 text-start text-sm ${picked?.id === m.id ? "border-primary bg-primary/5" : ""}`}>
                  <span className="font-medium">{m.full_name ?? "—"}</span>
                  <span className="ms-2 text-xs text-muted-foreground" dir="ltr">{m.phone_number ?? ""}</span>
                  <span className="ms-2 text-xs text-muted-foreground">{m.preferred_language ?? "en"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {picked && (
          <div className="space-y-3 rounded-lg border bg-secondary/30 p-3">
            <div><Label>Department</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
            <div>
              <Label>Reason</Label>
              <select className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm"
                value={reason} onChange={(e) => setReason(e.target.value as (typeof REASONS)[number])}>
                {REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
              </select>
            </div>
            <div><Label>Front-desk note (optional)</Label><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <Button disabled={busy} onClick={() => void submit()}>{busy ? "Saving…" : "Add to queue"}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
