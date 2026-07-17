import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useLang } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/lib/auth";
import { Stethoscope, Building2, User } from "lucide-react";
import { SihhaLockup, SihhaMark } from "@/components/SihhaLogo";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { t } = useLang();
  const { user, roles, loading } = useAuth();
  const nav = useNavigate();
  useDocumentTitle("hero_title");

  useEffect(() => {
    if (loading || !user) return;
    if (roles.includes("worker")) nav({ to: "/app" });
    else if (roles.includes("employer_admin")) nav({ to: "/employer" });
    else if (roles.includes("clinic_staff")) nav({ to: "/clinic" });
  }, [user, roles, loading, nav]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* BUG-16: skip link; visible on keyboard focus only */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring"
      >
        {t("skip_to_content")}
      </a>
      {/* warm desert light — soft gold halo, per brand cover treatment */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full opacity-70"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(217,164,65,0.35), transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 bottom-0 h-[380px] w-[380px] rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(circle at 60% 60%, rgba(14,92,86,0.18), transparent 70%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-5xl px-5 py-10 md:py-16">
        <header className="mb-10 flex items-center justify-between">
          <SihhaLockup size="md" />
          <span className="hidden font-display text-xs uppercase tracking-[0.16em] text-primary md:inline">
            {"\n"}
          </span>
        </header>

        <main id="main" className="flex-1" tabIndex={-1}>
        <div className="mb-12 max-w-2xl">
          <p className="mb-4 font-display text-xs uppercase tracking-[0.18em] text-primary">
            {t("tagline")}
          </p>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground md:text-6xl">
            {t("hero_title")}
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
            {t("hero_subtitle")}
          </p>
        </div>

        <div className="mb-10 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-primary">
            {t("choose_language")}
          </p>
          <LanguageSwitcher />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <RoleCard icon={<User className="h-6 w-6" />} title={t("worker")} desc={t("role_worker_desc")} to="/auth" search={{ role: "worker" }} />
          <RoleCard icon={<Building2 className="h-6 w-6" />} title={t("employer_admin")} desc={t("role_employer_desc")} to="/auth" search={{ role: "employer_admin" }} />
          <RoleCard icon={<Stethoscope className="h-6 w-6" />} title={t("clinic_staff")} desc={t("role_clinic_desc")} to="/auth" search={{ role: "clinic_staff" }} />
        </div>
        </main>

        <footer className="mt-14 flex flex-col items-center gap-2 text-center">
          <SihhaMark className="h-5 w-5 opacity-70" />
          <p className="max-w-md text-xs text-muted-foreground">
            {t("hero_disclaimer")}
          </p>
        </footer>
      </div>
    </div>
  );
}

function RoleCard({ icon, title, desc, to, search }: { icon: React.ReactNode; title: string; desc: string; to: string; search: Record<string,string> }) {
  return (
    <Link
      to={to}
      search={search}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="mb-3 inline-flex rounded-xl bg-primary/10 p-2.5 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <h2 className="mb-1 font-display text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{desc}</p>
      {/* BUG-31 affordance: continue CTA always visible, translated, RTL-aware arrow */}
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-100 transition group-focus-visible:underline">
        <TranslatedContinue />
        <span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
      </span>
    </Link>
  );
}

function TranslatedContinue() {
  const { t } = useLang();
  return <>{t("continue")}</>;
}

