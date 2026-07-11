import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { CalendarPlus, MessageCircle, FileText, Bell } from "lucide-react";

export const Route = createFileRoute("/app/")({ component: WorkerHome });

function WorkerHome() {
  const { t } = useLang();
  const { user } = useAuth();
  const [next, setNext] = useState<{ id: string; scheduled_at: string; department: string; clinic: { name: string } | null } | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    void supabase.from("appointments")
      .select("id, scheduled_at, department, clinic:clinics(name)")
      .eq("worker_id", user.id).gte("scheduled_at", new Date().toISOString())
      .in("status", ["booked"])
      .order("scheduled_at").limit(1).maybeSingle()
      .then(({ data }) => setNext(data as never));
    void supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("worker_id", user.id).is("read_at", null)
      .then(({ count }) => setUnread(count ?? 0));
  }, [user]);

  return (
    <AppShell>
      <div className="mb-4 rounded-2xl border bg-card p-4">
        <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">{t("upcoming_appointment")}</div>
        {next ? (
          <Link to="/app/appointments/$id" params={{ id: next.id }} className="block">
            <div className="text-lg font-semibold">{new Date(next.scheduled_at).toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">{next.clinic?.name} · {next.department}</div>
          </Link>
        ) : (
          <div className="text-sm text-muted-foreground">{t("no_upcoming")}</div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ActionTile to="/app/book" icon={<CalendarPlus className="h-6 w-6" />} label={t("book_appointment")} accent />
        <ActionTile to="/app/chat" icon={<MessageCircle className="h-6 w-6" />} label={t("ask_question")} />
        <ActionTile to="/app/records" icon={<FileText className="h-6 w-6" />} label={t("my_records")} />
        <ActionTile to="/app/notifications" icon={<Bell className="h-6 w-6" />} label={t("notifications") + (unread ? ` (${unread})` : "")} />
      </div>
      <div className="mt-4 rounded-2xl border border-dashed p-4 text-xs text-muted-foreground">
        {t("ai_disclaimer")}
      </div>
    </AppShell>
  );
}

function ActionTile({ to, icon, label, accent }: { to: string; icon: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <Link to={to} className={`flex flex-col items-start gap-2 rounded-2xl border p-4 shadow-sm transition hover:border-primary ${accent ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}>
      <span className={`rounded-lg p-2 ${accent ? "bg-primary-foreground/20" : "bg-primary/10 text-primary"}`}>{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
