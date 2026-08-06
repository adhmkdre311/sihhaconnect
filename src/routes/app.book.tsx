import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateVisitContext } from "@/lib/ai.functions";
import { Thermometer, Bandage, Smile, Stethoscope, Sparkles, HeartPulse } from "lucide-react";

export const Route = createFileRoute("/app/book")({ component: Book });

const CATEGORIES = [
  { key: "fever", icon: Thermometer, dept: "general" },
  { key: "injury", icon: Bandage, dept: "injury" },
  { key: "dental", icon: Smile, dept: "dental" },
  { key: "routine_checkup", icon: HeartPulse, dept: "routine_checkup" },
  { key: "dermatology", icon: Sparkles, dept: "dermatology" },
  { key: "general", icon: Stethoscope, dept: "general" },
] as const;

type Clinic = { id: string; name: string; departments: string[]; address: string | null };
type Slot = { id: string; slot_at: string };

function Book() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicId, setClinicId] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const runCtx = useServerFn(generateVisitContext);

  useEffect(() => {
    void supabase.from("clinics").select("id, name, departments, address").then(({ data }) => setClinics((data ?? []) as Clinic[]));
  }, []);

  useEffect(() => {
    if (!clinicId) { setSlots([]); return; }
    void supabase.from("clinic_slots")
      .select("id, slot_at, is_available, department")
      .eq("clinic_id", clinicId)
      .eq("is_available", true)
      .gte("slot_at", new Date().toISOString())
      .order("slot_at", { ascending: true })
      .limit(60)
      .then(({ data }) => {
        const rows = (data ?? []).filter((r) => !department || r.department === department);
        setSlots(rows.map((r) => ({ id: r.id, slot_at: r.slot_at })));
      });
  }, [clinicId, department]);

  const filteredClinics = clinics.filter((c) => !department || c.departments.includes(department));

  async function confirm() {
    if (!user || !clinicId || !slot) return;
    if (notes.length > 500) { toast.error("Notes must be 500 characters or fewer"); return; }
    setBusy(true);
    try {
      const { data: appt, error } = await supabase.from("appointments").insert({
        worker_id: user.id, clinic_id: clinicId, department, symptom_category: category,
        worker_notes: notes, scheduled_at: slot.slot_at, slot_id: slot.id, status: "pending",
      }).select("id").single();
      if (error || !appt) throw error ?? new Error("Failed");
      try { await runCtx({ data: { appointmentId: appt.id, symptomCategory: category, workerNotes: notes, sourceLanguage: lang } }); } catch {}
      toast.success(t("booking_confirmed"));
      nav({ to: "/app/appointments/$id", params: { id: appt.id } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      // Unique constraint or trigger raced — surface a friendly retry hint.
      toast.error(/duplicate|unique|slot/i.test(msg) ? "That time was just taken — please pick another slot." : msg);
    } finally { setBusy(false); }
  }

  return (
    <AppShell title={t("book_appointment")}>
      {step === 1 && (
        <>
          <p className="mb-3 text-sm font-medium">{t("choose_symptom")}</p>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              return (
                <button key={c.key} onClick={() => { setCategory(c.key); setDepartment(c.dept); setStep(2); }}
                  className="flex flex-col items-start gap-2 rounded-2xl border bg-card p-4 text-start transition hover:border-primary">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-6 w-6" /></span>
                  <span className="text-sm font-medium">{t(c.key)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <Button variant="ghost" onClick={() => setStep(1)} className="mb-2 px-0"><span aria-hidden="true" className="inline-block rtl:rotate-180">←</span> {t("back")}</Button>
          <p className="mb-3 text-sm font-medium">{t("choose_clinic")}</p>
          <div className="space-y-2">
            {filteredClinics.map((c) => (
              <button key={c.id} onClick={() => { setClinicId(c.id); setStep(3); }}
                className={`w-full rounded-2xl border p-4 text-start ${clinicId === c.id ? "border-primary" : ""}`}>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.address}</div>
              </button>
            ))}
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <Button variant="ghost" onClick={() => setStep(2)} className="mb-2 px-0"><span aria-hidden="true" className="inline-block rtl:rotate-180">←</span> {t("back")}</Button>
          <p className="mb-3 text-sm font-medium">{t("choose_time")}</p>
          {slots.length === 0 ? (
            <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
              No open slots at this clinic. Try another clinic.
              <div className="mt-3">
                <Button variant="outline" onClick={() => setStep(2)}>Pick another clinic</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(
                slots.reduce<Record<string, Slot[]>>((acc, s) => {
                  const day = new Date(s.slot_at).toDateString();
                  (acc[day] ||= []).push(s);
                  return acc;
                }, {}),
              ).map(([day, group]) => (
                <div key={day}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {new Date(day).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {group.map((s) => (
                      <button key={s.id} onClick={() => { setSlot(s); setStep(4); }}
                        className={`rounded-lg border p-2 text-sm ${slot?.id === s.id ? "border-primary bg-primary/10" : ""}`}>
                        {new Date(s.slot_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {step === 4 && (
        <>
          <Button variant="ghost" onClick={() => setStep(3)} className="mb-2 px-0"><span aria-hidden="true" className="inline-block rtl:rotate-180">←</span> {t("back")}</Button>
          <div className="mb-3 rounded-2xl border p-4">
            <div className="text-xs text-muted-foreground">{t("date")} · {t("time")}</div>
            <div className="text-lg font-semibold">{slot ? new Date(slot.slot_at).toLocaleString() : ""}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {clinics.find((c) => c.id === clinicId)?.name} · {t(category)}
            </div>
          </div>
          <label className="text-sm">{t("notes")}</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 500))} rows={4} maxLength={500} className="mb-1" />
          <div className="mb-3 text-end text-[10px] text-muted-foreground">{notes.length}/500</div>
          <Button className="w-full" onClick={confirm} disabled={busy}>{busy ? t("saving") : t("confirm_booking")}</Button>
        </>
      )}
    </AppShell>
  );
}
