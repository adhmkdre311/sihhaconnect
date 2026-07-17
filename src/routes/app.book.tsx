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

function generateSlots(): Date[] {
  const out: Date[] = [];
  const now = new Date();
  for (let d = 0; d < 5; d++) {
    for (const h of [9, 11, 14, 16]) {
      const s = new Date(now); s.setDate(now.getDate() + d + 1); s.setHours(h, 0, 0, 0);
      out.push(s);
    }
  }
  return out;
}

function Book() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicId, setClinicId] = useState<string>("");
  const [slot, setSlot] = useState<Date | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const runCtx = useServerFn(generateVisitContext);

  useEffect(() => {
    void supabase.from("clinics").select("id, name, departments, address").then(({ data }) => setClinics((data ?? []) as Clinic[]));
  }, []);

  const filteredClinics = clinics.filter((c) => !department || c.departments.includes(department));

  async function confirm() {
    if (!user || !clinicId || !slot) return;
    setBusy(true);
    try {
      const { data: appt, error } = await supabase.from("appointments").insert({
        worker_id: user.id, clinic_id: clinicId, department, symptom_category: category,
        worker_notes: notes, scheduled_at: slot.toISOString(), status: "booked",
      }).select("id").single();
      if (error || !appt) throw error ?? new Error("Failed");
      try { await runCtx({ data: { appointmentId: appt.id, symptomCategory: category, workerNotes: notes, sourceLanguage: lang } }); } catch {}
      toast.success(t("booking_confirmed"));
      nav({ to: "/app/appointments/$id", params: { id: appt.id } });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
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
          <div className="grid grid-cols-2 gap-2">
            {generateSlots().map((s) => (
              <button key={s.toISOString()} onClick={() => { setSlot(s); setStep(4); }}
                className={`rounded-lg border p-3 text-sm ${slot?.getTime() === s.getTime() ? "border-primary bg-primary/10" : ""}`}>
                {s.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                <br />
                <span className="font-medium">{s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {step === 4 && (
        <>
          <Button variant="ghost" onClick={() => setStep(3)} className="mb-2 px-0"><span aria-hidden="true" className="inline-block rtl:rotate-180">←</span> {t("back")}</Button>
          <div className="mb-3 rounded-2xl border p-4">
            <div className="text-xs text-muted-foreground">{t("date")} · {t("time")}</div>
            <div className="text-lg font-semibold">{slot?.toLocaleString()}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {clinics.find((c) => c.id === clinicId)?.name} · {t(category)}
            </div>
          </div>
          <label className="text-sm">{t("notes")}</label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="mb-3" />
          <Button className="w-full" onClick={confirm} disabled={busy}>{busy ? t("saving") : t("confirm_booking")}</Button>
        </>
      )}
    </AppShell>
  );
}
