import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, type ComponentType, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SihhaLockup } from "@/components/SihhaLogo";

type NavItem = { to: string; label: string; icon: ComponentType<{ className?: string }> };

export function StaffFrame({
  role, roleLabel, items, children, requireApproved = true,
}: {
  role: "clinic_staff" | "employer_admin" | "pharmacy_staff" | "insurance_staff" | "platform_admin" | "super_admin";
  roleLabel: string;
  items: NavItem[];
  children: ReactNode;
  requireApproved?: boolean;
}) {
  const loc = useLocation();
  const nav = useNavigate();
  const { user, loading, roles, approved, isActive, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const authRole = role === "platform_admin" || role === "super_admin" ? "worker" : role;
      nav({ to: "/auth", search: { role: authRole, mode: "login", next: loc.pathname } });
    }
  }, [loading, user, role, loc.pathname, nav]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  if (!user) return <div className="p-6 text-sm text-muted-foreground">Redirecting…</div>;
  if (!isActive) {
    return (
      <PendingScreen
        title="Account deactivated"
        body="This account has been deactivated by a platform administrator. Contact support to restore access."
        onSignOut={() => { void signOut(); nav({ to: "/" }); }}
      />
    );
  }
  const hasRole = roles.includes(role) || (role === "platform_admin" && roles.includes("super_admin"));
  if (!hasRole) {
    return (
      <PendingScreen
        title={`Access to the ${roleLabel} portal is not enabled for this account.`}
        body="If you believe this is a mistake, contact your platform administrator."
        onSignOut={() => { void signOut(); nav({ to: "/" }); }}
      />
    );
  }
  if (requireApproved && !approved) {
    return (
      <PendingScreen
        title="Your account is awaiting approval"
        body={`Your ${roleLabel} access is pending review by a platform administrator. You'll get an email when it's approved.`}
        onSignOut={() => { void signOut(); nav({ to: "/" }); }}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="border-b border-sidebar-border p-4">
          <SihhaLockup variant="reversed" size="md" />
          <p className="mt-1 text-xs text-sidebar-foreground/70">{roleLabel}</p>
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
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b bg-background px-4 py-3 md:hidden">
          <span className="font-semibold">{roleLabel}</span>
          <button onClick={() => { void signOut(); nav({ to: "/" }); }} aria-label="logout"><LogOut className="h-5 w-5" /></button>
        </header>
        <div className="md:hidden overflow-x-auto border-b bg-background">
          <div className="flex gap-1 p-2">
            {items.map((i) => {
              const active = loc.pathname === i.to;
              return <Link key={i.to} to={i.to} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{i.label}</Link>;
            })}
          </div>
        </div>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function PendingScreen({ title, body, onSignOut }: { title: string; body: string; onSignOut: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <SihhaLockup size="md" />
        <h1 className="mt-4 font-display text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <button onClick={onSignOut} className="mt-6 text-sm font-medium text-primary underline">Sign out</button>
      </div>
    </div>
  );
}