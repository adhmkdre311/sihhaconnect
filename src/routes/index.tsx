import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LANGUAGES, useLang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Heart, Stethoscope, Building2, User } from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-b from-background via-secondary/40 to-background">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-2xl bg-primary p-2.5 text-primary-foreground">
            <Heart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{t("app_name")}</h1>
            <p className="text-sm text-muted-foreground">{t("tagline")}</p>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border bg-card p-4">
          <p className="mb-3 text-sm font-medium">{t("choose_language")}</p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  lang === l.code
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary"
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

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Administrative and health-literacy platform. Not for diagnosis or emergency use. For emergencies, call 999.
        </p>
      </div>
    </div>
  );
}

function RoleCard({ icon, title, desc, to, search }: { icon: React.ReactNode; title: string; desc: string; to: string; search: Record<string,string> }) {
  return (
    <Link to={to} search={search} className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary hover:shadow-md">
      <div className="mb-3 inline-flex rounded-xl bg-primary/10 p-2.5 text-primary">{icon}</div>
      <h3 className="mb-1 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}

