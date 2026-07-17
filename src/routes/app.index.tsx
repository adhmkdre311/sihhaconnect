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
  const [firstName, setFirstName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    void supabase.from("appointments")
      .select("id, scheduled_at, department, clinic:clinics(name, address)")
      .eq("worker_id", user.id).gte("scheduled_at", new Date().toISOString())
      .in("status", ["booked"])
      .order("scheduled_at").limit(1).maybeSingle()
      .then(({ data }) => setNext(data as never));
    void supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setFirstName(((data?.full_name as string | null) ?? "").split(" ")[0] ?? ""));
  }, [user]);

  const when = next ? new Date(next.scheduled_at) : null;
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <AppShell>
      {/* Greeting */}
      <section className="mb-4">
        <div className="font-display text-2xl font-bold text-foreground">
          {firstName ? `Hello, ${firstName}` : "Hello"}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{today}</div>
      </section>

      {/* Upcoming appointment — gold eyebrow card */}
      <section className="mb-5">
        {next && when ? (
          <Link
            to="/app/appointments/$id"
            params={{ id: next.id }}
            className="group block overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary/40"
          >
            <div className="eyebrow !text-accent">{t("upcoming")}</div>
            <div className="flex items-start justify-between gap-3">
              <div className="mt-1">
                <div className="font-display text-xl font-semibold text-foreground">
                  {when.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
                </div>
                <div className="mt-0.5 text-base text-foreground/80">
                  {when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{next.clinic?.name}</span>
                </div>
                <div className="mt-0.5 text-xs capitalize text-muted-foreground">{next.department}</div>
              </div>
              <ChevronRight className="mt-1 h-5 w-5 text-primary transition group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden="true" />
            </div>
          </Link>
        ) : (
          <div className="rounded-2xl border bg-card p-5 text-center">
            <div className="eyebrow !text-accent">{t("upcoming")}</div>
            <div className="text-sm text-muted-foreground">{t("no_upcoming")}</div>
          </div>
        )}
      </section>

      {/* Two CTAs — filled teal + ghost outlined teal (matches brand prototype) */}
      <section className="space-y-3">
        <Link
          to="/app/book"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 font-display text-base font-semibold text-primary-foreground shadow-sm transition active:translate-y-px hover:bg-primary/90"
        >
          <CalendarPlus className="h-5 w-5" />
          {t("book_appointment")}
        </Link>

        <Link
          to="/app/chat"
          className="flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-primary bg-card px-5 py-4 font-display text-base font-semibold text-primary transition active:translate-y-px hover:bg-primary/5"
        >
          <MessageCircle className="h-5 w-5" />
          {t("ask_question")}
        </Link>
      </section>

      <div className="mt-6 rounded-xl border border-dashed p-3 text-center text-[11px] leading-relaxed text-muted-foreground">
        {t("ai_disclaimer")}
      </div>
    </AppShell>
  );
}
