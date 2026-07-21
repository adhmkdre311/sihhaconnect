import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Users, CalendarDays, BarChart3, Megaphone, CreditCard, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLang } from "@/lib/i18n";
import { SihhaLockup } from "@/components/SihhaLogo";

export function AdminShell({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const loc = useLocation();
  const nav = useNavigate();
  const { user, loading, roles, approved, signOut } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted-foreground">{t("loading")}</div>;
  if (!user) {
    const next = loc.pathname + (typeof loc.search === "string" ? loc.search : "");
    nav({ to: "/auth", search: { role: "employer_admin", mode: "login", next } });
    return null;
  }
  if (!roles.includes("employer_admin")) { nav({ to: "/" }); return null; }
  if (!approved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-2xl border bg-card p-8 shadow-sm text-center">
          <h1 className="font-display text-xl font-semibold">Awaiting approval</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your employer admin access is pending review by a Sihha platform administrator.</p>
          <button onClick={() => { void signOut(); nav({ to: "/" }); }} className="mt-6 text-sm font-medium text-primary underline">{t("logout")}</button>
        </div>
      </div>
    );
  }

  const items = [
    { to: "/employer", icon: BarChart3, label: t("home") },
    { to: "/employer/roster", icon: Users, label: t("roster") },
    { to: "/employer/appointments", icon: CalendarDays, label: t("book_appointment") },
    { to: "/employer/compliance", icon: BarChart3, label: t("compliance") },
    { to: "/employer/notifications", icon: Megaphone, label: t("notifications") },
    { to: "/employer/billing", icon: CreditCard, label: t("billing") },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="border-b border-sidebar-border p-4">
          <SihhaLockup variant="reversed" size="md" />
          <p className="mt-1 text-xs text-sidebar-foreground/70">{t("employer_admin")}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((i) => {
            const active = loc.pathname === i.to;
            const Icon = i.icon;
            return (
              <Link key={i.to} to={i.to} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"}`}>
                <Icon className="h-4 w-4" /> {i.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={() => { void signOut(); nav({ to: "/" }); }} className="m-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" /> {t("logout")}
        </button>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
          <span className="font-semibold">{t("employer_admin")}</span>
          <button onClick={() => { void signOut(); nav({ to: "/" }); }} aria-label="logout"><LogOut className="h-5 w-5" /></button>
        </header>
        <div className="md:hidden overflow-x-auto border-b bg-background">
          <div className="flex gap-1 p-2">
            {items.map((i) => {
              const active = loc.pathname === i.to;
              return <Link key={i.to} to={i.to} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs ${active?"bg-primary text-primary-foreground":"bg-muted"}`}>{i.label}</Link>;
            })}
          </div>
        </div>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
