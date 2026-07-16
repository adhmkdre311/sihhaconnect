import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LANGUAGES, useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Stethoscope, Building2, User } from "lucide-react";
import { SihhaLockup, SihhaMark } from "@/components/SihhaLogo";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { lang, setLang, t } = useLang();
  const { user, roles, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    if (roles.includes("worker")) nav({ to: "/app" });
    else if (roles.includes("employer_admin")) nav({ to: "/employer" });
    else if (roles.includes("clinic_staff")) nav({ to: "/clinic" });
  }, [user, roles, loading, nav]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
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

      <div className="relative mx-auto max-w-5xl px-5 py-10 md:py-16">
        <div className="mb-10 flex items-center justify-between">
          <SihhaLockup size="md" />
          <span className="hidden font-display text-xs uppercase tracking-[0.16em] text-primary md:inline">
            {"\n"}
          </span>
        </div>

        <div className="mb-12 max-w-2xl">
          <p className="mb-4 font-display text-xs uppercase tracking-[0.18em] text-primary">
            {t("tagline")}
          </p>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground md:text-6xl">
            Health,<br />understood.
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted-foreground md:text-lg">
            {t("app_name")} — a calm, multilingual place to book care, understand
            your medicine, and stay well. Built for Qatar's workforce.
          </p>
        </div>

        <div className="mb-10 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-primary">
            {t("choose_language")}
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  lang === l.code
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary hover:text-primary"
                }`}
              >
                <span className="mr-1">{l.flag}</span>
                {l.native}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <RoleCard icon={<User className="h-6 w-6" />} title={t("worker")} desc={t("role_worker_desc")} to="/auth" search={{ role: "worker" }} />
          <RoleCard icon={<Building2 className="h-6 w-6" />} title={t("employer_admin")} desc={t("role_employer_desc")} to="/auth" search={{ role: "employer_admin" }} />
          <RoleCard icon={<Stethoscope className="h-6 w-6" />} title={t("clinic_staff")} desc={t("role_clinic_desc")} to="/auth" search={{ role: "clinic_staff" }} />
        </div>

        <div className="mt-14 flex flex-col items-center gap-2 text-center">
          <SihhaMark className="h-5 w-5 opacity-70" />
          <p className="max-w-md text-xs text-muted-foreground">
            Administrative and health-literacy platform. Not for diagnosis or
            emergency use. For emergencies, call 999.
          </p>
        </div>
      </div>
    </div>
  );
}

function RoleCard({ icon, title, desc, to, search }: { icon: React.ReactNode; title: string; desc: string; to: string; search: Record<string,string> }) {
  return (
    <Link
      to={to}
      search={search}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
    >
      <div className="mb-3 inline-flex rounded-xl bg-primary/10 p-2.5 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <h3 className="mb-1 font-display text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
        Continue →
      </span>
    </Link>
  );
}

