import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MapPin, CalendarClock, ListChecks } from "lucide-react";

export const Route = createFileRoute("/app/appointments/$id")({ component: ApptDetail });

type Appt = {
  id: string; scheduled_at: string; department: string; status: string;
  symptom_category: string | null; worker_notes: string | null; visit_summary: string | null;
  clinic: { name: string; address: string | null; phone: string | null; lat: number | null; lng: number | null } | null;
};

function ApptDetail() {
  const { id } = Route.useParams();
  const { t } = useLang();
  const [appt, setAppt] = useState<Appt | null>(null);
  useEffect(() => {
    void supabase.from("appointments")
      .select("id, scheduled_at, department, status, symptom_category, worker_notes, visit_summary, clinic:clinics(name,address,phone,lat,lng)")
      .eq("id", id).single()
      .then(({ data }) => setAppt(data as never));
  }, [id]);

  if (!appt) return <AppShell><div className="text-sm text-muted-foreground">{t("loading")}</div></AppShell>;

  const when = new Date(appt.scheduled_at);
  const ics = `data:text/calendar;charset=utf-8,${encodeURIComponent(
    `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${appt.clinic?.name ?? "Appointment"}\nDTSTART:${when.toISOString().replace(/[-:.]/g,"").slice(0,15)}Z\nEND:VEVENT\nEND:VCALENDAR`
  )}`;

  return (
    <AppShell title={t("upcoming_appointment")}>
      <div className="rounded-2xl border bg-primary/10 p-4 text-primary">
        <div className="text-xs uppercase">{t("booking_confirmed")}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{when.toLocaleString()}</div>
        <div className="text-sm text-foreground/80">{appt.clinic?.name} · {t(appt.department)}</div>
      </div>

      {appt.clinic?.address && (
        <a target="_blank" rel="noopener" href={`https://maps.google.com/?q=${appt.clinic.lat},${appt.clinic.lng}`}
          className="mt-3 flex items-start gap-2 rounded-2xl border bg-card p-4">
          <MapPin className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <div className="font-medium">{appt.clinic.name}</div>
            <div className="text-xs text-muted-foreground">{appt.clinic.address}</div>
            {appt.clinic.phone && <div className="text-xs">{appt.clinic.phone}</div>}
          </div>
        </a>
      )}

      <a href={ics} download="appointment.ics" className="mt-3 block">
        <Button variant="outline" className="w-full"><CalendarClock className="mr-2 h-4 w-4" />{t("add_calendar")}</Button>
      </a>

      <div className="mt-4 rounded-2xl border p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium"><ListChecks className="h-4 w-4" />{t("what_to_bring")}</div>
        <ul className="ml-1 space-y-1.5 text-sm text-foreground/80">
          <li className="flex gap-2"><span className="text-primary">•</span> Qatar ID (or passport)</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Any medicines you currently take</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Previous reports for this issue, if any</li>
          <li className="flex gap-2"><span className="text-primary">•</span> Arrive 10 minutes early to check in</li>
        </ul>
      </div>

      {appt.visit_summary && (
        <div className="mt-4 rounded-2xl border bg-secondary p-4">
          <div className="mb-1 text-xs uppercase text-muted-foreground">{t("post_visit_summary")}</div>
          <p className="whitespace-pre-line text-sm">{appt.visit_summary}</p>
        </div>
      )}
    </AppShell>
  );
}
