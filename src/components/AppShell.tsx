import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Home, CalendarPlus, MessageCircle, FileText, AlertTriangle, Bell, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { SihhaMark } from "@/components/SihhaLogo";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { acceptConsent } from "@/lib/roles.functions";
import { Button } from "@/components/ui/button";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { t } = useLang();
  const loc = useLocation();
  const nav = useNavigate();
  const { user, loading, roles } = useAuth();

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>;
  if (!user) { nav({ to: "/auth", search: { role: "worker" } }); return null; }
  if (!roles.includes("worker")) { nav({ to: "/" }); return null; }

  return <WorkerFrame title={title}>{children}</WorkerFrame>;
}

function WorkerFrame({ children, title }: { children: ReactNode; title?: string }) {
  const { t } = useLang();
  const loc = useLocation();
  const { user } = useAuth();
  const accept = useServerFn(acceptConsent);
  const [consent, setConsent] = useState<"loading" | "accepted" | "pending">("loading");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("consent_accepted_at").eq("id", user.id).maybeSingle()
      .then(({ data }) => setConsent(data?.consent_accepted_at ? "accepted" : "pending"));
  }, [user]);

  const tabs = [
    { to: "/app", icon: Home, label: t("home") },
    { to: "/app/book", icon: CalendarPlus, label: t("book_appointment") },
    { to: "/app/chat", icon: MessageCircle, label: t("ask_question") },
    { to: "/app/records", icon: FileText, label: t("my_records") },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-20">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <SihhaMark className="h-7 w-7" />
          <h1 className="font-display text-lg font-semibold">{title ?? t("app_name")}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/app/notifications" className="rounded-full p-2 text-foreground/70 hover:bg-muted" aria-label={t("notifications")}>
            <Bell className="h-5 w-5" />
          </Link>
          <Link to="/app/profile" className="rounded-full p-2 text-foreground/70 hover:bg-muted" aria-label={t("profile")}>
            <User className="h-5 w-5" />
          </Link>
          <Link to="/app/emergency" className="rounded-full bg-destructive/10 p-2 text-destructive" aria-label={t("emergency")}>
            <AlertTriangle className="h-5 w-5" />
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md justify-around border-t bg-background/95 py-2 backdrop-blur">
        {tabs.map((tab) => {
          const active = loc.pathname === tab.to;
          const Icon = tab.icon;
          return (
            <Link key={tab.to} to={tab.to} className={`flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="h-5 w-5" />
              <span className="max-w-[68px] truncate">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
      {consent === "pending" && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-background p-6 shadow-xl sm:rounded-2xl">
            <SihhaMark className="mb-3 h-8 w-8" />
            <h2 className="font-display text-xl font-semibold text-foreground">Your privacy matters</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sihha helps you understand your health in your language. We store your appointments, uploaded documents, and chats securely so you can review them later. We never share your health data with your employer. By continuing, you accept our Terms of Service and Privacy Policy.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                onClick={async () => {
                  await accept({});
                  setConsent("accepted");
                }}
              >
                I agree, continue
              </Button>
              <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Not now</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
