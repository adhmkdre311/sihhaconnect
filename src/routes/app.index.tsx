import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { CalendarPlus, MessageCircle, MapPin, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/")({ component: WorkerHome });

function WorkerHome() {
  const { t } = useLang();
  const { user } = useAuth();
  const [next, setNext] = useState<{ id: string; scheduled_at: string; department: string; clinic: { name: string; address: string | null } | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    void supabase.from("appointments")
      .select("id, scheduled_at, department, clinic:clinics(name, address)")
      .eq("worker_id", user.id).gte("scheduled_at", new Date().toISOString())
      .in("status", ["booked"])
      .order("scheduled_at").limit(1).maybeSingle()
      .then(({ data }) => setNext(data as never));
  }, [user]);

  const when = next ? new Date(next.scheduled_at) : null;

  return (
    <AppShell>
      {/* Upcoming appointment — the one thing they're most likely to need */}
      <section className="mb-5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("upcoming_appointment")}
        </div>
        {next && when ? (
          <Link
            to="/app/appointments/$id"
            params={{ id: next.id }}
            className="group block overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/10 p-5 shadow-sm transition hover:border-primary/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-2xl font-semibold text-foreground">
                  {when.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
                </div>
                <div className="mt-1 text-lg text-foreground/80">
                  {when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{next.clinic?.name}</span>
                </div>
                <div className="mt-0.5 text-xs capitalize text-muted-foreground">{next.department}</div>
              </div>
              <ChevronRight className="h-5 w-5 text-primary transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        ) : (
          <div className="rounded-2xl border border-dashed bg-card p-5 text-center">
            <div className="text-sm text-muted-foreground">{t("no_upcoming")}</div>
          </div>
        )}
      </section>

      {/* Two large primary actions — Book, Ask Assistant */}
      <section className="space-y-3">
        <Link
          to="/app/book"
          className="flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-md transition active:translate-y-px hover:bg-primary/90"
        >
          <span className="rounded-xl bg-primary-foreground/15 p-3">
            <CalendarPlus className="h-7 w-7" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-lg font-semibold">{t("book_appointment")}</span>
            <span className="block text-sm text-primary-foreground/80">Choose by symptom, in your language</span>
          </span>
          <ChevronRight className="h-5 w-5" />
        </Link>

        <Link
          to="/app/chat"
          className="flex items-center gap-4 rounded-2xl border-2 border-primary bg-card p-5 text-primary shadow-sm transition active:translate-y-px hover:bg-primary/5"
        >
          <span className="rounded-xl bg-primary/10 p-3">
            <MessageCircle className="h-7 w-7" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-lg font-semibold text-foreground">{t("ask_question")}</span>
            <span className="block text-sm text-muted-foreground">Explain a document or a medical word</span>
          </span>
          <ChevronRight className="h-5 w-5" />
        </Link>
      </section>

      <div className="mt-6 rounded-xl border border-dashed p-3 text-center text-[11px] leading-relaxed text-muted-foreground">
        {t("ai_disclaimer")}
      </div>
    </AppShell>
  );
}
