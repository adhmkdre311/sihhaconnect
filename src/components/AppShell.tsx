import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, MessageCircle, FileText, User, AlertTriangle, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { SihhaMark } from "@/components/SihhaLogo";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { t } = useLang();
  const loc = useLocation();
  const nav = useNavigate();
  const { user, loading, roles } = useAuth();

  if (loading) return <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>;
  if (!user) { nav({ to: "/auth", search: { role: "worker" } }); return null; }
  if (!roles.includes("worker")) { nav({ to: "/" }); return null; }

  const tabs = [
    { to: "/app", icon: Home, label: t("home") },
    { to: "/app/chat", icon: MessageCircle, label: t("ask_question") },
    { to: "/app/records", icon: FileText, label: t("my_records") },
    { to: "/app/notifications", icon: Bell, label: t("notifications") },
    { to: "/app/profile", icon: User, label: t("profile") },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-20">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <SihhaMark className="h-7 w-7" />
          <h1 className="font-display text-lg font-semibold">{title ?? t("app_name")}</h1>
        </div>
        <Link to="/app/emergency" className="rounded-full bg-destructive/10 p-2 text-destructive" aria-label={t("emergency")}>
          <AlertTriangle className="h-5 w-5" />
        </Link>
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
    </div>
  );
}
