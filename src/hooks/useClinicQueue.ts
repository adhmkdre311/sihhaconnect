// E1 + E4: clinic queue data hook — query, day filtering, lazy translation and
// realtime refresh, extracted out of the screen component.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { translateContextNote } from "@/lib/clinic.functions";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

export type QueueRow = {
  id: string; scheduled_at: string; department: string; status: string;
  ai_context_summary: string | null; worker_notes: string | null;
  symptom_category: string | null; visit_summary: string | null;
  context_note: string | null; context_note_translated: string | null;
  worker: { full_name: string | null; preferred_language: string | null } | null;
};

const SELECT =
  "id, scheduled_at, department, status, ai_context_summary, worker_notes, symptom_category, visit_summary, context_note, context_note_translated, worker:profiles!appointments_worker_id_fkey(full_name, preferred_language)";

export function useClinicQueue(enabled: boolean) {
  const translateCtx = useServerFn(translateContextNote);
  const [items, setItems] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayFilter, setDayFilter] = useState<string>("today");

  const reload = useCallback(async () => {
    if (!enabled) return;
    const { data } = await supabase
      .from("appointments").select(SELECT).order("scheduled_at", { ascending: true });
    const rows = (data ?? []) as unknown as QueueRow[];
    setItems(rows);
    setLoading(false);
    // Backfill any note the booking-time translation missed (E2 safety net).
    for (const r of rows.filter((x) => x.context_note && !x.context_note_translated)) {
      try { await translateCtx({ data: { appointmentId: r.id } }); } catch { /* ignore */ }
    }
  }, [enabled, translateCtx]);

  useEffect(() => { void reload(); }, [reload]);
  useRealtimeTable("appointments", () => { void reload(); }, { enabled });

  const days = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(new Date(i.scheduled_at).toDateString()));
    return Array.from(set).slice(0, 7);
  }, [items]);

  const filtered = useMemo(() => {
    const today = new Date().toDateString();
    if (dayFilter === "all") return items;
    if (dayFilter === "today") return items.filter((i) => new Date(i.scheduled_at).toDateString() === today);
    return items.filter((i) => new Date(i.scheduled_at).toDateString() === dayFilter);
  }, [items, dayFilter]);

  return { items, filtered, days, dayFilter, setDayFilter, loading, reload };
}
