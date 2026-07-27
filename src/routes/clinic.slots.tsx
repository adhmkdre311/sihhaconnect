import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ClinicShell } from "@/components/ClinicShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/clinic/slots")({ component: Slots });

type Slot = { id: string; department: string; slot_at: string; capacity: number; booked: number; is_available: boolean };

function Slots() {
  const { t } = useLang();
  const { user } = useAuth();
  const [clinicId, setClinicId] = useState<string>("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState({ department: "", date: "", times: "", capacity: 1 });

  const reload = async () => {
    if (!user) return;
    const { data: role } = await supabase.from("user_roles").select("clinic_id").eq("user_id", user.id).eq("role","clinic_staff").maybeSingle();
    if (!role?.clinic_id) return;
    setClinicId(role.clinic_id);
    const { data: c } = await supabase.from("clinics").select("departments").eq("id", role.clinic_id).single();
    setDepartments(c?.departments ?? []);
    const { data: s } = await supabase.from("clinic_slots").select("id, department, slot_at, capacity, booked, is_available")
      .eq("clinic_id", role.clinic_id).order("slot_at");
    setSlots(s ?? []);
  };
  useEffect(() => { void reload(); }, [user]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!clinicId || !form.department || !form.date || !form.times) return;
    const timeList = form.times.split(",").map(s => s.trim()).filter(Boolean);
    const invalid = timeList.find(t => !/^\d{1,2}:\d{2}$/.test(t));
    if (invalid) { toast.error(`Bad time format: ${invalid}`); return; }
    const rows = timeList.map(tm => ({
      clinic_id: clinicId,
      department: form.department,
      slot_at: new Date(`${form.date}T${tm.padStart(5,"0")}`).toISOString(),
      capacity: form.capacity,
    }));
    const { error } = await supabase.from("clinic_slots").upsert(rows, { onConflict: "clinic_id,slot_at,department", ignoreDuplicates: true });
    if (error) toast.error(error.message); else { toast.success(`Added ${rows.length}`); setForm({...form, date:"", times:""}); reload(); }
  }

  async function del(id: string) {
    await supabase.from("clinic_slots").delete().eq("id", id);
    reload();
  }

  async function toggle(s: Slot) {
    const { error } = await supabase.from("clinic_slots").update({ is_available: !s.is_available }).eq("id", s.id);
    if (error) toast.error(error.message); else reload();
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = new Date(s.slot_at).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [slots]);

  return (
    <ClinicShell>
      <h1 className="mb-4 text-xl font-semibold">{t("slots")}</h1>
      <form onSubmit={add} className="mb-6 grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-5">
        <div>
          <Label>{t("department")}</Label>
          <select className="mt-1 w-full rounded-md border bg-background px-2 py-2 text-sm" value={form.department} onChange={(e)=>setForm({...form, department:e.target.value})} required>
            <option value="">—</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div><Label>{t("date")}</Label><Input type="date" value={form.date} onChange={(e)=>setForm({...form, date:e.target.value})} required /></div>
        <div className="sm:col-span-2"><Label>Times (comma-separated, HH:MM)</Label><Input placeholder="09:00, 11:30, 14:00" value={form.times} onChange={(e)=>setForm({...form, times:e.target.value})} required /></div>
        <div><Label>Capacity</Label><Input type="number" min={1} value={form.capacity} onChange={(e)=>setForm({...form, capacity:Number(e.target.value)})} /></div>
        <div className="flex items-end sm:col-span-5"><Button type="submit">{t("add_slot")}</Button></div>
      </form>

      <div className="space-y-4">
        {grouped.map(([day, list]) => (
          <div key={day} className="rounded-2xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">{new Date(day).toLocaleDateString(undefined,{weekday:"long",month:"short",day:"numeric"})}</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {list.map(s => (
                <div key={s.id} className={`rounded-lg border p-3 text-sm ${s.is_available ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{new Date(s.slot_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</div>
                      <div className="text-xs text-muted-foreground">{s.department} · {s.booked}/{s.capacity} booked</div>
                    </div>
                    <span className={`chip text-[10px] ${s.is_available ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {s.is_available ? "Open" : "Closed"}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={()=>toggle(s)}>{s.is_available ? "Close" : "Open"}</Button>
                    <button onClick={()=>del(s.id)} aria-label="delete" className="ml-auto"><Trash2 className="h-4 w-4 text-destructive" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {slots.length === 0 && <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">No slots yet. Add times above.</div>}
      </div>
    </ClinicShell>
  );
}
