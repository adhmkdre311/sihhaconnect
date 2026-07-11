import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

type Slot = { id: string; department: string; slot_at: string; capacity: number; booked: number };

function Slots() {
  const { t } = useLang();
  const { user } = useAuth();
  const [clinicId, setClinicId] = useState<string>("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState({ department: "", date: "", time: "", capacity: 1 });

  const reload = async () => {
    if (!user) return;
    const { data: role } = await supabase.from("user_roles").select("clinic_id").eq("user_id", user.id).eq("role","clinic_staff").maybeSingle();
    if (!role?.clinic_id) return;
    setClinicId(role.clinic_id);
    const { data: c } = await supabase.from("clinics").select("departments").eq("id", role.clinic_id).single();
    setDepartments(c?.departments ?? []);
    const { data: s } = await supabase.from("clinic_slots").select("id, department, slot_at, capacity, booked")
      .eq("clinic_id", role.clinic_id).order("slot_at");
    setSlots(s ?? []);
  };
  useEffect(() => { void reload(); }, [user]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!clinicId || !form.department || !form.date || !form.time) return;
    const iso = new Date(`${form.date}T${form.time}`).toISOString();
    const { error } = await supabase.from("clinic_slots").insert({
      clinic_id: clinicId, department: form.department, slot_at: iso, capacity: form.capacity,
    });
    if (error) toast.error(error.message); else { toast.success("Added"); setForm({...form, date:"", time:""}); reload(); }
  }

  async function del(id: string) {
    await supabase.from("clinic_slots").delete().eq("id", id);
    reload();
  }

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
        <div><Label>{t("time")}</Label><Input type="time" value={form.time} onChange={(e)=>setForm({...form, time:e.target.value})} required /></div>
        <div><Label>Capacity</Label><Input type="number" min={1} value={form.capacity} onChange={(e)=>setForm({...form, capacity:Number(e.target.value)})} /></div>
        <div className="flex items-end"><Button type="submit">{t("add_slot")}</Button></div>
      </form>

      <div className="rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr><th className="p-3">{t("date")} / {t("time")}</th><th className="p-3">{t("department")}</th><th className="p-3">Capacity</th><th className="p-3">Booked</th><th></th></tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id} className="border-b last:border-0">
                <td className="p-3">{new Date(s.slot_at).toLocaleString()}</td>
                <td className="p-3">{s.department}</td>
                <td className="p-3">{s.capacity}</td>
                <td className="p-3">{s.booked}</td>
                <td className="p-3"><button onClick={()=>del(s.id)} aria-label="delete"><Trash2 className="h-4 w-4 text-destructive" /></button></td>
              </tr>
            ))}
            {slots.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">—</td></tr>}
          </tbody>
        </table>
      </div>
    </ClinicShell>
  );
}
